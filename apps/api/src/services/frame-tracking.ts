/**
 * MCP-41 + MCP-42 — chay tracking qua toan bo timeline, va sua tay tai keyframe.
 *
 * BAT BIEN 1 ("khong co frame nao bi bo sot ma UI lai bao tracking hoan tat") duoc thi hanh o day
 * theo mot cach rat cu the: so frame ky vong den tu **MCP-40** (dem tren tep that), KHONG tu ket
 * qua tracking. Neu lay so ky vong tu chinh ket qua thi phep so sanh vo nghia — no se luon khop
 * voi chinh no, va mot frame bien mat se khong bao gio bi phat hien.
 */
import {
  frameStateFor,
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
 * Hai dieu bat buoc, va ca hai deu tung la cho de lam sai:
 *
 *  1. **Khong ghi de lich su.** Ban ghi truoc khi sua duoc cat vao `audit` TRUOC khi thay doi gi.
 *     Sua ma khong giu ban cu thi khong ai doi chieu lai duoc quyet dinh cua nguoi dung.
 *  2. **Tinh lai frame lan can.** Sua dung mot frame roi de cac frame xung quanh giu gia tri cu se
 *     tao ra mot cu "nhay" ngay tai cho vua sua — tuc la sua mot loi va tao ra mot loi khac.
 */
export function applyCorrection(
  result: TrackingResult,
  frameIndex: number,
  box: MaskBox,
  now: string,
  neighbourRadius = 2,
): TrackingResult {
  const current = result.frames.get(frameIndex);
  if (!current) throw new Error(`frame ${frameIndex} khong co trong timeline`);

  const before = {
    box: current.box,
    state: current.state,
    source: current.source,
    confidence: current.confidence,
  };

  const frames = new Map(result.frames);
  frames.set(frameIndex, {
    index: frameIndex,
    state: 'frame_correction_applied',
    box,
    // Nguoi that sua thi khong con "do tin cay cua may" — de `null` chu khong bia mot so cao.
    confidence: null,
    source: 'manual',
  });

  /*
   * Tinh lai lan can bang noi suy tu frame vua sua sang frame tot gan nhat o moi ben.
   * Danh dau `interpolated`, KHONG danh dau `tracked`: mot gia tri suy ra khong duoc tron voi mot
   * gia tri do duoc.
   */
  const reinterpolated: number[] = [];
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= neighbourRadius; step += 1) {
      const idx = frameIndex + dir * step;
      const neighbour = frames.get(idx);
      if (!neighbour) break;
      // Khong dung toi frame nguoi that da sua, va khong "hoi sinh" frame hong decode.
      if (neighbour.source === 'manual') break;
      if (neighbour.state === 'frame_failed' && neighbour.box === null) continue;
      const t = step / (neighbourRadius + 1);
      const from = box;
      const to = neighbour.box ?? box;
      frames.set(idx, {
        index: idx,
        state: 'frame_correction_applied',
        box: {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          width: from.width + (to.width - from.width) * t,
          height: from.height + (to.height - from.height) * t,
        },
        confidence: neighbour.confidence,
        source: 'interpolated',
      });
      reinterpolated.push(idx);
    }
  }

  return {
    frames,
    summary: summariseTimeline(
      result.summary.expectedFrameCount,
      new Map([...frames].map(([k, v]) => [k, v.state])),
    ),
    // `audit` duoc NOI THEM, khong bao gio thay the — day la ban chat cua audit trail.
    audit: [...result.audit, {
      frameIndex,
      before,
      after: { box, state: 'frame_correction_applied', source: 'manual' },
      reinterpolated,
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
