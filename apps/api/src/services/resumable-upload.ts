/**
 * Tai len noi lai duoc (P2-MCP-35).
 *
 * Truoc muc nay mot luot tai len la MOT request `PUT` duy nhat. Mat ket noi giua chung la mat
 * toan bo va phai lam lai tu dau - voi tran 199 MB tren duong truyen keu thi do la chuyen xay ra
 * thuong xuyen, khong phai ca hiem.
 *
 * Cach lam: manh duoc ghi vao lop `staging` (thu TAM, ghi de duoc, bi xoa sau khi ghep). Chi ban
 * DA GHEP, DA DO va DA KIEM moi duoc ghi vao khoa `source` - va khoa do van bat bien nhu cu (I-1).
 *
 * `receivedChunks` la thu DUY NHAT cho phep noi lai: khong co no thi client khong biet tai tiep
 * tu dau, va "noi lai duoc" chi la mot cai ten.
 */
import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  MAX_FILE_SIZE_BYTES,
  apiError,
  storageKeyFor,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';
import type { UploadSessionRecord } from '../persistence/types.js';
import { bufferSource } from '../media/byte-source.js';

/** 8 MB: du lon de khong phai goi qua nhieu lan, du nho de mat mot manh khong dau. */
export const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;

/** Phien bo do khong duoc giu manh mai mai. */
export const UPLOAD_SESSION_TTL_SECONDS = 24 * 60 * 60;

export interface UploadSessionView {
  uploadSessionId: string;
  assetId: string;
  sourceFileId: string;
  chunkSizeBytes: number;
  totalChunks: number;
  /** Chi so cac manh DA nhan - client doc cai nay de biet tai tiep tu dau. */
  receivedChunks: number[];
  declaredByteSize: number;
  state: UploadSessionRecord['state'];
  expiresAt: string;
}

function viewOf(session: UploadSessionRecord): UploadSessionView {
  return {
    uploadSessionId: session.id,
    assetId: session.assetId,
    sourceFileId: session.sourceFileId,
    chunkSizeBytes: session.chunkSizeBytes,
    totalChunks: session.totalChunks,
    receivedChunks: session.receivedChunks,
    declaredByteSize: session.declaredByteSize,
    state: session.state,
    expiresAt: session.expiresAt,
  };
}

/** Khoa cua mot manh. Lop `staging` => ghi de duoc, va khong bao gio bi nham voi tep goc. */
function chunkKey(session: UploadSessionRecord, index: number): string {
  return storageKeyFor(session.workspaceId, 'staging', `${session.id}_${String(index).padStart(5, '0')}`, '.part');
}

export function totalChunksFor(byteSize: number, chunkSizeBytes: number): number {
  return Math.ceil(byteSize / chunkSizeBytes);
}

/** Mo phien cho mot tep nguon DA duoc tao boi `createUploadIntent`. */
export async function openUploadSession(
  ctx: AppContext,
  actor: Actor,
  sourceFileId: string,
  chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES,
): Promise<ServiceResult<UploadSessionView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: sourceFileId,
    permission: 'asset.upload',
  });
  if (!allowed.ok) return fail(allowed.error);

  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));
  if (record.uploadState === 'stored') {
    // I-1: tep goc da co byte thi khong mo lai luot tai nao nua.
    return fail(apiError(ERROR_CODES.MCP_STORAGE_WRITE_DENIED, { reason: 'source_immutable' }));
  }
  if (!Number.isInteger(chunkSizeBytes) || chunkSizeBytes <= 0 || chunkSizeBytes > MAX_FILE_SIZE_BYTES) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'chunkSizeBytes' }));
  }

  // Mo lai phien da co => tra nguyen trang thai hien tai, KHONG tao phien moi va khong xoa manh.
  const existing = await ctx.persistence.uploadSessions.findBySourceFile(actor.workspace.id, sourceFileId);
  if (existing) return ok(viewOf(existing));

  const now = ctx.now();
  const session: UploadSessionRecord = {
    id: `ups_${createHash('sha256').update(`${sourceFileId}:${now.getTime()}`).digest('hex').slice(0, 32)}`,
    workspaceId: actor.workspace.id,
    projectId: record.projectId,
    assetId: record.assetId,
    sourceFileId,
    storageKey: record.storageKey,
    contentType: record.declaredMimeType,
    declaredByteSize: record.declaredByteSize,
    chunkSizeBytes,
    totalChunks: totalChunksFor(record.declaredByteSize, chunkSizeBytes),
    receivedChunks: [],
    state: 'open',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + UPLOAD_SESSION_TTL_SECONDS * 1000).toISOString(),
  };
  await ctx.persistence.uploadSessions.create(session);
  return ok(viewOf(session));
}

async function loadOpenSession(
  ctx: AppContext,
  actor: Actor,
  sessionId: string,
): Promise<ServiceResult<UploadSessionRecord>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: sessionId,
    permission: 'asset.upload',
  });
  if (!allowed.ok) return fail(allowed.error);

  const session = await ctx.persistence.uploadSessions.findById(actor.workspace.id, sessionId);
  if (!session) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'upload_session' }));
  if (session.state !== 'open') {
    return fail(apiError(ERROR_CODES.MCP_STATE_TERMINAL, { state: session.state }));
  }
  if (new Date(session.expiresAt).getTime() <= ctx.now().getTime()) {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_TICKET_INVALID, { reason: 'session_expired' }));
  }
  return ok(session);
}

/** Doc trang thai de biet tai tiep tu dau. */
export async function getUploadSession(
  ctx: AppContext,
  actor: Actor,
  sessionId: string,
): Promise<ServiceResult<UploadSessionView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: sessionId,
    permission: 'asset.upload',
  });
  if (!allowed.ok) return fail(allowed.error);
  const session = await ctx.persistence.uploadSessions.findById(actor.workspace.id, sessionId);
  if (!session) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'upload_session' }));
  return ok(viewOf(session));
}

export async function putUploadChunk(
  ctx: AppContext,
  actor: Actor,
  sessionId: string,
  chunkIndex: number,
  body: Buffer,
): Promise<ServiceResult<UploadSessionView>> {
  const found = await loadOpenSession(ctx, actor, sessionId);
  if (!found.ok) return fail(found.error);
  const session = found.data;

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'chunkIndex' }));
  }
  if (body.byteLength <= 0) return fail(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));

  /*
   * Kich thuoc manh phai DUNG: moi manh bang `chunkSizeBytes`, rieng manh CUOI la phan du. Neu
   * khong kiem, mot manh thieu byte se lam tep ghep ra sai ma khong cho nao phat hien - va no
   * chi lo ra o buoc do lai cuoi cung, luc da ton cong tai het moi thu.
   */
  const isLast = chunkIndex === session.totalChunks - 1;
  const expected = isLast
    ? session.declaredByteSize - session.chunkSizeBytes * (session.totalChunks - 1)
    : session.chunkSizeBytes;
  if (body.byteLength !== expected) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'chunkSize' }));
  }

  await ctx.storage.putObject({ bucket: ctx.bucket, key: chunkKey(session, chunkIndex) }, body, 'application/octet-stream');
  const updated = await ctx.persistence.uploadSessions.recordChunk(actor.workspace.id, sessionId, chunkIndex);
  return ok(viewOf(updated));
}

export interface CompletedUpload {
  assetId: string;
  sourceFileId: string;
  byteSize: number;
  checksumSha256: string;
}

export async function completeUploadSession(
  ctx: AppContext,
  actor: Actor,
  sessionId: string,
): Promise<ServiceResult<CompletedUpload>> {
  const found = await loadOpenSession(ctx, actor, sessionId);
  if (!found.ok) return fail(found.error);
  const session = found.data;

  // Thieu manh thi noi RO thieu manh nao, khong bao mot loi chung chung.
  const missing: number[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    if (!session.receivedChunks.includes(i)) missing.push(i);
  }
  if (missing.length > 0) {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, {
      reason: 'missing_chunks',
      missing: missing.slice(0, 10).join(','),
    }));
  }

  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, session.sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));
  if (record.uploadState === 'stored') {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_WRITE_DENIED, { reason: 'source_immutable' }));
  }

  const parts: Buffer[] = [];
  for (let i = 0; i < session.totalChunks; i++) {
    parts.push(Buffer.from(await ctx.storage.getObject({ bucket: ctx.bucket, key: chunkKey(session, i) })));
  }
  const body = Buffer.concat(parts);

  /*
   * Do lai TONG so byte truoc khi ghi. Client khai truoc kich thuoc; neu tong cac manh khong
   * khop so da khai thi co gi do sai, va ghi bua vao khoa `source` la khong sua duoc (I-1).
   */
  if (body.byteLength !== session.declaredByteSize) {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, { reason: 'size_mismatch' }));
  }

  await ctx.storage.putObject({ bucket: ctx.bucket, key: session.storageKey }, body, session.contentType);

  const probe = await ctx.probe.probe(bufferSource(body));
  const checksum = createHash('sha256').update(body).digest('hex');
  await ctx.persistence.sourceFiles.markStored(actor.workspace.id, session.sourceFileId, {
    measured: {
      /*
       * Giu nguyen quy uoc cua duong tai len mot lan: MIME lay tu magic bytes, khong nhan dang
       * duoc thi GIU NGUYEN khai bao cua client de buoc validate bat loi - khong tu "sua" gium.
       */
      mimeType: probe.detectedMimeType ?? record.declaredMimeType,
      byteSize: body.byteLength,
      checksumSha256: checksum,
      mediaType: probe.mediaType ?? record.declaredMediaType,
      durationSeconds: probe.durationSeconds,
      widthPx: probe.widthPx,
      heightPx: probe.heightPx,
      hasAudioStream: probe.hasAudioStream,
      corrupt: probe.corrupt,
    },
    uploadedAt: ctx.now().toISOString(),
  });
  await ctx.persistence.uploadSessions.setState(actor.workspace.id, sessionId, 'completed');

  /*
   * Xoa manh SAU KHI da ghi va da danh dau xong. Xoa truoc thi mot su co giua chung se lam mat
   * ca manh lan tep goc - khong con gi de thu lai.
   */
  for (let i = 0; i < session.totalChunks; i++) {
    try {
      await ctx.storage.deleteObject({ bucket: ctx.bucket, key: chunkKey(session, i) });
    } catch {
      // Khong xoa duoc manh KHONG phai ly do de bao luot tai len that bai. Manh thua se het han.
    }
  }

  return ok({
    assetId: session.assetId,
    sourceFileId: session.sourceFileId,
    byteSize: body.byteLength,
    checksumSha256: checksum,
  });
}
