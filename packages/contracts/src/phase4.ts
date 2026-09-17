/**
 * Phase 4 — frame timeline, tracking, correction, temporal check, quality gate (MCP-40…44).
 *
 * File nay la NOI DUY NHAT dinh nghia luat cua Phase 4. Service va UI deu hoi o day; khong ben nao
 * duoc tu suy ra luat cua rieng minh (`D-047`).
 *
 * BA BAT BIEN COT LOI cua Phase 4, va cho nao trong file nay thi hanh chung:
 *
 *   1. "Khong co frame nao bi bo sot ma UI lai bao tracking hoan tat"
 *      -> `summariseTimeline` so `states.size` voi `expectedFrameCount`. Thieu mot frame la
 *         `missing > 0`, va `canComplete` thanh false.
 *   2. "Frame confidence thap phai duoc danh dau review"
 *      -> `frameStateFor` tra `frame_low_confidence` khi duoi nguong; `summariseTimeline` dem no
 *         vao `lowConfidence`, va `canComplete` thanh false.
 *   3. "Video khong duoc xuat neu audio bi mat ngoai y muon"
 *      -> `qualityReviewVerdict` doi `audioAllowsCompletion` (dung lai `compareAudio` cua Phase 3,
 *         KHONG viet lai).
 */
import { audioAllowsCompletion, type AudioVerdict } from './phase3.js';

/* ------------------------------------------------------------------ frame state */

/**
 * Cac gia tri CO THE co, khai bao RIENG.
 *
 * Khong suy ra tu gia tri dang dung — day la lan thu tu du an nay phai noi dieu do (`D-046`,
 * regex canonical ID, `ApiRouteStatus`, `TECHNICAL_GATES`).
 */
export const FRAME_STATES = [
  'frame_tracked',
  'frame_low_confidence',
  'frame_review_required',
  'frame_correction_applied',
  'frame_failed',
] as const;
export type FrameState = (typeof FRAME_STATES)[number];

/**
 * Trang thai frame duoc coi la XONG TOT.
 *
 * Chi hai gia tri. Viet ra thanh danh sach rieng thay vi mot phep phu dinh (`!== 'frame_failed'`)
 * co chu dinh: them mot frame state moi sau nay se KHONG tu dong duoc coi la hop le.
 */
export const FRAME_STATES_OK: readonly FrameState[] = ['frame_tracked', 'frame_correction_applied'];

export function frameStateIsOk(state: FrameState): boolean {
  return FRAME_STATES_OK.includes(state);
}

/** Nguon goc cua mask tren mot frame. Phai phan biet duoc, khong duoc gop. */
export const MASK_SOURCES = ['tracked', 'interpolated', 'manual'] as const;
export type MaskSource = (typeof MASK_SOURCES)[number];

/* ------------------------------------------------------- confidence threshold */

/**
 * Nguong confidence de mot frame bi coi la "chua du tin cay".
 *
 * SU THAT VE CON SO NAY: day la mot **UOC LUONG**, khong phai ket qua do. He thong chua co provider
 * tracking that nao (Buoc 0 cua Phase 4), nen chua co phan bo confidence that de chon nguong.
 * Phase 3 da lam dung viec nay mot lan: dung sai audio `0.25s` (`Q-P3-03`) duoc DO bang 12 luot
 * render roi moi ghim. O day chua do duoc, nen:
 *
 *   - con so nay nam TUONG MINH o mot cho, khong an trong logic;
 *   - no duoc ghi la uoc luong trong tai lieu, KHONG goi la `verified`;
 *   - co mot cau hoi mo de do lai khi co provider that va du lieu that.
 *
 * Vi sao 0.6: khoang confidence chuan hoa [0,1]; 0.6 la ranh gioi "dung duoc nhung khong chac" ma
 * phan lon bo tracking dung lam moc canh bao. Dat cao hon se bien moi frame hoi mo thanh review va
 * lam tinh nang thanh vo dung; dat thap hon se de lot frame sai.
 */
export const FRAME_CONFIDENCE_THRESHOLD = 0.6;

/** Con so nay da duoc DO tren du lieu that chua. Chua — va tai lieu phai noi dung the. */
export const FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED = false;

/**
 * Tu ket qua tracking mot frame ra trang thai frame.
 *
 * `confidence === null` nghia la provider KHONG tra ve so nao — day khong phai "confidence = 0",
 * va cang khong phai "tin cay". Khong do duoc thi frame phai di duong review, dung tinh than `D-044`.
 */
export function frameStateFor(
  outcome: { ok: boolean; confidence: number | null; source: MaskSource },
  threshold: number = FRAME_CONFIDENCE_THRESHOLD,
): FrameState {
  if (!outcome.ok) return 'frame_failed';
  if (outcome.source === 'manual') return 'frame_correction_applied';
  if (outcome.confidence === null) return 'frame_review_required';
  if (outcome.confidence < threshold) return 'frame_low_confidence';
  return outcome.source === 'interpolated' ? 'frame_correction_applied' : 'frame_tracked';
}

/* --------------------------------------------------------------- timeline */

export interface FrameTimelineSummary {
  expectedFrameCount: number;
  /** So frame CO trang thai. Nho hon `expectedFrameCount` nghia la co frame bi bo sot. */
  reportedFrameCount: number;
  /** BAT BIEN 1. Lon hon 0 la co frame bien mat khoi ket qua. */
  missing: number;
  lowConfidence: number;
  reviewRequired: number;
  failed: number;
  ok: number;
  /** Chi `true` khi KHONG con thieu frame, KHONG con frame xau. */
  canComplete: boolean;
}

/**
 * Tong hop timeline.
 *
 * `expectedFrameCount` den tu phep DO tren tep that (MCP-40), khong tu `duration × fps`. Do la mau
 * chot cua bat bien 1: neu lay so frame ky vong tu chinh ket qua tracking thi khong bao gio phat
 * hien duoc frame bi bo sot — con so se luon khop voi chinh no.
 */
export function summariseTimeline(
  expectedFrameCount: number,
  states: ReadonlyMap<number, FrameState>,
): FrameTimelineSummary {
  let lowConfidence = 0;
  let reviewRequired = 0;
  let failed = 0;
  let ok = 0;
  for (const state of states.values()) {
    if (state === 'frame_low_confidence') lowConfidence += 1;
    else if (state === 'frame_review_required') reviewRequired += 1;
    else if (state === 'frame_failed') failed += 1;
    else if (frameStateIsOk(state)) ok += 1;
  }
  const reportedFrameCount = states.size;
  // Frame thua (bao nhieu hon so ky vong) cung la bat thuong, nhung khong phai "thieu".
  const missing = Math.max(0, expectedFrameCount - reportedFrameCount);
  return {
    expectedFrameCount,
    reportedFrameCount,
    missing,
    lowConfidence,
    reviewRequired,
    failed,
    ok,
    canComplete:
      missing === 0 &&
      reportedFrameCount === expectedFrameCount &&
      lowConfidence === 0 &&
      reviewRequired === 0 &&
      failed === 0,
  };
}

/* ------------------------------------------------- temporal consistency (MCP-43) */

export interface MaskBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Nguong nhay toi da GIUA HAI FRAME LIEN TIEP, tinh theo frame rate THAT.
 *
 * Khong hardcode theo gia dinh 30fps: video 60fps co gap doi so frame cho cung mot chuyen dong, nen
 * moi frame chi duoc phep nhay mot nua. Lay mot van toc toi da hop ly theo GIAY roi chia cho fps.
 *
 * `MAX_MASK_SPEED_PER_SECOND = 1.5` nghia la mask duoc phep di het 1,5 lan chieu rong khung hinh
 * trong mot giay ma van coi la chuyen dong binh thuong. Day cung la **uoc luong**, cung ly do voi
 * nguong confidence, va cung can do lai khi co du lieu that.
 */
export const MAX_MASK_SPEED_PER_SECOND = 1.5;

export function maxMaskDeltaPerFrame(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return Number.POSITIVE_INFINITY; // khong biet fps => khong ket toi
  return MAX_MASK_SPEED_PER_SECOND / fps;
}

export interface FlickerFinding {
  fromFrame: number;
  toFrame: number;
  delta: number;
  limit: number;
}

/**
 * Tim doan nhay bat thuong giua cac frame lien tiep.
 *
 * KHONG tu lam muot. Phat hien va danh dau de nguoi xem — lam muot am tham se sua mot trieu chung
 * va giau mat nguyen nhan, dong thoi lam ket qua khong con la ket qua tracking nua.
 */
export function detectFlicker(
  masks: ReadonlyMap<number, MaskBox>,
  fps: number,
): FlickerFinding[] {
  const limit = maxMaskDeltaPerFrame(fps);
  if (!Number.isFinite(limit)) return [];
  const indices = [...masks.keys()].sort((a, b) => a - b);
  const out: FlickerFinding[] = [];
  for (let i = 1; i < indices.length; i += 1) {
    const prevIndex = indices[i - 1]!;
    const curIndex = indices[i]!;
    // Chi so sanh frame THUC SU lien tiep: cach quang thi khoang nhay lon la binh thuong.
    if (curIndex - prevIndex !== 1) continue;
    const a = masks.get(prevIndex)!;
    const b = masks.get(curIndex)!;
    const delta = Math.max(
      Math.abs(b.x - a.x),
      Math.abs(b.y - a.y),
      Math.abs(b.width - a.width),
      Math.abs(b.height - a.height),
    );
    if (delta > limit) out.push({ fromFrame: prevIndex, toFrame: curIndex, delta, limit });
  }
  return out;
}

/* ------------------------------------------------- quality review gate (MCP-44) */

export const QUALITY_GATE_VERDICTS = ['completed', 'review_required', 'failed'] as const;
export type QualityGateVerdict = (typeof QUALITY_GATE_VERDICTS)[number];

/** Ly do MAY doc duoc. UI dich sang cau chu, khong tu che chuoi. */
export const QUALITY_GATE_REASONS = [
  'frames_missing',
  'frames_failed',
  'frames_low_confidence',
  'frames_review_required',
  'flicker_unreviewed',
  'audio_not_preserved',
] as const;
export type QualityGateReason = (typeof QUALITY_GATE_REASONS)[number];

export interface QualityGateInput {
  timeline: FrameTimelineSummary;
  /** Doan nhay CHUA duoc nguoi that xac nhan. Da xac nhan thi khong con chan. */
  unreviewedFlicker: number;
  /**
   * `null` = CHUA DO duoc, vi duong xu ly co y khong render (frame chua dat).
   *
   * `null` KHONG phai "audio khong sao". No khac han `'lost'` (do duoc va mat that) va khac han
   * `'preserved'`. Truoc khi tach gia tri nay, duong tich hop truyen `'unknown'` cho ca truong hop
   * chua render — va cong chan doc thanh "audio co van de", tra ve `failed` trong khi ly do that
   * chi la mot frame co do tin cay thap. Mot job dang le `review_required` bi bao la `failed`.
   *
   * Luat kem theo, va no la thu giu bat bien 3 nguyen ven: **khong do duoc audio thi khong bao gio
   * `completed`** — xem `qualityReviewVerdict`.
   */
  audioVerdict: AudioVerdict | null;
}

export interface QualityGateResult {
  verdict: QualityGateVerdict;
  reasons: QualityGateReason[];
  /** So lieu de UI noi CU THE ("12 frame do tin cay thap"), khong chi mot nhan chung. */
  counts: Record<QualityGateReason, number>;
}

/**
 * Cong chan CUOI CUNG truoc khi xuat. Day la noi duy nhat duoc phep noi "completed".
 *
 * Thu tu danh gia co y nghia: `failed` nang hon `review_required`. Frame hong decode la loi that
 * cua tep, khong phai thu nguoi dung xem lai roi duyet duoc — nen no ra `failed`.
 */
export function qualityReviewVerdict(input: QualityGateInput): QualityGateResult {
  const counts: Record<QualityGateReason, number> = {
    frames_missing: input.timeline.missing,
    frames_failed: input.timeline.failed,
    frames_low_confidence: input.timeline.lowConfidence,
    frames_review_required: input.timeline.reviewRequired,
    flicker_unreviewed: input.unreviewedFlicker,
    /*
     * Audio khong phai mot phep dem — 1 nghia la "co van de", 0 nghia la khong.
     * `null` (chua do duoc) tinh la 0 O DAY, vi no khong phai mot van de audio; nhung no van chan
     * `completed` o ngay duoi. Gop hai thu nay lam mot se bao sai LY DO.
     */
    audio_not_preserved: input.audioVerdict === null ? 0 : audioAllowsCompletion(input.audioVerdict) ? 0 : 1,
  };
  const reasons = QUALITY_GATE_REASONS.filter((r) => counts[r] > 0);

  /*
   * BAT BIEN 3, ve thu hai: chua DO duoc audio thi khong bao gio `completed`.
   *
   * Khong co ve nay, mot duong xu ly bo qua buoc do audio se di thang toi `completed` ma khong ai
   * chan — dung cai lo hong ma de bai goi la "bo qua audio verification".
   */
  if (input.audioVerdict === null) {
    return {
      verdict: reasons.length === 0 ? 'review_required' : (counts.frames_missing > 0 || counts.frames_failed > 0 ? 'failed' : 'review_required'),
      reasons,
      counts,
    };
  }

  if (reasons.length === 0) return { verdict: 'completed', reasons, counts };

  /*
   * BAT BIEN 3 nam o day: audio mat thi KHONG BAO GIO `completed`. Va no ra `failed` chu khong phai
   * `review_required` — mot nguoi bam "duyet" khong lam audio quay tro lai.
   */
  const fatal = counts.frames_missing > 0 || counts.frames_failed > 0 || counts.audio_not_preserved > 0;
  return { verdict: fatal ? 'failed' : 'review_required', reasons, counts };
}
