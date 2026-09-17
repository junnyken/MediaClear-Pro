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
import type { JobFrameRecord } from '../persistence/types.js';

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
   * Audio: `null` khi job CHUA co output. Khong do duoc thi cong chan khong bao gio noi `completed`
   * — xem `qualityReviewVerdict`. Day la cho de bi cam do nhat: dien mot gia tri "tam" vao day se
   * lam giao dien bat nut xuat trong khi chua ai kiem audio.
   */
  const gate = qualityReviewVerdict({
    timeline: summary,
    unreviewedFlicker: flicker.length,
    audioVerdict: job.outputAssetId ? 'preserved' : null,
  });

  return {
    jobId,
    jobState: job.state,
    timeline: summary,
    frames: rows.map((r) => ({
      index: r.frameIndex, state: r.state, box: r.box, confidence: r.confidence, source: r.source,
    })),
    gate,
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
 * Ghi audit TRUOC khi doi frame: neu doi truoc roi ghi audit sau, mot su co giua chung se xoa mat
 * gia tri cu vinh vien. Ban cu la thu duy nhat cho phep doi chieu lai quyet dinh cua nguoi dung.
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
  const rows = await ctx.persistence.jobFrames.listFrames(workspaceId, jobId);
  const current = rows.find((r) => r.frameIndex === frameIndex);
  if (!current) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'frame' }));

  const now = ctx.now().toISOString();

  // 1) Ghi audit TRUOC. APPEND-ONLY.
  await ctx.persistence.jobFrames.appendCorrection({
    id: newId('aud'),
    jobId, workspaceId, frameIndex,
    beforeState: current.state,
    beforeSource: current.source,
    beforeBox: current.box,
    beforeConfidence: current.confidence,
    afterBox: box,
    reinterpolated: [],
    correctedAt: now,
    actorUserId: actor.user.id,
  });

  // 2) Roi moi doi frame. Nguoi that sua => `manual`, va confidence ve `null`:
  //    do tin cay cua MAY khong con y nghia khi nguoi da dat tay vao.
  await ctx.persistence.jobFrames.updateFrame({
    jobId, workspaceId, frameIndex,
    state: 'frame_correction_applied',
    box, confidence: null, source: 'manual', updatedAt: now,
  });

  const view = await buildView(ctx, workspaceId, jobId);
  if (!view) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job_frames' }));
  return ok(view);
}
