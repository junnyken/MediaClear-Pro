/**
 * Processing job boundary (MCP-14 Phase 1).
 *
 * Thu tu cong CO DINH - day la mot phan cua contract, khong phai chi tiet noi bo:
 *   1. quyen (tenancy -> role)      : khong lo su ton tai tai nguyen
 *   2. media validation             : phai da chay va da dat
 *   3. rights attestation + policy  : evaluateProcessingPolicy() cua Phase 0
 *   4. provider capability          : chua co bang chung => 'unknown', khong bia
 *   5. usage reserve                : dung mot lan cho moi job
 *
 * Phase 1 KHONG co provider production => khong job nao duoc 'completed'.
 */
import {
  ALLOWED_TRANSITIONS,
  CLEANUP_OPERATIONS,
  ERROR_CODES,
  apiError,
  blockReasonKindFor,
  canReserveUsage,
  canTransition,
  capabilityEvidence,
  computeUsageQuantity,
  evaluateProcessingPolicy,
  requiresProvider,
  reservationExpiresAt,
  reservationViewOf,
  type ApiError,
  type AttestationSnapshot,
  type CleanupOperation,
  type EvidenceStatus,
  type JobState,
  type NormalizedRegion,
  type ProcessingJob,
  type UsageLedgerEntry,
} from '@mediaclear/contracts';
import type { ProcessingJobRequest } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

const MAX_OPERATIONS = 8;
const MAX_REGIONS = 32;
const MAX_IDEMPOTENCY_KEY_LENGTH = 200;

export interface CreateJobInput {
  operations: unknown;
  regions: unknown;
  presetId: unknown;
  branding?: unknown;
  idempotencyKey: unknown;
}

export interface JobView {
  job: ProcessingJob;
  /** Bang chung ve nang luc provider cho cac operation cua job nay. */
  providerCapability: EvidenceStatus;
  /** Luon false trong Phase 1. UI phai noi thang dieu nay. */
  productionProcessingEnabled: false;
  usage: {
    unitType: UsageLedgerEntry['unitType'];
    quantity: number;
    /** P1.1: trang thai cua RESERVATION, khac han state cua job. */
    state: 'reserved' | 'expired' | 'released' | 'committed' | 'none';
    /** P1.1: han giu muc dung. null = but toan cu chua co han. */
    expiresAt: string | null;
  };
}

interface ParsedRequest {
  operations: CleanupOperation[];
  regions: NormalizedRegion[];
  presetId: string | null;
  branding: ProcessingJobRequest['branding'];
  idempotencyKey: string;
}

/**
 * `D-077` — doc lua chon lop phu. `null` la MAC DINH va la cho an toan.
 *
 * Moi duong sai deu tra `null`, KHONG tra mot doi tuong mot nua: mot yeu cau hong khong duoc bien
 * thanh "ap dung lop phu" — he thong khong bao gio duoc dan gi ma nguoi dung khong chon.
 * Kiem quyen doc bo nhan dien va su ton tai cua phien ban nam o tang xu ly, khong phai o day.
 */
function parseBranding(input: unknown): ProcessingJobRequest['branding'] {
  if (typeof input !== 'object' || input === null) return null;
  const b = input as Record<string, unknown>;
  if (typeof b.brandKitId !== 'string' || b.brandKitId.length === 0) return null;
  if (!Number.isInteger(b.brandKitVersion) || (b.brandKitVersion as number) < 1) return null;
  const applyLogo = b.applyLogo === true;
  const applyDisclosure = b.applyDisclosure === true;
  // Khong chon gi ca thi khong co lop phu — khong luu mot ban ghi rong.
  if (!applyLogo && !applyDisclosure) return null;
  return {
    brandKitId: b.brandKitId,
    brandKitVersion: b.brandKitVersion as number,
    applyLogo, applyDisclosure,
  };
}

function parseRequest(input: CreateJobInput): ParsedRequest | ApiError {
  const invalid = (field: string) => apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field });

  if (!Array.isArray(input.operations) || input.operations.length === 0 || input.operations.length > MAX_OPERATIONS) {
    return invalid('operations');
  }
  const operations: CleanupOperation[] = [];
  for (const raw of input.operations) {
    if (typeof raw !== 'string' || !(CLEANUP_OPERATIONS as readonly string[]).includes(raw)) return invalid('operations');
    operations.push(raw as CleanupOperation);
  }

  const rawRegions = input.regions ?? [];
  if (!Array.isArray(rawRegions) || rawRegions.length > MAX_REGIONS) return invalid('regions');
  const regions: NormalizedRegion[] = [];
  for (const raw of rawRegions) {
    if (typeof raw !== 'object' || raw === null) return invalid('regions');
    const r = raw as Record<string, unknown>;
    const nums = ['x', 'y', 'width', 'height'].map((k) => r[k]);
    if (nums.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) return invalid('regions');
    regions.push({
      x: r.x as number,
      y: r.y as number,
      width: r.width as number,
      height: r.height as number,
      startSeconds: typeof r.startSeconds === 'number' ? r.startSeconds : null,
      endSeconds: typeof r.endSeconds === 'number' ? r.endSeconds : null,
    });
  }

  if (
    typeof input.idempotencyKey !== 'string' ||
    input.idempotencyKey.trim().length === 0 ||
    input.idempotencyKey.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    return invalid('idempotencyKey');
  }

  return {
    operations,
    regions,
    presetId: typeof input.presetId === 'string' ? input.presetId : null,
    branding: parseBranding(input.branding),
    idempotencyKey: input.idempotencyKey.trim(),
  };
}

function sameOperations(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
}

/** Ap dung transition qua state machine cua Phase 0. Khong tu doi state bang tay. */
function advance(job: ProcessingJob, to: JobState, now: string): ProcessingJob | ApiError {
  const check = canTransition(job.state, to);
  if (!check.allowed) return check.error ?? apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { to });
  return { ...job, state: to, updatedAt: now };
}

export async function createJob(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
  input: CreateJobInput,
): Promise<ServiceResult<JobView>> {
  const parsed = parseRequest(input);
  if ('code' in parsed) return fail(parsed);

  // --- Cong 1: quyen ---
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'job',
    resourceId: assetId,
    permission: 'job.create',
  });
  if (!allowed.ok) return fail(allowed.error);

  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));

  // --- Idempotency: gui lai cung khoa => tra job cu, KHONG reserve them ---
  const existing = await ctx.persistence.jobs.findByIdempotencyKey(actor.workspace.id, parsed.idempotencyKey);
  if (existing) {
    if (existing.assetId !== assetId || !sameOperations(existing.request.operations, parsed.operations)) {
      return fail(apiError(ERROR_CODES.MCP_JOB_IDEMPOTENCY_CONFLICT, { jobId: existing.id }));
    }
    return ok(await viewOf(ctx, actor, existing));
  }

  const now = ctx.now().toISOString();
  const baseJob: ProcessingJob = {
    id: newId('job'),
    workspaceId: actor.workspace.id,
    projectId: asset.projectId,
    assetId,
    sourceFileId: record.id,
    mediaType: asset.mediaType,
    state: 'uploaded',
    request: {
      operations: parsed.operations,
      // P2-MCP-27: LUU vung nguoi dung chon. Truoc day kiem xong roi vut di.
      regions: parsed.regions,
      preserveOriginalMetadata: true,
      preserveAiProvenance: true,
      presetId: parsed.presetId,
      branding: parsed.branding,
    },
    outputAssetId: null,
    reasonCode: null,
    blockReasonKind: null,
    idempotencyKey: parsed.idempotencyKey,
    attemptCount: 1,
    createdAt: now,
    updatedAt: now,
  };

  // --- Cong 2: media validation (phai chay TRUOC moi ranh gioi xu ly) ---
  const validation = await ctx.persistence.validations.findLatest(actor.workspace.id, assetId);
  if (!validation) {
    return blockJob(ctx, actor, baseJob, apiError(ERROR_CODES.MCP_VAL_NOT_VALIDATED, { assetId }));
  }
  if (validation.state === 'failed') {
    const first = validation.errors[0] ?? apiError(ERROR_CODES.MCP_VAL_CORRUPT_MEDIA);
    return blockJob(ctx, actor, baseJob, first);
  }

  // --- Cong 3: rights attestation + policy gate cua Phase 0 ---
  const attestationRow = await ctx.persistence.attestations.findLatest(actor.workspace.id, assetId);
  const attestation: AttestationSnapshot | null = attestationRow
    ? {
        assetId: attestationRow.assetId,
        sourceFileId: attestationRow.sourceFileId,
        statementId: attestationRow.statementId,
        statementVersion: attestationRow.statementVersion,
        attestedAt: attestationRow.attestedAt,
        status: attestationRow.status,
      }
    : null;

  const policy = evaluateProcessingPolicy({
    actor: { userId: actor.user.id, workspaceId: actor.workspace.id, role: actor.role },
    assetId,
    assetWorkspaceId: asset.workspaceId,
    assetSourceFileId: record.id,
    operations: parsed.operations,
    attestation,
    mediaValid: true,
    removeProvenanceRequested: false,
    now: ctx.now(),
  });
  if (policy.decision === 'block') {
    const first = policy.errors[0] ?? apiError(ERROR_CODES.MCP_POLICY_OPERATION_NOT_PERMITTED);
    return blockJob(ctx, actor, baseJob, first);
  }

  // --- Cong 4: nang luc provider ---
  const capability = evaluateProviderCapability(ctx, parsed.operations, asset.mediaType);
  if (capability.decision === 'block') {
    return blockJob(ctx, actor, baseJob, capability.error);
  }

  // --- Cong 5: usage reserve (dung mot lan) ---
  const quantity = computeUsageQuantity({
    mediaType: asset.mediaType,
    durationSeconds: record.measured?.durationSeconds ?? null,
  });
  if (!quantity.ok) return blockJob(ctx, actor, baseJob, quantity.error);

  const ledger = await ctx.persistence.usage.listByWorkspace(actor.workspace.id);
  const reservable = canReserveUsage(baseJob.id, ledger);
  if (!reservable.allowed) {
    return fail(reservable.error ?? apiError(ERROR_CODES.MCP_USAGE_RESERVATION_CONFLICT));
  }

  // uploaded -> validating -> queued, di qua state machine that.
  const validating = advance(baseJob, 'validating', now);
  if ('code' in validating) return fail(validating);
  const queued = advance(validating, 'queued', now);
  if ('code' in queued) return fail(queued);

  await ctx.persistence.jobs.create(queued);
  const entry: UsageLedgerEntry = {
    id: newId('usg'),
    workspaceId: actor.workspace.id,
    jobId: queued.id,
    unitType: quantity.value.unitType,
    quantity: quantity.value.quantity,
    entryType: 'reserve',
    reasonCode: null,
    idempotencyKey: `${queued.id}:reserve`,
    recordedAt: now,
    // P1.1 (Q-17): moi reservation deu co han; mot cho duy nhat tinh gia tri nay.
    expiresAt: reservationExpiresAt(now),
  };
  await ctx.persistence.usage.append(entry);

  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.USAGE_RESERVED,
    subjectType: 'usage',
    subjectId: entry.id,
    detail: { jobId: queued.id, unitType: entry.unitType, quantity: entry.quantity },
  });
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.PROCESSING_JOB_CREATED,
    subjectType: 'job',
    subjectId: queued.id,
    detail: {
      assetId,
      state: queued.state,
      operations: parsed.operations.join(','),
      providerCapability: capability.evidence,
      productionProcessingEnabled: false,
    },
  });

  return ok({
    job: queued,
    providerCapability: capability.evidence,
    productionProcessingEnabled: false,
    usage: {
      unitType: entry.unitType,
      quantity: entry.quantity,
      state: 'reserved',
      // Han giu muc dung lo ra ngay tu luc tao, de nguoi dung biet minh co bao lau.
      expiresAt: entry.expiresAt,
    },
  });
}

/**
 * Phan biet hai tinh huong ma ProviderRegistry deu tra danh sach rong:
 *  - CHUA co provider production nao      => evidence 'unknown', job van duoc nhan.
 *  - CO provider nhung khong lam duoc op  => chan that su (provider_block).
 */
function evaluateProviderCapability(
  ctx: AppContext,
  operations: readonly CleanupOperation[],
  mediaType: 'image' | 'video',
): { decision: 'allow'; evidence: EvidenceStatus } | { decision: 'block'; error: ApiError; evidence: EvidenceStatus } {
  /*
   * P4 (`D-072`): `tracked_inpaint` KHONG duoc danh gia theo `ProviderRegistry`.
   *
   * Registry do chua provider XU LY (bien doi byte). Theo doi vung di chuyen la mot nang luc KHAC,
   * do `ctx.trackingProvider` phuc vu. Truoc khi tach nhanh nay, moi job `tracked_inpaint` deu bi
   * chan boi `MCP_PROVIDER_CAPABILITY_UNSUPPORTED` — dung, vi `DeterministicVideoProvider` that su
   * khong lam duoc viec do.
   *
   * Va cho nay KHONG phai cho de noi long. Bang chung tra ve la **`unknown`**, dung luat da co san
   * cua ham nay: "chua co provider production nao => evidence 'unknown', job van duoc nhan". Bo
   * tracking hien tai la ban GIA tat dinh (`isProductionProvider = false`, `Q-P4-01` con mo), nen
   * `unknown` la loi khai dung — khong bao gio duoc thanh `verified`.
   *
   * Cong chan that cua duong nay la Quality Review Gate (`P4-MCP-44`), khong phai buoc tao job.
   */
  if (operations.includes('tracked_inpaint')) {
    const trackingIsProduction = ctx.trackingProvider.isProductionProvider;
    return { decision: 'allow', evidence: trackingIsProduction ? 'verified' : 'unknown' };
  }

  const needsProvider = operations.filter((op) => requiresProvider(op));
  if (needsProvider.length === 0) {
    // crop/blur/brand_overlay: deterministic fallback, khong can provider AI.
    return { decision: 'allow', evidence: 'unconfirmed' };
  }
  const production = ctx.providers.listProduction();
  if (production.length === 0) {
    return { decision: 'allow', evidence: 'unknown' };
  }
  for (const operation of needsProvider) {
    const capable = production.some((p) => capabilityEvidence(p, operation, mediaType) === 'verified');
    if (!capable) {
      return {
        decision: 'block',
        evidence: 'blocked',
        error: apiError(ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNSUPPORTED, { operation }),
      };
    }
  }
  return { decision: 'allow', evidence: 'verified' };
}

/**
 * Tao ban ghi job o trang thai 'blocked' (terminal) de giu dau vet, KHONG reserve usage,
 * roi tra loi that ra ngoai. Go nguyen nhan chan => phai tao job MOI (D-005 / Q-08).
 */
async function blockJob(
  ctx: AppContext,
  actor: Actor,
  baseJob: ProcessingJob,
  error: ApiError,
): Promise<ServiceResult<JobView>> {
  const now = ctx.now().toISOString();
  const validating = advance(baseJob, 'validating', now);
  const blocked =
    'code' in validating
      ? null
      : advance(validating, 'blocked', now);
  if (!blocked || 'code' in blocked) return fail(error);

  const stored: ProcessingJob = {
    ...blocked,
    reasonCode: error.code,
    blockReasonKind: blockReasonKindFor(error.code),
  };
  await ctx.persistence.jobs.create(stored);
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.PROCESSING_JOB_BLOCKED,
    subjectType: 'job',
    subjectId: stored.id,
    detail: {
      assetId: stored.assetId,
      reasonCode: stored.reasonCode,
      blockReasonKind: stored.blockReasonKind,
      usageReserved: false,
    },
  });
  // Tra kem jobId de UI dan nguoi dung toi man hinh trang thai bi chan.
  return fail({ ...error, params: { ...(error.params ?? {}), jobId: stored.id } });
}

async function viewOf(ctx: AppContext, actor: Actor, job: ProcessingJob): Promise<JobView> {
  const entries = await ctx.persistence.usage.listByWorkspace(actor.workspace.id);
  const capability = evaluateProviderCapability(ctx, job.request.operations, job.mediaType);
  // Trang thai reservation SUY RA tu ledger + dong ho (khong luu cot thu hai).
  const reservation = reservationViewOf(job.id, entries, ctx.now());
  return {
    job,
    providerCapability: capability.evidence,
    productionProcessingEnabled: false,
    usage: {
      unitType: reservation?.unitType ?? 'image_unit',
      quantity: reservation?.quantity ?? 0,
      state: reservation?.state ?? 'none',
      expiresAt: reservation?.expiresAt ?? null,
    },
  };
}

export async function getJob(ctx: AppContext, actor: Actor, jobId: string): Promise<ServiceResult<JobView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'job',
    resourceId: jobId,
    permission: 'job.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const job = await ctx.persistence.jobs.findById(actor.workspace.id, jobId);
  if (!job) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job' }));
  return ok(await viewOf(ctx, actor, job));
}

export async function cancelJob(ctx: AppContext, actor: Actor, jobId: string): Promise<ServiceResult<JobView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'job',
    resourceId: jobId,
    permission: 'job.create',
  });
  if (!allowed.ok) return fail(allowed.error);

  const job = await ctx.persistence.jobs.findById(actor.workspace.id, jobId);
  if (!job) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job' }));

  const now = ctx.now().toISOString();
  const cancelled = advance(job, 'cancelled', now);
  if ('code' in cancelled) return fail(cancelled);
  await ctx.persistence.jobs.update(cancelled);

  const entries = (await ctx.persistence.usage.listByWorkspace(actor.workspace.id)).filter((e) => e.jobId === job.id);
  const reserve = entries.find((e) => e.entryType === 'reserve');
  const alreadySettled = entries.some((e) => e.entryType === 'release' || e.entryType === 'commit');
  if (reserve && !alreadySettled) {
    const release: UsageLedgerEntry = {
      id: newId('usg'),
      workspaceId: actor.workspace.id,
      jobId: job.id,
      unitType: reserve.unitType,
      quantity: reserve.quantity,
      entryType: 'release',
      reasonCode: 'cancelled',
      idempotencyKey: `${job.id}:release`,
      recordedAt: now,
      expiresAt: null,
    };
    await ctx.persistence.usage.append(release);
    await recordAudit(ctx.persistence, {
      workspaceId: actor.workspace.id,
      actorUserId: actor.user.id,
      eventType: AUDIT_EVENTS.USAGE_RELEASED,
      subjectType: 'usage',
      subjectId: release.id,
      detail: { jobId: job.id, reasonCode: 'cancelled' },
    });
  }

  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.PROCESSING_JOB_CANCELLED,
    subjectType: 'job',
    subjectId: job.id,
    detail: { previousState: job.state },
  });

  return ok(await viewOf(ctx, actor, cancelled));
}

/** Chi de tai lieu hoa: bang transition van la nguon su that duy nhat cua Phase 0. */
export const JOB_TRANSITIONS = ALLOWED_TRANSITIONS;
