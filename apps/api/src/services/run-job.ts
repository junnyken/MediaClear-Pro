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
  INVISIBLE_WATERMARK_DISCLAIMER_KEY,
  PRESERVATION_DEFAULTS,
  apiError,
  canTransition,
  evaluatePreservation,
  storageKeyFor,
  type ApiError,
  type CleanupOperation,
  type ProcessingJob,
  type ProvenanceProbe,
  type ProvenanceRecord,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { DeterministicImageProvider } from '../providers/deterministic-image.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { probeProvenance } from '../media/provenance-probe.js';

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

/**
 * Chay mot job theo id: tu tim, tu chuyen sang `processing`, roi thuc hien.
 * Dung cho duong goi TAY (route noi bo). Worker khong di duong nay - no NHAN job truoc
 * bang `claimQueued` roi goi thang `executeClaimedJob`.
 */
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
  const claimed: ProcessingJob = {
    ...job,
    state: 'processing',
    attemptCount: job.attemptCount + 1,
    updatedAt: ctx.now().toISOString(),
  };
  await ctx.persistence.jobs.update(claimed);
  return executeClaimedJob(ctx, claimed);
}

/**
 * Thuc hien mot job DA o trang thai `processing`.
 *
 * Tach ra de worker (P2-MCP-28) va route noi bo dung CHUNG dung mot ban logic. Neu de worker
 * tu viet lai, hai ban se troi khac nhau - va cho troi se la cho tinh muc dung hoac cho kiem
 * ket qua, tuc la cho dat nhat de sai.
 */
export async function executeClaimedJob(ctx: AppContext, job: ProcessingJob): Promise<RunJobOutcome> {
  const workspaceId = job.workspaceId;
  const jobId = job.id;

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
  let current: ProcessingJob = job;

  try {
    const source = await ctx.persistence.sourceFiles.findById(workspaceId, job.sourceFileId);
    if (!source || source.uploadState !== 'stored') {
      return await failJob(ctx, current, apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
    }

    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: source.storageKey });

    /*
     * P2-MCP-30: do dau vet nguon goc TRUOC khi dong vao byte. Do sau khi xu ly thi khong con
     * gi de so sanh - va mot bien nhan khong co so do truoc thi khong chung minh duoc dieu gi.
     */
    const probeBefore = await probeProvenance(bytes, job.mediaType);

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

    /*
     * Do LAI tren chinh byte vua doc ve tu kho, khong phai tren buffer con trong bo nho: bien
     * nhan phai noi ve tep NGUOI DUNG SE NHAN, khong phai tep he thong dinh ghi.
     */
    const probeAfter = await probeProvenance(readBack, job.mediaType);
    const receiptId = await writeReceipt(ctx, current, operation, output.id, probeBefore, probeAfter);

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
        receiptId,
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

/**
 * Ghi hai ban ghi do va mot bien nhan (P2-MCP-30).
 *
 * `evidenceStatus` KHONG do ham nay tu dat - no den tu `evaluatePreservation()` cua hop dong,
 * va sau D-044 ham do tra 'unknown' khi phep do khong chay duoc. He thong chua co bo doc C2PA
 * (Q-12), nen tren thuc te bien nhan hien noi "chua do duoc dau vet AI" - dung su that.
 */
async function writeReceipt(
  ctx: AppContext,
  job: ProcessingJob,
  operation: CleanupOperation,
  outputAssetId: string,
  probeBefore: ProvenanceProbe,
  probeAfter: ProvenanceProbe,
): Promise<string> {
  const now = ctx.now().toISOString();
  const outcome = evaluatePreservation(probeBefore, probeAfter, true);

  const record = async (probe: ProvenanceProbe): Promise<ProvenanceRecord> =>
    ctx.persistence.provenance.create({
      id: newId('prv'),
      workspaceId: job.workspaceId,
      originalMetadataPresence: probe.originalMetadataPresence,
      aiProvenancePresence: probe.aiProvenancePresence,
      preservationRequested: PRESERVATION_DEFAULTS.preserveOriginalMetadata,
      preservationAttempted: true,
      preservationResult: outcome.result,
      limitationNote: probe.detectorLimitationNote,
      evidenceStatus: outcome.evidenceStatus,
      recordedAt: now,
    });

  const before = await record(probeBefore);
  const after = await record(probeAfter);

  const receipt = await ctx.persistence.receipts.create({
    id: newId('rcp'),
    workspaceId: job.workspaceId,
    jobId: job.id,
    sourceAssetId: job.assetId,
    outputAssetId,
    operations: [operation],
    // Ban tat dinh chay TRONG tien trinh nay, khong goi provider ngoai nao => khong co run id.
    providerRunIds: [],
    provenanceBeforeId: before.id,
    provenanceAfterId: after.id,
    invisibleWatermarkDisclaimerKey: INVISIBLE_WATERMARK_DISCLAIMER_KEY,
    evidenceStatus: outcome.evidenceStatus,
    createdAt: now,
  });
  return receipt.id;
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
