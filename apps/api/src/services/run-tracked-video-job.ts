/**
 * Workstream C — noi MCP-40…44 vao duong job THAT.
 *
 * Duong nay chay khi thao tac la `tracked_inpaint` (che do motion tracking). Truoc day thao tac do
 * roi thang vao `MCP_PROVIDER_CAPABILITY_UNSUPPORTED`.
 *
 * Thu tu BAT BUOC, khong duoc doi:
 *
 *   frame timeline (MCP-40)      <- DEM tren tep that, khong suy tu duration × fps
 *   -> motion tracking (MCP-41)
 *   -> temporal consistency (MCP-43)
 *   -> render + doc lai (I-2)
 *   -> audio verification (dung lai MCP-33)
 *   -> quality review gate (MCP-44)  <- noi DUY NHAT duoc noi `completed`
 *
 * Vi sao timeline phai chay TRUOC: `expectedFrameCount` la con so ma bat bien "khong frame nao bi
 * bo sot" so voi. Neu lay no tu ket qua tracking thi phep so sanh vo nghia.
 */
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ERROR_CODES,
  apiError,
  canTransition,
  compareAudio,
  detectFlicker,
  qualityReviewVerdict,
  storageKeyFor,
  summariseTimeline,
  type FrameState,
  type MaskBox,
  type ProcessingJob,
  type QualityGateResult,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { readFrameTimeline } from '../media/frame-timeline.js';
import { withTempDir } from '../media/ffmpeg.js';
import { maskMapOf, trackTimeline } from './frame-tracking.js';
import type { MotionTrackingProvider } from '../providers/tracking.js';
import type { JobFrameRecord } from '../persistence/types.js';

export interface TrackedJobOutcome {
  jobId: string;
  state: ProcessingJob['state'];
  outputAssetId: string | null;
  gate: QualityGateResult | null;
  error: { code: string } | null;
}

/** Vung khoi tao: vung dau tien nguoi dung chon. Khong co thi khong track duoc. */
function initialBox(job: ProcessingJob): MaskBox | null {
  const r = job.request.regions[0];
  if (!r) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

export async function executeTrackedVideoJob(
  ctx: AppContext,
  job: ProcessingJob,
  provider: MotionTrackingProvider,
): Promise<TrackedJobOutcome> {
  const workspaceId = job.workspaceId;
  const now = (): string => ctx.now().toISOString();

  const box = initialBox(job);
  if (!box) return fail(ctx, job, ERROR_CODES.MCP_VAL_REQUEST_INVALID);

  const source = await ctx.persistence.sourceFiles.findById(workspaceId, job.sourceFileId);
  if (!source || source.uploadState !== 'stored') return fail(ctx, job, ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND);

  const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: source.storageKey });

  /*
   * MCP-40 doc tu TEP tren dia (ffprobe can duong dan). Ghi ra thu muc TAM — KHONG bao gio ghi
   * de tep goc (bat bien I-1). Thu muc tam bi xoa ke ca khi loi.
   */
  const { timeline, tracking } = await withTempDir(async (dir) => {
    const path = join(dir, 'source.bin');
    await writeFile(path, bytes);
    const t = await readFrameTimeline(path);
    const r = await trackTimeline(provider, t, box);
    return { timeline: t, tracking: r };
  });

  // Luu timeline va tung frame TRUOC khi quyet dinh gi — de UI xem duoc ke ca khi job that bai.
  await ctx.persistence.jobFrames.saveTimeline({
    jobId: job.id, workspaceId,
    expectedFrameCount: timeline.expectedFrameCount,
    declaredFrameCount: timeline.declaredFrameCount,
    decodedFrameCount: timeline.decodedFrameCount,
    undecodableFrames: timeline.undecodableFrames,
    fps: timeline.fps,
    variableFrameRate: timeline.variableFrameRate,
    createdAt: now(),
  });
  const rows: JobFrameRecord[] = [...tracking.frames.values()].map((f) => ({
    jobId: job.id, workspaceId, frameIndex: f.index, state: f.state,
    box: f.box, confidence: f.confidence, source: f.source, updatedAt: now(),
  }));
  await ctx.persistence.jobFrames.replaceFrames(workspaceId, job.id, rows);

  // MCP-43 — nguong theo frame rate THAT doc tu MCP-40, khong gia dinh 30fps.
  const flicker = detectFlicker(maskMapOf(tracking), timeline.fps ?? 0);

  /*
   * Chi render khi timeline da sach. Render mot video tu mot ket qua tracking con frame hong la
   * lam ra mot tep trong nhu ket qua that — va nguoi dung se dung no.
   */
  let outputAssetId: string | null = null;
  // `null` = chua render nen chua do duoc. KHAC 'unknown' (do roi ma khong ket luan duoc).
  let audioVerdict: ReturnType<typeof compareAudio> | null = null;

  if (tracking.summary.canComplete && flicker.length === 0) {
    const { probeVideo, renderVideo } = await import('../media/ffmpeg.js');
    const beforeProbe = await probeVideo(bytes);
    const rendered = await renderVideo(bytes, { mode: 'mask', regions: job.request.regions });

    const outputId = newId('out');
    const outputKey = storageKeyFor(workspaceId, 'output', outputId, '.mp4');
    await ctx.storage.putObject({ bucket: ctx.bucket, key: outputKey }, rendered.bytes, 'video/mp4');
    const output = await ctx.persistence.outputs.create({
      id: outputId, workspaceId, jobId: job.id, sourceAssetId: job.assetId,
      storageKey: outputKey, mimeType: 'video/mp4', byteSize: rendered.byteSize,
      checksumSha256: createHash('sha256').update(Buffer.from(rendered.bytes)).digest('hex'),
      validated: false, createdAt: now(),
    });

    // Bat bien I-2: doc lai byte da ghi truoc khi noi bat cu dieu gi ve no.
    const readBack = await ctx.storage.getObject({ bucket: ctx.bucket, key: outputKey });
    const actual = createHash('sha256').update(Buffer.from(readBack)).digest('hex');
    if (actual !== output.checksumSha256 || readBack.byteLength !== output.byteSize) {
      return fail(ctx, job, ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED);
    }
    await ctx.persistence.outputs.markValidated(workspaceId, output.id);
    outputAssetId = output.id;

    // Audio: dung LAI `compareAudio` cua Phase 3, khong viet ban thu hai.
    const afterProbe = await probeVideo(readBack);
    audioVerdict = compareAudio(beforeProbe.audio, afterProbe.audio);
  }

  // MCP-44 — cong chan cuoi. Day la noi DUY NHAT duoc noi `completed`.
  const gate = qualityReviewVerdict({
    timeline: summariseTimeline(
      timeline.expectedFrameCount,
      new Map([...tracking.frames].map(([k, v]) => [k, v.state as FrameState])),
    ),
    unreviewedFlicker: flicker.length,
    audioVerdict,
  });

  const state: ProcessingJob['state'] =
    gate.verdict === 'completed' ? 'completed' : gate.verdict === 'failed' ? 'failed' : 'review_required';

  /*
   * `canTransition` ep BAT BIEN I-2 qua `TransitionContext`: khong bao gio `completed` khi chua co
   * output DA KIEM. Phai truyen ngu canh, neu khong no tu choi — dung.
   *
   * Ban dau toi quen truyen, va dong nay la `if (allowed) update(...)`: chuyen doi bi tu choi, lenh
   * cap nhat BI BO QUA IM LANG, job nam lai `processing` vinh vien trong khi ham van tra ve
   * `completed`. Do dung la loai loi ma ca Phase 4 ton tai de chan — "bao hoan tat trong khi thuc
   * te khong". Nen o day khong con `if` im lang nua: bi tu choi thi noi that.
   */
  const transition = canTransition(job.state, state, {
    outputAssetId: outputAssetId ?? undefined,
    outputValidated: outputAssetId !== null,
  });
  if (!transition.allowed) {
    return fail(ctx, job, transition.error?.code ?? ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
  }

  const next: ProcessingJob = {
    ...job, state, outputAssetId,
    reasonCode: gate.reasons[0] ?? null,
    updatedAt: now(),
  };
  await ctx.persistence.jobs.update(next);

  await recordAudit(ctx.persistence, {
    workspaceId, actorUserId: null,
    eventType: state === 'completed' ? AUDIT_EVENTS.PROCESSING_JOB_COMPLETED
      : state === 'failed' ? AUDIT_EVENTS.PROCESSING_JOB_FAILED
        : AUDIT_EVENTS.PROCESSING_JOB_REVIEW_REQUIRED,
    subjectType: 'job', subjectId: job.id,
    detail: {
      expectedFrameCount: timeline.expectedFrameCount,
      missing: gate.counts.frames_missing,
      lowConfidence: gate.counts.frames_low_confidence,
      failedFrames: gate.counts.frames_failed,
      flicker: flicker.length,
      audioVerdict,
    },
  });

  return { jobId: job.id, state, outputAssetId, gate, error: null };
}

async function fail(ctx: AppContext, job: ProcessingJob, code: string): Promise<TrackedJobOutcome> {
  const failed: ProcessingJob = { ...job, state: 'failed', reasonCode: code, updatedAt: ctx.now().toISOString() };
  if (canTransition(job.state, 'failed').allowed) await ctx.persistence.jobs.update(failed);
  await recordAudit(ctx.persistence, {
    workspaceId: job.workspaceId, actorUserId: null, eventType: AUDIT_EVENTS.PROCESSING_JOB_FAILED,
    subjectType: 'job', subjectId: job.id, detail: { reasonCode: code },
  });
  void apiError;
  return { jobId: job.id, state: 'failed', outputAssetId: null, gate: null, error: { code } };
}
