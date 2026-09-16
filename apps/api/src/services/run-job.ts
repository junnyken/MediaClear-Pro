/**
 * runJob - dua mot job tu `queued` toi `completed` (P2-MCP-27).
 *
 * Truoc muc nay, MOI job deu dung o `queued`: khong co duong nao goi provider, va cung khong co
 * cho luu ket qua. Day la duong do.
 *
 * Tach thanh ham RIENG (khong nhet vao route) vi worker cua `P2-MCP-28` se goi dung ham nay.
 * Neu viet thang trong route thi worker se phai chep lai logic, roi hai ban troi khac nhau.
 *
 * Thu tu BAT BUOC, khong duoc doi:
 *   queued -> processing -> (xu ly) -> luu ket qua -> DO LAI ket qua -> completed -> tinh muc dung
 * Do lai truoc khi bao xong la bat bien I-2: khong bao gio noi "da xong" ve mot thu chua kiem.
 */
import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  apiError,
  canTransition,
  storageKeyFor,
  type ApiError,
  type CleanupOperation,
  type ProcessingJob,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { DeterministicImageProvider } from '../providers/deterministic-image.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';

/** Toan bo anh - dung khi nguoi dung khong chon vung nao. */
const WHOLE_IMAGE = { x: 0, y: 0, width: 1, height: 1, startSeconds: null, endSeconds: null };

export interface RunJobOutcome {
  jobId: string;
  state: ProcessingJob['state'];
  outputAssetId: string | null;
  /** null khi chay xong tot. */
  error: ApiError | null;
}

/**
 * Chon MOT thao tac de thuc hien. Job co the mang nhieu thao tac, nhung ban tat dinh chi lam
 * duoc mot phep tren mot luot - nen lay thao tac DAU TIEN ma provider lam duoc.
 * Khong lam duoc cai nao => bao ro thay vi im lang chay mot phep khac.
 */
function pickOperation(
  provider: DeterministicImageProvider,
  job: ProcessingJob,
): CleanupOperation | null {
  return job.request.operations.find((op) => provider.supports(op, job.mediaType)) ?? null;
}

export async function runJob(ctx: AppContext, workspaceId: string, jobId: string): Promise<RunJobOutcome> {
  const job = await ctx.persistence.jobs.findById(workspaceId, jobId);
  if (!job) {
    return { jobId, state: 'failed', outputAssetId: null, error: apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND) };
  }
  // `blocked` la terminal (D-005): go nguyen nhan chan = tao job MOI, khong hoi sinh job cu.
  if (!canTransition(job.state, 'processing').allowed) {
    return {
      jobId,
      state: job.state,
      outputAssetId: job.outputAssetId,
      error: apiError(ERROR_CODES.MCP_STATE_INVALID_TRANSITION, { from: job.state, to: 'processing' }),
    };
  }

  const provider = ctx.providers.get('deterministic-image');
  if (!(provider instanceof DeterministicImageProvider)) {
    return { jobId, state: job.state, outputAssetId: null, error: apiError(ERROR_CODES.MCP_PROVIDER_NOT_PRODUCTION) };
  }
  const operation = pickOperation(provider, job);
  if (!operation) {
    return await failJob(ctx, job, apiError(ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNSUPPORTED, {
      operations: job.request.operations.join(','),
      mediaType: job.mediaType,
    }));
  }

  const now = () => ctx.now().toISOString();
  let current: ProcessingJob = { ...job, state: 'processing', updatedAt: now(), attemptCount: job.attemptCount + 1 };
  await ctx.persistence.jobs.update(current);

  try {
    const source = await ctx.persistence.sourceFiles.findById(workspaceId, job.sourceFileId);
    if (!source || source.uploadState !== 'stored') {
      return await failJob(ctx, current, apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
    }

    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: source.storageKey });
    const regions = job.request.regions.length > 0 ? job.request.regions : [WHOLE_IMAGE];
    const processed = await provider.process(bytes, operation, regions);

    // Ket qua LUON la mot object MOI, khoa khac han tep goc (bat bien I-1).
    const outputId = newId('out');
    const outputKey = storageKeyFor(workspaceId, 'output', outputId, '.png');
    await ctx.storage.putObject({ bucket: ctx.bucket, key: outputKey }, processed.bytes, processed.mimeType);

    const output = await ctx.persistence.outputs.create({
      id: outputId,
      workspaceId,
      jobId: job.id,
      sourceAssetId: job.assetId,
      storageKey: outputKey,
      mimeType: processed.mimeType,
      byteSize: processed.byteSize,
      checksumSha256: processed.checksumSha256,
      // CHUA kiem => false. Chi dat true sau khi doc lai byte o duoi.
      validated: false,
      createdAt: now(),
    });

    /*
     * Bat bien I-2: DOC LAI byte da ghi va do lai checksum.
     * Khong tin vao ket qua cua buoc ghi - neu tang luu tru hong nua chung thi day la cho
     * duy nhat phat hien ra, truoc khi noi voi nguoi dung rang da xong.
     */
    const readBack = await ctx.storage.getObject({ bucket: ctx.bucket, key: outputKey });
    const actual = createHash('sha256').update(Buffer.from(readBack)).digest('hex');
    if (actual !== processed.checksumSha256 || readBack.byteLength !== processed.byteSize) {
      return await failJob(ctx, current, apiError(ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED));
    }
    await ctx.persistence.outputs.markValidated(workspaceId, output.id);

    current = { ...current, state: 'completed', outputAssetId: output.id, updatedAt: now() };
    await ctx.persistence.jobs.update(current);

    // Tinh muc dung SAU KHI da xong va da kiem. Khoa idempotency chan tinh hai lan.
    await commitUsage(ctx, current);

    await recordAudit(ctx.persistence, {
      workspaceId,
      actorUserId: null,
      eventType: AUDIT_EVENTS.PROCESSING_JOB_COMPLETED,
      subjectType: 'job',
      subjectId: job.id,
      detail: {
        operation,
        outputAssetId: output.id,
        byteSize: processed.byteSize,
        widthPx: processed.widthPx,
        heightPx: processed.heightPx,
      },
    });

    return { jobId: job.id, state: 'completed', outputAssetId: output.id, error: null };
  } catch (error) {
    const code = error instanceof Error && (Object.values(ERROR_CODES) as string[]).includes(error.message)
      ? (error.message as keyof typeof ERROR_CODES)
      : ERROR_CODES.MCP_PROVIDER_SUBMIT_FAILED;
    return await failJob(ctx, current, apiError(code));
  }
}

/** Dua job ve `failed` va HOAN TRA khoan giu muc dung - khong tinh tien cho viec khong ra ket qua. */
async function failJob(ctx: AppContext, job: ProcessingJob, error: ApiError): Promise<RunJobOutcome> {
  const now = ctx.now().toISOString();
  const failed: ProcessingJob = { ...job, state: 'failed', reasonCode: error.code, updatedAt: now };
  if (canTransition(job.state, 'failed').allowed) {
    await ctx.persistence.jobs.update(failed);
  }
  await releaseUsage(ctx, job, error.code);
  await recordAudit(ctx.persistence, {
    workspaceId: job.workspaceId,
    actorUserId: null,
    eventType: AUDIT_EVENTS.PROCESSING_JOB_FAILED,
    subjectType: 'job',
    subjectId: job.id,
    detail: { reasonCode: error.code },
  });
  return { jobId: job.id, state: 'failed', outputAssetId: null, error };
}

async function commitUsage(ctx: AppContext, job: ProcessingJob): Promise<void> {
  const entries = await ctx.persistence.usage.listByWorkspace(job.workspaceId);
  const reserve = entries.find((e) => e.jobId === job.id && e.entryType === 'reserve');
  if (!reserve) return;
  if (entries.some((e) => e.jobId === job.id && e.entryType === 'commit')) return;
  try {
    await ctx.persistence.usage.append({
      id: newId('usg'),
      workspaceId: job.workspaceId,
      jobId: job.id,
      unitType: reserve.unitType,
      quantity: reserve.quantity,
      entryType: 'commit',
      reasonCode: null,
      // Khoa nay la thu chan tinh tien hai lan o tang du lieu.
      idempotencyKey: `${job.id}:commit`,
      recordedAt: ctx.now().toISOString(),
      expiresAt: null,
    });
  } catch {
    // Khoa idempotency da ton tai => da tinh roi. Khong phai loi.
  }
}

async function releaseUsage(ctx: AppContext, job: ProcessingJob, reasonCode: string): Promise<void> {
  const entries = await ctx.persistence.usage.listByWorkspace(job.workspaceId);
  const reserve = entries.find((e) => e.jobId === job.id && e.entryType === 'reserve');
  if (!reserve) return;
  if (entries.some((e) => e.jobId === job.id && e.entryType === 'release')) return;
  try {
    await ctx.persistence.usage.append({
      id: newId('usg'),
      workspaceId: job.workspaceId,
      jobId: job.id,
      unitType: reserve.unitType,
      quantity: reserve.quantity,
      entryType: 'release',
      reasonCode,
      idempotencyKey: `${job.id}:release`,
      recordedAt: ctx.now().toISOString(),
      expiresAt: null,
    });
  } catch {
    // Da hoan tra roi.
  }
}
