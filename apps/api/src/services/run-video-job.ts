/**
 * Chay mot job VIDEO (P3-MCP-31 / 32 / 33).
 *
 * Tach khoi `run-job.ts` (duong ANH) vi mot rang buoc ma anh khong co: AUDIO. De bai Phase 3 noi
 * ro "khong xuat video neu audio bi mat ngoai y muon", nen o day audio khong phai mot truong ghi
 * cho vui — no QUYET DINH job co duoc `completed` hay khong.
 *
 * Thu tu bat buoc, khong duoc doi:
 *   processing -> do audio TRUOC -> render -> luu -> DOC LAI va do lai -> so audio SAU
 *              -> completed | review_required | failed
 *
 * `completed` la nhanh HEP NHAT: chi khi output doc lai duoc, checksum khop, VA audio dat.
 */
import { createHash } from 'node:crypto';
import {
  ERROR_CODES,
  INVISIBLE_WATERMARK_DISCLAIMER_KEY,
  PRESERVATION_DEFAULTS,
  apiError,
  audioAllowsCompletion,
  canTransition,
  compareAudio,
  findPreset,
  storageKeyFor,
  type ApiError,
  type AudioTrack,
  type CleanupOperation,
  type ProcessingJob,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { DeterministicVideoProvider, operationToMode } from '../providers/deterministic-video.js';
import { newId } from '../ids.js';
import { recordAudit, AUDIT_EVENTS } from './audit.js';

export interface VideoJobOutcome {
  jobId: string;
  state: ProcessingJob['state'];
  outputAssetId: string | null;
  receiptId: string | null;
  audioVerdict: string | null;
  error: ApiError | null;
}

function pickOperation(provider: DeterministicVideoProvider, job: ProcessingJob): CleanupOperation | null {
  return job.request.operations.find((op) => provider.supports(op, 'video')) ?? null;
}

/**
 * Chay job video DA o trang thai `processing`.
 *
 * Phan biet ro ba ket cuc khong-thanh-cong, vi chung co nghia khac nhau voi nguoi doc:
 *  - `blocked`  : phu thuoc khong san sang (thieu ffmpeg, mat tep nguon) — khong phai loi xu ly.
 *  - `failed`   : xu ly that bai THAT, ke ca truong hop audio bi MAT.
 *  - `review_required`: ra duoc ket qua nhung co canh bao (lech thoi luong tieng, khong do duoc).
 */
export async function executeVideoJob(ctx: AppContext, job: ProcessingJob): Promise<VideoJobOutcome> {
  const workspaceId = job.workspaceId;
  const now = (): string => ctx.now().toISOString();

  const provider = ctx.providers.get('deterministic-video');
  if (!(provider instanceof DeterministicVideoProvider)) {
    return blockJob(ctx, job, apiError(ERROR_CODES.MCP_PROVIDER_NOT_PRODUCTION));
  }

  /*
   * Hoi TRUOC khi lam gi: `ffmpeg` la nhi phan NGOAI. Thieu no la PHU THUOC thieu (`blocked`),
   * khong phai xu ly that bai (`failed`). Gop hai cai lam nguoi van hanh di sai huong.
   */
  if (!(await provider.ready())) {
    return blockJob(ctx, job, apiError(ERROR_CODES.MCP_PROVIDER_UNAVAILABLE, { reason: 'ffmpeg_missing' }));
  }

  const operation = pickOperation(provider, job);
  const mode = operation ? operationToMode(operation) : null;
  if (!operation || mode === null) {
    return failJob(ctx, job, apiError(ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNSUPPORTED, {
      operations: job.request.operations.join(','),
      mediaType: job.mediaType,
    }));
  }

  const source = await ctx.persistence.sourceFiles.findById(workspaceId, job.sourceFileId);
  if (!source || source.uploadState !== 'stored') {
    return blockJob(ctx, job, apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
  }

  let current: ProcessingJob = job;
  try {
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: source.storageKey });
    const inputChecksum = createHash('sha256').update(Buffer.from(bytes)).digest('hex');

    const preset = job.request.presetId ? findPreset(job.request.presetId) : null;
    const processed = await provider.process(bytes, operation, job.request.regions, {
      cropAspect: preset?.aspectRatio ?? null,
    });

    // Ket qua LUON la object MOI, khoa khac han tep goc (bat bien I-1).
    const outputId = newId('out');
    const outputKey = storageKeyFor(workspaceId, 'output', outputId, '.mp4');
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
      validated: false,
      createdAt: now(),
    });

    /*
     * Bat bien I-2: DOC LAI byte da ghi va do lai. Neu tang luu tru hong nua chung thi day la cho
     * duy nhat phat hien ra, TRUOC khi noi voi nguoi dung rang da xong.
     */
    const readBack = await ctx.storage.getObject({ bucket: ctx.bucket, key: outputKey });
    const actual = createHash('sha256').update(Buffer.from(readBack)).digest('hex');
    const outputVerified = actual === processed.checksumSha256 && readBack.byteLength === processed.byteSize;

    /*
     * So audio TREN BYTE DA DOC LAI, khong tren buffer trong bo nho: cai nguoi dung nhan duoc la
     * tep trong kho, nen phep do phai chay tren dung tep do.
     */
    const { probeVideo } = await import('../media/ffmpeg.js');
    const afterProbe = await probeVideo(readBack);
    const audioAfter: AudioTrack = afterProbe.audio;
    const verdict = compareAudio(processed.audioBefore, audioAfter);

    if (!outputVerified) {
      const receiptId = await writeVideoReceipt(ctx, job, {
        mode, presetId: job.request.presetId, inputChecksum,
        outputChecksum: actual, audioBefore: processed.audioBefore, audioAfter,
        verdict, outputVerified: false, outputAssetId: output.id,
        failureReason: ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED, reviewReason: null,
      });
      const failed = await failJob(ctx, current, apiError(ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED));
      return { ...failed, receiptId, audioVerdict: verdict };
    }

    await ctx.persistence.outputs.markValidated(workspaceId, output.id);

    /*
     * AUDIO QUYET DINH KET CUC.
     *  - `lost`: input co tieng, output khong => day la mat audio NGOAI Y MUON. De bai cam xuat
     *    video trong truong hop nay, nen job thanh `failed`, KHONG phai `completed`.
     *  - `duration_drift` / `unknown`: ra duoc ket qua nhung khong khang dinh duoc tieng con nguyen
     *    => `review_required` de nguoi that quyet.
     */
    if (verdict === 'lost') {
      const receiptId = await writeVideoReceipt(ctx, job, {
        mode, presetId: job.request.presetId, inputChecksum, outputChecksum: actual,
        audioBefore: processed.audioBefore, audioAfter, verdict, outputVerified: true,
        outputAssetId: output.id, failureReason: 'audio_lost', reviewReason: null,
      });
      const failed = await failJob(ctx, current, apiError(ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED, { reason: 'audio_lost' }));
      return { ...failed, receiptId, audioVerdict: verdict };
    }

    if (!audioAllowsCompletion(verdict)) {
      const receiptId = await writeVideoReceipt(ctx, job, {
        mode, presetId: job.request.presetId, inputChecksum, outputChecksum: actual,
        audioBefore: processed.audioBefore, audioAfter, verdict, outputVerified: true,
        outputAssetId: output.id, failureReason: null, reviewReason: `audio_${verdict}`,
      });
      current = { ...current, state: 'review_required', outputAssetId: output.id, updatedAt: now() };
      if (canTransition(job.state, 'review_required').allowed) await ctx.persistence.jobs.update(current);
      await recordAudit(ctx.persistence, {
        workspaceId, actorUserId: null, eventType: AUDIT_EVENTS.PROCESSING_JOB_REVIEW_REQUIRED,
        subjectType: 'job', subjectId: job.id, detail: { audioVerdict: verdict, outputAssetId: output.id },
      });
      return { jobId: job.id, state: 'review_required', outputAssetId: output.id, receiptId, audioVerdict: verdict, error: null };
    }

    const receiptId = await writeVideoReceipt(ctx, job, {
      mode, presetId: job.request.presetId, inputChecksum, outputChecksum: actual,
      audioBefore: processed.audioBefore, audioAfter, verdict, outputVerified: true,
      outputAssetId: output.id, failureReason: null, reviewReason: null,
    });

    current = { ...current, state: 'completed', outputAssetId: output.id, updatedAt: now() };
    await ctx.persistence.jobs.update(current);
    await commitUsage(ctx, current);
    await recordAudit(ctx.persistence, {
      workspaceId, actorUserId: null, eventType: AUDIT_EVENTS.PROCESSING_JOB_COMPLETED,
      subjectType: 'job', subjectId: job.id,
      detail: { mode, outputAssetId: output.id, receiptId, audioVerdict: verdict, byteSize: processed.byteSize },
    });
    return { jobId: job.id, state: 'completed', outputAssetId: output.id, receiptId, audioVerdict: verdict, error: null };
  } catch (error) {
    const code = error instanceof Error && (Object.values(ERROR_CODES) as string[]).includes(error.message)
      ? (error.message as keyof typeof ERROR_CODES)
      : ERROR_CODES.MCP_PROVIDER_SUBMIT_FAILED;
    const failed = await failJob(ctx, current, apiError(code));
    return { ...failed, receiptId: null, audioVerdict: null };
  }
}

interface ReceiptInput {
  mode: string;
  presetId: string | null;
  inputChecksum: string;
  outputChecksum: string;
  audioBefore: AudioTrack;
  audioAfter: AudioTrack;
  verdict: string;
  outputVerified: boolean;
  outputAssetId: string;
  failureReason: string | null;
  reviewReason: string | null;
}

/**
 * Ghi bien nhan cua luot xu ly video. `providerStatus` la `unconfirmed`: ban tat dinh chay trong
 * tien trinh nay, khong goi provider ngoai nao — va `verified` phai co bang chung, khong duoc suy ra.
 */
async function writeVideoReceipt(ctx: AppContext, job: ProcessingJob, input: ReceiptInput): Promise<string> {
  const now = ctx.now().toISOString();
  const record = async (): Promise<string> => {
    const row = await ctx.persistence.provenance.create({
      id: newId('prv'),
      workspaceId: job.workspaceId,
      /* Chua co bo doc metadata cho VIDEO (Q-P3-02) — `unknown` la su that, khong phai cho trong. */
      originalMetadataPresence: 'unknown',
      aiProvenancePresence: 'unknown',
      preservationRequested: PRESERVATION_DEFAULTS.preserveOriginalMetadata,
      preservationAttempted: true,
      preservationResult: 'unknown',
      limitationNote: 'provenance.limitation.no_video_metadata_reader',
      evidenceStatus: 'unknown',
      recordedAt: now,
    });
    return row.id;
  };
  const before = await record();
  const after = await record();

  const receipt = await ctx.persistence.receipts.create({
    id: newId('rcp'),
    workspaceId: job.workspaceId,
    jobId: job.id,
    sourceAssetId: job.assetId,
    outputAssetId: input.outputAssetId,
    operations: job.request.operations,
    providerRunIds: [],
    provenanceBeforeId: before,
    provenanceAfterId: after,
    invisibleWatermarkDisclaimerKey: INVISIBLE_WATERMARK_DISCLAIMER_KEY,
    evidenceStatus: 'unknown',
    createdAt: now,
    operationMode: input.mode,
    presetId: input.presetId,
    inputChecksum: input.inputChecksum,
    outputChecksum: input.outputChecksum,
    audioBefore: input.audioBefore,
    audioAfter: input.audioAfter,
    audioVerdict: input.verdict,
    outputVerified: input.outputVerified,
    failureReason: input.failureReason,
    reviewReason: input.reviewReason,
  });
  return receipt.id;
}

async function blockJob(ctx: AppContext, job: ProcessingJob, error: ApiError): Promise<VideoJobOutcome> {
  const now = ctx.now().toISOString();
  if (canTransition(job.state, 'blocked').allowed) {
    await ctx.persistence.jobs.update({ ...job, state: 'blocked', reasonCode: error.code, updatedAt: now });
  }
  await releaseUsage(ctx, job, error.code);
  await recordAudit(ctx.persistence, {
    workspaceId: job.workspaceId, actorUserId: null, eventType: AUDIT_EVENTS.PROCESSING_JOB_BLOCKED,
    subjectType: 'job', subjectId: job.id, detail: { reasonCode: error.code },
  });
  return { jobId: job.id, state: 'blocked', outputAssetId: null, receiptId: null, audioVerdict: null, error };
}

async function failJob(ctx: AppContext, job: ProcessingJob, error: ApiError): Promise<VideoJobOutcome> {
  const now = ctx.now().toISOString();
  if (canTransition(job.state, 'failed').allowed) {
    await ctx.persistence.jobs.update({ ...job, state: 'failed', reasonCode: error.code, updatedAt: now });
  }
  await releaseUsage(ctx, job, error.code);
  await recordAudit(ctx.persistence, {
    workspaceId: job.workspaceId, actorUserId: null, eventType: AUDIT_EVENTS.PROCESSING_JOB_FAILED,
    subjectType: 'job', subjectId: job.id, detail: { reasonCode: error.code },
  });
  return { jobId: job.id, state: 'failed', outputAssetId: null, receiptId: null, audioVerdict: null, error };
}

/** Tinh muc dung SAU KHI da xong va da kiem. Khoa idempotency chan tinh hai lan. */
async function commitUsage(ctx: AppContext, job: ProcessingJob): Promise<void> {
  const entries = await ctx.persistence.usage.listByWorkspace(job.workspaceId);
  const reserve = entries.find((e) => e.jobId === job.id && e.entryType === 'reserve');
  if (!reserve) return;
  if (entries.some((e) => e.jobId === job.id && e.entryType === 'commit')) return;
  try {
    await ctx.persistence.usage.append({
      id: newId('usg'), workspaceId: job.workspaceId, jobId: job.id,
      unitType: reserve.unitType, quantity: reserve.quantity, entryType: 'commit',
      reasonCode: null, idempotencyKey: `${job.id}:commit`,
      recordedAt: ctx.now().toISOString(), expiresAt: null,
    });
  } catch { /* da tinh roi */ }
}

/** Job khong ra ket qua thi HOAN TRA khoan giu — khong tinh tien cho viec khong co ket qua. */
async function releaseUsage(ctx: AppContext, job: ProcessingJob, reasonCode: string): Promise<void> {
  const entries = await ctx.persistence.usage.listByWorkspace(job.workspaceId);
  const reserve = entries.find((e) => e.jobId === job.id && e.entryType === 'reserve');
  if (!reserve) return;
  if (entries.some((e) => e.jobId === job.id && (e.entryType === 'release' || e.entryType === 'commit'))) return;
  try {
    await ctx.persistence.usage.append({
      id: newId('usg'), workspaceId: job.workspaceId, jobId: job.id,
      unitType: reserve.unitType, quantity: reserve.quantity, entryType: 'release',
      reasonCode, idempotencyKey: `${job.id}:release`,
      recordedAt: ctx.now().toISOString(), expiresAt: null,
    });
  } catch { /* da hoan tra roi */ }
}

