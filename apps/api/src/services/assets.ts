/**
 * Asset intake service (MCP-11 + MCP-12 + MCP-15).
 *
 * Duong di: upload-intent -> PUT byte -> do that (probe) -> validate -> asset san sang.
 * KHONG buoc nao duoc bo qua, va khong so do nao duoc dien neu chua do duoc.
 */
import {
  ERROR_CODES,
  MAX_FILE_SIZE_BYTES,
  RETENTION_POLICY_VERSION,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_VIDEO_FORMATS,
  apiError,
  validateMedia,
  type ApiError,
  type Asset,
  type MediaProbe,
  type MediaType,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { bufferSource } from '../media/byte-source.js';
import type { Page, PageQuery, SourceFileRecord, ValidationRecord } from '../persistence/types.js';
import { objectKeyForSource, parseSourceKey } from '../storage/object-key.js';
import { StorageError } from '../storage/local-fs-adapter.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

const ALL_SUPPORTED: readonly string[] = [...SUPPORTED_IMAGE_FORMATS, ...SUPPORTED_VIDEO_FORMATS];
const MAX_FILENAME_LENGTH = 255;

export interface UploadIntent {
  assetId: string;
  sourceFileId: string;
  uploadUrl: string;
  expiresAt: string;
  maxByteSize: number;
}

export interface UploadIntentInput {
  originalFilename: unknown;
  mimeType: unknown;
  byteSize: unknown;
  mediaType: unknown;
}

export async function createUploadIntent(
  ctx: AppContext,
  actor: Actor,
  projectId: string,
  input: UploadIntentInput,
): Promise<ServiceResult<UploadIntent>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: projectId,
    permission: 'asset.upload',
  });
  if (!allowed.ok) return fail(allowed.error);

  const project = await ctx.persistence.projects.findById(actor.workspace.id, projectId);
  if (!project) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'project' }));

  const originalFilename = typeof input.originalFilename === 'string' ? input.originalFilename.trim() : '';
  const mimeType = typeof input.mimeType === 'string' ? input.mimeType.trim().toLowerCase() : '';
  const byteSize = typeof input.byteSize === 'number' ? input.byteSize : Number.NaN;
  const mediaType = input.mediaType as MediaType;

  if (originalFilename.length === 0 || originalFilename.length > MAX_FILENAME_LENGTH) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'originalFilename' }));
  }
  if (mediaType !== 'image' && mediaType !== 'video') {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'mediaType' }));
  }
  // Chan som: dinh dang khong ho tro thi khong can ton bang thong upload.
  if (!ALL_SUPPORTED.includes(mimeType)) {
    return fail(apiError(ERROR_CODES.MCP_VAL_UNSUPPORTED_FORMAT, { mimeType: mimeType || 'unknown' }));
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return fail(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));
  }
  if (byteSize > MAX_FILE_SIZE_BYTES) {
    return fail(apiError(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, { limitBytes: MAX_FILE_SIZE_BYTES }));
  }

  const assetId = newId('ast');
  const sourceFileId = newId('src');
  const storageKey = objectKeyForSource({
    workspaceId: actor.workspace.id,
    projectId,
    assetId,
    sourceFileId,
    mimeType,
  });

  const asset: Asset = {
    id: assetId,
    workspaceId: actor.workspace.id,
    projectId,
    mediaType,
    sourceFileId,
    createdAt: ctx.now().toISOString(),
  };
  const record: SourceFileRecord = {
    id: sourceFileId,
    workspaceId: actor.workspace.id,
    projectId,
    assetId,
    storageKey,
    originalFilename,
    declaredMimeType: mimeType,
    declaredByteSize: byteSize,
    declaredMediaType: mediaType,
    uploadState: 'pending',
    measured: null,
    createdAt: ctx.now().toISOString(),
    uploadedAt: null,
    // P1.1 (Q-18): moi tep sinh ra o trang thai 'active', chua tung duoc doc.
    lastAccessedAt: null,
    retentionState: 'active',
    legalHoldAt: null,
    scheduledDeletionAt: null,
    deletedAt: null,
    retentionPolicyVersion: RETENTION_POLICY_VERSION,
  };
  await ctx.persistence.assets.create(asset);
  await ctx.persistence.sourceFiles.create(record);

  const signed = await ctx.storage.createUploadUrl({
    ref: { bucket: ctx.bucket, key: storageKey },
    contentType: mimeType,
    maxByteSize: MAX_FILE_SIZE_BYTES,
    ttlSeconds: ctx.config.uploadTicketTtlSeconds,
  });

  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.ASSET_UPLOAD_STARTED,
    subjectType: 'asset',
    subjectId: assetId,
    // Khong ghi uploadUrl (co chu ky) va khong ghi ten file day du ngoai muc dich hien thi.
    detail: { projectId, declaredMimeType: mimeType, declaredByteSize: byteSize },
  });

  return ok({
    assetId,
    sourceFileId,
    uploadUrl: signed.url,
    expiresAt: signed.expiresAt,
    maxByteSize: MAX_FILE_SIZE_BYTES,
  });
}

export interface UploadResult {
  sourceFileId: string;
  assetId: string;
  byteSize: number;
  checksumSha256: string;
  detectedMimeType: string | null;
}

/**
 * Nhan byte that. Xac thuc bang upload ticket (capability), khong bang session:
 * day chinh la hop dong cua mot presigned URL - doi sang R2 thi client PUT thang len R2.
 */
export async function completeUpload(
  ctx: AppContext,
  token: string,
  body: Buffer,
): Promise<ServiceResult<UploadResult>> {
  const ticket = ctx.storage.verifyTicket(token, 'upload', ctx.now().getTime());
  if (!ticket.ok) return fail(ticket.error);
  const { payload } = ticket;

  if (body.byteLength <= 0) return fail(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));
  if (body.byteLength > Math.min(payload.maxByteSize, MAX_FILE_SIZE_BYTES)) {
    return fail(apiError(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, { limitBytes: MAX_FILE_SIZE_BYTES }));
  }

  const parsed = parseSourceKey(payload.key);
  if (!parsed) return fail(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_TICKET_INVALID));

  const record = await ctx.persistence.sourceFiles.findById(parsed.workspaceId, parsed.sourceFileId);
  if (!record || record.storageKey !== payload.key) {
    return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));
  }
  if (record.uploadState === 'stored') {
    // I-1: file goc da co byte thi khong ai duoc ghi de.
    return fail(apiError(ERROR_CODES.MCP_STORAGE_WRITE_DENIED, { reason: 'source_immutable' }));
  }

  try {
    await ctx.storage.putObject({ bucket: payload.bucket, key: payload.key }, body, payload.contentType);
  } catch (error) {
    if (error instanceof StorageError) return fail(error.apiErrorValue);
    return fail(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, { reason: 'write_failed' }));
  }

  const head = await ctx.storage.head({ bucket: payload.bucket, key: payload.key });
  const probe = await ctx.probe.probe(bufferSource(body));

  const stored = await ctx.persistence.sourceFiles.markStored(parsed.workspaceId, parsed.sourceFileId, {
    measured: {
      // MIME lay tu magic bytes; neu khong nhan dang duoc thi giu nguyen khai bao
      // cua client DE validate bat loi mismatch/unsupported - khong tu "sua" gium.
      mimeType: probe.detectedMimeType ?? record.declaredMimeType,
      byteSize: body.byteLength,
      checksumSha256: head.checksumSha256 ?? '',
      mediaType: probe.mediaType ?? record.declaredMediaType,
      durationSeconds: probe.durationSeconds,
      widthPx: probe.widthPx,
      heightPx: probe.heightPx,
      hasAudioStream: probe.hasAudioStream,
      corrupt: probe.corrupt,
    },
    uploadedAt: ctx.now().toISOString(),
  });

  await recordAudit(ctx.persistence, {
    workspaceId: parsed.workspaceId,
    actorUserId: null,
    eventType: AUDIT_EVENTS.ASSET_UPLOAD_COMPLETED,
    subjectType: 'asset',
    subjectId: parsed.assetId,
    detail: {
      byteSize: body.byteLength,
      detectedMimeType: probe.detectedMimeType,
      widthPx: probe.widthPx,
      heightPx: probe.heightPx,
      durationSeconds: probe.durationSeconds,
    },
  });

  return ok({
    sourceFileId: stored.id,
    assetId: parsed.assetId,
    byteSize: body.byteLength,
    checksumSha256: stored.measured?.checksumSha256 ?? '',
    detectedMimeType: probe.detectedMimeType,
  });
}

export interface ValidationOutcome {
  assetId: string;
  valid: boolean;
  errors: ApiError[];
}

export async function validateAsset(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<ValidationOutcome>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'asset.upload',
  });
  if (!allowed.ok) return fail(allowed.error);

  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));
  if (record.uploadState !== 'stored' || record.measured === null) {
    // Chua co byte nao => khong validate "kho khong", bao dung trang thai.
    return fail(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));
  }

  const measured = record.measured;
  const probe: MediaProbe = {
    mediaType: measured.mediaType,
    mimeType: measured.mimeType,
    byteSize: measured.byteSize,
    durationSeconds: measured.durationSeconds,
    widthPx: measured.widthPx,
    heightPx: measured.heightPx,
    corrupt: measured.corrupt,
  };
  const result = validateMedia(probe);
  const errors = [...result.errors];
  // Client khai mot dang, byte lai la dang khac => bao ro, khong im lang chap nhan.
  if (measured.mimeType !== record.declaredMimeType) {
    errors.push(
      apiError(ERROR_CODES.MCP_VAL_MIME_MISMATCH, {
        declared: record.declaredMimeType,
        detected: measured.mimeType,
      }),
    );
  }

  const valid = errors.length === 0;
  const validation: ValidationRecord = {
    id: newId('val'),
    workspaceId: actor.workspace.id,
    assetId,
    sourceFileId: record.id,
    state: valid ? 'passed' : 'failed',
    errors,
    validatedAt: ctx.now().toISOString(),
  };
  await ctx.persistence.validations.save(validation);
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: valid ? AUDIT_EVENTS.ASSET_VALIDATION_PASSED : AUDIT_EVENTS.ASSET_VALIDATION_FAILED,
    subjectType: 'asset',
    subjectId: assetId,
    detail: { errorCodes: errors.map((e) => e.code).join(',') || null },
  });

  return ok({ assetId, valid, errors });
}

export interface AssetView {
  asset: Asset;
  sourceFile: {
    id: string;
    originalFilename: string;
    declaredMimeType: string;
    declaredByteSize: number;
    uploadState: SourceFileRecord['uploadState'];
    measured: SourceFileRecord['measured'];
  };
  validation: { state: 'not_validated' | 'passed' | 'failed'; errors: ApiError[]; validatedAt: string | null };
  rightsAttestation: { status: 'missing' | 'active' | 'blocked'; attestedAt: string | null; statementVersion: number | null };
}

export async function getAssetView(ctx: AppContext, actor: Actor, assetId: string): Promise<ServiceResult<AssetView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));

  // P1.1: doc tep la mot lan truy cap => moc 30 ngay tinh lai tu day.
  await ctx.persistence.sourceFiles.touchAccess(actor.workspace.id, record.id, ctx.now().toISOString());

  const validation = await ctx.persistence.validations.findLatest(actor.workspace.id, assetId);
  const attestation = await ctx.persistence.attestations.findLatest(actor.workspace.id, assetId);
  const attestationMatchesFile = attestation !== null && attestation.sourceFileId === record.id;

  return ok({
    asset,
    sourceFile: {
      id: record.id,
      originalFilename: record.originalFilename,
      declaredMimeType: record.declaredMimeType,
      declaredByteSize: record.declaredByteSize,
      uploadState: record.uploadState,
      measured: record.measured,
    },
    validation: {
      state: validation?.state ?? 'not_validated',
      errors: validation?.errors ?? [],
      validatedAt: validation?.validatedAt ?? null,
    },
    rightsAttestation: {
      status: !attestationMatchesFile || !attestation ? 'missing' : attestation.status === 'blocked' ? 'blocked' : 'active',
      attestedAt: attestationMatchesFile && attestation ? attestation.attestedAt : null,
      statementVersion: attestationMatchesFile && attestation ? attestation.statementVersion : null,
    },
  });
}

export async function listAssets(
  ctx: AppContext,
  actor: Actor,
  projectId: string,
  query?: PageQuery,
): Promise<ServiceResult<Page<Asset>>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: projectId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const project = await ctx.persistence.projects.findById(actor.workspace.id, projectId);
  if (!project) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'project' }));
  return ok(await ctx.persistence.assets.listByProject(actor.workspace.id, projectId, query));
}

export async function createAssetDownloadUrl(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<{ url: string; expiresAt: string }>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!record || record.uploadState !== 'stored') {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
  }
  await ctx.persistence.sourceFiles.touchAccess(actor.workspace.id, record.id, ctx.now().toISOString());
  const signed = await ctx.storage.createDownloadUrl(
    { bucket: ctx.bucket, key: record.storageKey },
    ctx.config.downloadUrlTtlSeconds,
  );
  return ok({ url: signed.url, expiresAt: signed.expiresAt });
}
