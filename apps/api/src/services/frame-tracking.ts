/**
 * MCP-41 + MCP-42 — chay tracking qua toan bo timeline, va sua tay tai keyframe.
 *
 * BAT BIEN 1 ("khong co frame nao bi bo sot ma UI lai bao tracking hoan tat") duoc thi hanh o day
 * theo mot cach rat cu the: so frame ky vong den tu **MCP-40** (dem tren tep that), KHONG tu ket
 * qua tracking. Neu lay so ky vong tu chinh ket qua thi phep so sanh vo nghia — no se luon khop
 * voi chinh no, va mot frame bien mat se khong bao gio bi phat hien.
 */
import {
  CORRECTION_NEIGHBOUR_RADIUS,
  frameStateFor,
  planFrameCorrection,
  summariseTimeline,
  type FrameState,
  type FrameTimelineSummary,
  type MaskBox,
  type MaskSource,
} from '@mediaclear/contracts';
import type { MotionTrackingProvider } from '../providers/tracking.js';
import type { FrameTimeline } from '../media/frame-timeline.js';

export interface FrameRecord {
  index: number;
  state: FrameState;
  box: MaskBox | null;
  confidence: number | null;
  source: MaskSource;
}

/** Mot lan nguoi that sua mask. Ghi CA truoc lan sau — thieu mot ve la khong doi chieu duoc. */
export interface CorrectionAuditEntry {
  frameIndex: number;
  before: { box: MaskBox | null; state: FrameState; source: MaskSource; confidence: number | null };
  after: { box: MaskBox; state: FrameState; source: MaskSource };
  /** Frame lan can duoc tinh lai theo lan sua nay. */
  reinterpolated: number[];
  at: string;
}

export interface TrackingResult {
  frames: Map<number, FrameRecord>;
  summary: FrameTimelineSummary;
  /** Lich su sua tay. Rong = chua ai sua. KHONG BAO GIO bi ghi de (MCP-42). */
  audit: CorrectionAuditEntry[];
}

/**
 * Chay tracking tren toan bo timeline.
 *
 * `timeline.undecodableFrames` duoc chuyen thang thanh `frame_failed` — day la cho thi hanh yeu
 * cau "frame loi decode duoc ghi nhan, khong bi bo qua khoi tong so". Chung khong co byte de
 * track, nhung chung PHAI co mat trong bang trang thai, neu khong tong so se thieu va bat bien 1
 * se bao dong nham ly do.
 */
export async function trackTimeline(
  provider: MotionTrackingProvider,
  timeline: FrameTimeline,
  initial: MaskBox,
  threshold?: number,
): Promise<TrackingResult> {
  const frames = new Map<number, FrameRecord>();
  let previous = initial;

  for (const frame of timeline.frames) {
    const out = await provider.trackFrame({
      frameIndex: frame.index,
      previous,
      ptsSeconds: frame.ptsSeconds,
    });
    const state = frameStateFor({ ok: out.ok, confidence: out.confidence, source: out.source }, threshold);
    frames.set(frame.index, {
      index: frame.index,
      state,
      box: out.box,
      confidence: out.confidence,
      source: out.source,
    });
    // Provider that bai thi GIU nguyen diem xuat phat cu, khong lay `null` lam vi tri moi.
    if (out.ok && out.box) previous = out.box;
  }

  /*
   * Frame container khai ma khong giai ma duoc: dua vao bang voi `frame_failed`.
   * Chung duoc danh so tu cuoi danh sach giai ma duoc tro di — khong biet chinh xac chung nam o
   * dau trong video, va KHONG duoc doan; cai can bao dam la chung co mat trong tong so.
   */
  for (let i = timeline.frames.length; i < timeline.expectedFrameCount; i += 1) {
    frames.set(i, { index: i, state: 'frame_failed', box: null, confidence: null, source: 'tracked' });
  }

  return {
    frames,
    summary: summariseTimeline(timeline.expectedFrameCount, new Map([...frames].map(([k, v]) => [k, v.state]))),
    audit: [],
  };
}

/**
 * MCP-42 — nguoi that sua mask tai mot frame.
 *
 * `D-074`: ham nay KHONG con tu tinh gi nua. Toan bo luat nam o `planFrameCorrection` cua contract,
 * va duong API (`correctJobFrame`) goi CHINH ham do. Truoc `D-074` hai duong la hai ban hien thuc
 * khac nhau va cho ket qua khac nhau tren cung mot thao tac cua nguoi dung — do la `Q-P4-05`.
 *
 * Phan con lai o day chi la doi hinh dang `Map` <-> mang, va noi them ban ghi audit.
 */
export function applyCorrection(
  result: TrackingResult,
  frameIndex: number,
  box: MaskBox,
  now: string,
  neighbourRadius = CORRECTION_NEIGHBOUR_RADIUS,
): TrackingResult {
  const plan = planFrameCorrection([...result.frames.values()], frameIndex, box, neighbourRadius);
  if (!plan) throw new Error(`frame ${frameIndex} khong co trong timeline`);

  return {
    frames: new Map(plan.frames.map((f) => [f.index, f])),
    summary: summariseTimeline(
      result.summary.expectedFrameCount,
      new Map(plan.frames.map((f) => [f.index, f.state])),
    ),
    // `audit` duoc NOI THEM, khong bao gio thay the — day la ban chat cua audit trail.
    audit: [...result.audit, {
      frameIndex,
      before: {
        box: plan.correctedBefore.box,
        state: plan.correctedBefore.state,
        source: plan.correctedBefore.source,
        confidence: plan.correctedBefore.confidence,
      },
      after: { box, state: 'frame_correction_applied', source: 'manual' },
      reinterpolated: plan.reinterpolated.map((r) => r.after.index),
      at: now,
    }],
  };
}

/** Lay bang mask de MCP-43 kiem tinh lien tuc. Bo frame khong co mask. */
export function maskMapOf(result: TrackingResult): Map<number, MaskBox> {
  const out = new Map<number, MaskBox>();
  for (const [index, record] of result.frames) if (record.box) out.set(index, record.box);
  return out;
}
