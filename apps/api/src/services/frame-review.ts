/**
 * Duong API cho MCP-42 (sua keyframe) va MCP-44 (cong chan chat luong) — phan ma giao dien doc.
 *
 * Hinh dang phan hoi lay TU `FRAME_TRACKING_VIEW_SCHEMA` cua contract, khong tu khai lai o day.
 * Do la yeu cau cua `D-047`: mot nguon su that cho ca hai ben.
 */
import {
  ERROR_CODES,
  apiError,
  detectFlicker,
  planFrameCorrection,
  qualityReviewVerdict,
  summariseTimeline,
  type FrameState,
  type MaskBox,
  type QualityGateResult,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';
import type { JobFrameCorrectionRecord, JobFrameRecord, ProcessingJob } from '../persistence/types.js';

export interface FrameTrackingResponse {
  jobId: string;
  jobState: string;
  timeline: ReturnType<typeof summariseTimeline>;
  frames: Array<{
    index: number;
    state: FrameState;
    box: MaskBox | null;
    confidence: number | null;
    source: JobFrameRecord['source'];
  }>;
  gate: QualityGateResult;
  /**
   * `D-074` — lan sua gan nhat, hoac `null` khi chua ai sua.
   *
   * Co mat trong CA phan hoi doc lan phan hoi ghi, cung mot hinh dang: giao dien khong phai doan
   * xem truong nay co hay khong tuy theo no vua goi duong nao.
   */
  lastCorrection: CorrectionSummary | null;
}

export interface CorrectionSummary {
  frameIndex: number;
  /** Chi so cac frame lan can THUC SU duoc tinh lai. */
  reinterpolated: number[];
  flickerBefore: number | null;
  flickerAfter: number | null;
  gateVerdictBefore: QualityGateResult['verdict'] | null;
  gateVerdictAfter: QualityGateResult['verdict'] | null;
  correctedAt: string;
}

function correctionSummary(record: JobFrameCorrectionRecord | undefined): CorrectionSummary | null {
  if (!record) return null;
  return {
    frameIndex: record.frameIndex,
    reinterpolated: record.reinterpolated,
    flickerBefore: record.flickerBefore,
    flickerAfter: record.flickerAfter,
    gateVerdictBefore: record.gateVerdictBefore,
    gateVerdictAfter: record.gateVerdictAfter,
    correctedAt: record.correctedAt,
  };
}

/**
 * Audio: `null` khi job CHUA co output. Khong do duoc thi cong chan khong bao gio noi `completed`.
 *
 * Tach ra thanh mot ham vi CA `buildView` lan `correctJobFrame` deu phai dung dung quy tac nay.
 * Hai noi tu viet lay se lech nhau dung o cho nguy hiem nhat (`D-047`).
 */
function audioVerdictFor(job: Pick<ProcessingJob, 'outputAssetId'>): 'preserved' | null {
  return job.outputAssetId ? 'preserved' : null;
}

/** Toa do CHUAN HOA [0,1]. Ngoai khoang la yeu cau sai, khong phai thu de tu "kep lai" cho vua. */
function validBox(box: unknown): box is MaskBox {
  if (typeof box !== 'object' || box === null) return false;
  const b = box as Record<string, unknown>;
  const nums = ['x', 'y', 'width', 'height'].map((k) => b[k]);
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return false;
  const [x, y, w, h] = nums as number[];
  if (w! <= 0 || h! <= 0) return false;
  return x! >= 0 && y! >= 0 && x! + w! <= 1 && y! + h! <= 1;
}

async function buildView(ctx: AppContext, workspaceId: string, jobId: string): Promise<FrameTrackingResponse | null> {
  const job = await ctx.persistence.jobs.findById(workspaceId, jobId);
  if (!job) return null;
  const tl = await ctx.persistence.jobFrames.findTimeline(workspaceId, jobId);
  if (!tl) return null;
  const rows = await ctx.persistence.jobFrames.listFrames(workspaceId, jobId);

  const summary = summariseTimeline(
    tl.expectedFrameCount,
    new Map(rows.map((r) => [r.frameIndex, r.state])),
  );
  const masks = new Map<number, MaskBox>();
  for (const r of rows) if (r.box) masks.set(r.frameIndex, r.box);
  const flicker = detectFlicker(masks, tl.fps ?? 0);

  /*
   * Audio: `null` khi job CHUA co output — quy tac nam o `audioVerdictFor`, dung chung voi
   * `correctJobFrame`. Khong do duoc thi cong chan khong bao gio noi `completed`. Day la cho de bi
   * cam do nhat: dien mot gia tri "tam" vao day se lam giao dien bat nut xuat trong khi chua ai
   * kiem audio.
   */
  const gate = qualityReviewVerdict({
    timeline: summary,
    unreviewedFlicker: flicker.length,
    audioVerdict: audioVerdictFor(job),
  });

  const corrections = await ctx.persistence.jobFrames.listCorrections(workspaceId, jobId);

  return {
    jobId,
    jobState: job.state,
    timeline: summary,
    frames: rows.map((r) => ({
      index: r.frameIndex, state: r.state, box: r.box, confidence: r.confidence, source: r.source,
    })),
    gate,
    lastCorrection: correctionSummary(corrections[corrections.length - 1]),
  };
}

export async function getJobFrames(
  ctx: AppContext,
  actor: Actor,
  jobId: string,
): Promise<ServiceResult<FrameTrackingResponse>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'job', resourceId: jobId, permission: 'job.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const view = await buildView(ctx, actor.workspace.id, jobId);
  if (!view) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job_frames' }));
  return ok(view);
}

/**
 * MCP-42 — nguoi that sua mask tai mot frame.
 *
 * `D-074` / `Q-P4-05`: duong nay TUNG la mot ban hien thuc thu hai, khac han `applyCorrection`.
 * No ghi `reinterpolated: []` va khong tinh lai frame lan can nao — tuc la cung mot thao tac cua
 * nguoi dung cho ra hai ket qua khac nhau tuy no di qua duong nao. Nay ca hai deu goi
 * `planFrameCorrection` cua contract, va KHONG duong nao tu tinh lay.
 *
 * Trinh tu o day co chu dinh va da tung la cho de lam sai:
 *
 *  1. Do cong chan va so doan nhay TRUOC khi sua — de ho so co ve "truoc".
 *  2. Lap ke hoach bang luat canonical.
 *  3. Do lai cong chan va doan nhay TREN KET QUA da lap — de ho so co ve "sau", va de nguoi doc
 *     thay duoc chinh lan sua nay lam tinh hinh tot len hay xau di.
 *  4. Ghi audit + moi frame bi dung toi trong MOT giao dich.
 */
export async function correctJobFrame(
  ctx: AppContext,
  actor: Actor,
  jobId: string,
  frameIndex: number,
  box: unknown,
): Promise<ServiceResult<FrameTrackingResponse>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'job', resourceId: jobId, permission: 'job.create',
  });
  if (!allowed.ok) return fail(allowed.error);

  if (!Number.isInteger(frameIndex) || frameIndex < 0) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'frameIndex' }));
  }
  if (!validBox(box)) return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'box' }));

  const workspaceId = actor.workspace.id;

  const truoc = await buildView(ctx, workspaceId, jobId);
  if (!truoc) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job_frames' }));

  const job = await ctx.persistence.jobs.findById(workspaceId, jobId);
  if (!job) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job' }));

  const rows = await ctx.persistence.jobFrames.listFrames(workspaceId, jobId);
  const timeline = await ctx.persistence.jobFrames.findTimeline(workspaceId, jobId);
  const fps = timeline?.fps ?? 0;

  // Luat canonical. Ham nay THUAN — no khong doc hay ghi gi, chi tra ve ke hoach.
  const plan = planFrameCorrection(
    rows.map((r) => ({
      index: r.frameIndex, state: r.state, box: r.box, confidence: r.confidence, source: r.source,
    })),
    frameIndex,
    box,
  );
  if (!plan) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'frame' }));

  /*
   * Do lai NGAY TREN KET QUA da lap, truoc khi ghi bat cu thu gi.
   *
   * Do sau khi ghi cung ra cung mot so, nhung do truoc cho phep ghi ca hai ve vao CUNG mot dong
   * audit — va mot dong audit chi co ve "sau" thi khong tra loi duoc cau hoi "lan sua nay lam tinh
   * hinh tot len hay xau di".
   */
  const summarySau = summariseTimeline(
    truoc.timeline.expectedFrameCount,
    new Map(plan.frames.map((f) => [f.index, f.state])),
  );
  const masksSau = new Map<number, MaskBox>();
  for (const f of plan.frames) if (f.box) masksSau.set(f.index, f.box);
  const flickerSau = detectFlicker(masksSau, fps);
  const gateSau = qualityReviewVerdict({
    timeline: summarySau,
    unreviewedFlicker: flickerSau.length,
    audioVerdict: audioVerdictFor(job),
  });

  const now = ctx.now().toISOString();
  const changed = [plan.corrected, ...plan.reinterpolated.map((r) => r.after)];

  /*
   * Ghi audit + TAT CA frame bi dung toi trong MOT giao dich.
   *
   * Truoc `D-074` day la hai lenh roi rac (`appendCorrection` roi `updateFrame`). Voi mot frame
   * thi con song duoc; voi mot frame sua + bon frame noi suy thi mot su co o giua se de lai
   * timeline nua cu nua moi — va khong phep do nao phat hien duoc.
   */
  await ctx.persistence.jobFrames.applyCorrectionAtomically({
    audit: {
      id: newId('aud'),
      jobId, workspaceId, frameIndex,
      beforeState: plan.correctedBefore.state,
      beforeSource: plan.correctedBefore.source,
      beforeBox: plan.correctedBefore.box,
      beforeConfidence: plan.correctedBefore.confidence,
      afterBox: box,
      // Danh sach THAT, lay tu ke hoach. Khong con o trong ghi san `[]`.
      reinterpolated: plan.reinterpolated.map((r) => r.after.index),
      neighbours: plan.reinterpolated.map((r) => ({
        frameIndex: r.after.index,
        beforeState: r.before.state,
        beforeSource: r.before.source,
        beforeBox: r.before.box,
        beforeConfidence: r.before.confidence,
        afterState: r.after.state,
        afterSource: r.after.source,
        afterBox: r.after.box,
        afterConfidence: r.after.confidence,
      })),
      flickerBefore: truoc.gate.counts.flicker_unreviewed,
      flickerAfter: flickerSau.length,
      gateVerdictBefore: truoc.gate.verdict,
      gateVerdictAfter: gateSau.verdict,
      correctedAt: now,
      actorUserId: actor.user.id,
    },
    frames: changed.map((f) => ({
      jobId, workspaceId, frameIndex: f.index,
      state: f.state, box: f.box, confidence: f.confidence, source: f.source,
      updatedAt: now,
    })),
  });

  /*
   * Doc LAI tu kho de dung phan hoi. Tra ve ke hoach dang nam trong bo nho se lam giao dien hien
   * mot trang thai chua chac da duoc luu — va do la kieu loi khong bao gio lo ra khi thu tay.
   */
  const view = await buildView(ctx, workspaceId, jobId);
  if (!view) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job_frames' }));
  return ok(view);
}
