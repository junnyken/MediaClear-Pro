/**
 * `Q-P4-05` / `D-074` — hai duong sua keyframe phai cho CUNG mot ket qua.
 *
 * Truoc `D-074` co hai ban hien thuc: `applyCorrection` (tang service, co tinh lai lan can) va
 * `correctJobFrame` (tang API, ghi `reinterpolated: []` va khong tinh gi). Toan bo test deu xanh,
 * vi moi ben chi duoc kiem theo hanh vi cua chinh no — khong test nao dat hai ben canh nhau.
 *
 * Bo test nay lam dung mot viec do.
 */
import { describe, expect, it } from 'vitest';
import {
  CORRECTION_NEIGHBOUR_RADIUS,
  CORRECTION_NEIGHBOUR_RADIUS_IS_MEASURED,
  planFrameCorrection,
  summariseTimeline,
  type CorrectionFrame,
  type FrameState,
} from '@mediaclear/contracts';
import { applyCorrection } from '../src/services/frame-tracking.js';

const BOX = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };

function frame(index: number, patch: Partial<CorrectionFrame> = {}): CorrectionFrame {
  return { index, state: 'frame_tracked', box: { ...BOX }, confidence: 0.95, source: 'tracked', ...patch };
}

const timeline = (n: number, patch: (i: number) => Partial<CorrectionFrame> = () => ({})): CorrectionFrame[] =>
  Array.from({ length: n }, (_, i) => frame(i, patch(i)));

describe('D-074 — luat canonical cho mot lan sua keyframe', () => {
  it('con so ban kinh `2` duoc khai bao la UOC LUONG, khong phai so do', () => {
    /*
     * Cung cach xu ly `FRAME_CONFIDENCE_THRESHOLD_IS_MEASURED`. Neu ai do sau nay do that va doi
     * co nay thanh `true` ma khong co du lieu, test nay khong can no — nhung tai lieu thi can, va
     * phep kiem nay giu cho con so khong am tham bien thanh "da do".
     */
    expect(CORRECTION_NEIGHBOUR_RADIUS).toBe(2);
    expect(CORRECTION_NEIGHBOUR_RADIUS_IS_MEASURED).toBe(false);
  });

  it('sua GIUA timeline: dung so lan can moi ben, gia tri suy ra khong bi tron voi gia tri do duoc', () => {
    const plan = planFrameCorrection(timeline(9), 4, { x: 0.5, y: 0.1, width: 0.3, height: 0.3 });
    expect(plan).not.toBeNull();
    expect(plan!.corrected.source).toBe('manual');
    expect(plan!.corrected.confidence, 'nguoi that sua thi "do tin cay cua may" khong con nghia').toBeNull();
    expect(plan!.reinterpolated.map((r) => r.after.index).sort((a, b) => a - b)).toEqual([2, 3, 5, 6]);
    for (const r of plan!.reinterpolated) {
      expect(r.after.source, 'gia tri SUY RA bi tron voi gia tri DO DUOC').toBe('interpolated');
      expect(r.after.confidence, 'hop da doi ma van giu so confidence cu = mo ta mot hop khong ton tai').toBeNull();
    }
  });

  it('sua o DAU timeline: khong doi ra ngoai bien, va noi ro la cham bien', () => {
    const plan = planFrameCorrection(timeline(6), 0, BOX);
    expect(plan!.reinterpolated.map((r) => r.after.index)).toEqual([1, 2]);
    expect(plan!.skipped.some((s) => s.reason === 'timeline_boundary'), 'cham bien ma im lang').toBe(true);
  });

  it('sua o CUOI timeline: khong doi ra ngoai bien', () => {
    const plan = planFrameCorrection(timeline(6), 5, BOX);
    expect(plan!.reinterpolated.map((r) => r.after.index).sort((a, b) => a - b)).toEqual([3, 4]);
    expect(plan!.skipped.some((s) => s.reason === 'timeline_boundary')).toBe(true);
  });

  it('frame khong co trong timeline: tra `null`, KHONG doan', () => {
    expect(planFrameCorrection(timeline(3), 99, BOX)).toBeNull();
  });

  it('frame HONG DECODE (khong co mask) bi BO QUA, khong duoc "hoi sinh"', () => {
    const frames = timeline(7, (i) => (i === 5 ? { state: 'frame_failed', box: null, confidence: null } : {}));
    const plan = planFrameCorrection(frames, 4, BOX);

    expect(plan!.reinterpolated.map((r) => r.after.index)).not.toContain(5);
    expect(plan!.skipped).toContainEqual({ index: 5, reason: 'frame_failed_no_box' });
    const sau = plan!.frames.find((f) => f.index === 5)!;
    expect(sau.state, 'frame hong decode bi noi suy thanh "da sua" = gia vo phuc hoi byte da hong').toBe('frame_failed');
    expect(sau.box).toBeNull();
  });

  it('gap frame nguoi khac DA TU SUA thi DUNG han ve phia do', () => {
    const frames = timeline(9, (i) => (i === 6 ? { source: 'manual', state: 'frame_correction_applied', confidence: null } : {}));
    const plan = planFrameCorrection(frames, 4, BOX);

    expect(plan!.skipped).toContainEqual({ index: 6, reason: 'manual_frame' });
    // Dung han: frame 7 nam sau frame 6 nen cung khong duoc dung toi.
    expect(plan!.reinterpolated.map((r) => r.after.index)).not.toContain(7);
    expect(plan!.frames.find((f) => f.index === 6)!.source).toBe('manual');
  });

  /**
   * Phep kiem quan trong nhat cua `D-074`.
   *
   * Hanh vi cu DO DUOC: timeline 7 frame, frame 2 va 4 o `frame_low_confidence`, sua frame 3 mot
   * lan -> `lowConfidence: 2 -> 0` va `canComplete: false -> true`. Mot thao tac tren frame 3 da
   * xoa cau hoi dang treo o hai frame nguoi dung chua he nhin.
   */
  it('noi suy KHONG duoc xoa co review cua frame lan can — cong chan phai con hoi', () => {
    const frames = timeline(7, (i) => (i === 2 || i === 4 ? { state: 'frame_low_confidence', confidence: 0.21 } : {}));
    const truoc = summariseTimeline(7, new Map(frames.map((f) => [f.index, f.state])));
    expect(truoc.lowConfidence).toBe(2);
    expect(truoc.canComplete).toBe(false);

    const plan = planFrameCorrection(frames, 3, { x: 0.14, y: 0.1, width: 0.3, height: 0.3 });
    const sau = summariseTimeline(7, new Map(plan!.frames.map((f) => [f.index, f.state])));

    for (const i of [2, 4]) {
      const f = plan!.frames.find((x) => x.index === i)!;
      expect(f.box!.x, 'hop van phai duoc tinh lai — noi suy co ich cho hinh hoc').not.toBe(0.1);
      expect(f.state, `frame ${i} bi thang len trang thai TOT ma khong ai xem lai`).toBe('frame_low_confidence');
    }
    expect(sau.lowConfidence, 'mot lan sua da xoa cau hoi treo o frame khac').toBe(2);
    expect(sau.canComplete, 'cong chan bi mo ra boi mot thao tac khong lien quan').toBe(false);
  });

  it('sua NHIEU LAN lien tiep: lan sau khong de len frame lan truoc nguoi that da sua', () => {
    let frames = timeline(9);
    const a = planFrameCorrection(frames, 3, { x: 0.3, y: 0.1, width: 0.2, height: 0.2 })!;
    frames = a.frames;
    const b = planFrameCorrection(frames, 5, { x: 0.7, y: 0.1, width: 0.2, height: 0.2 })!;

    expect(b.frames.find((f) => f.index === 3)!.source, 'de len quyet dinh cua nguoi that').toBe('manual');
    expect(b.frames.find((f) => f.index === 3)!.box!.x).toBe(0.3);
  });

  /**
   * DOI CHIEU HAI DUONG. Day la cau hoi `Q-P4-05`, dat thanh mot phep do truc tiep.
   */
  it('HOI TU: `applyCorrection` va `planFrameCorrection` cho cung ket qua tren cung dau vao', () => {
    const frames = timeline(9, (i) => (i === 6 ? { state: 'frame_low_confidence', confidence: 0.3 } : {}));
    const box = { x: 0.42, y: 0.2, width: 0.25, height: 0.25 };

    const plan = planFrameCorrection(frames, 4, box)!;
    const viaService = applyCorrection(
      {
        frames: new Map(frames.map((f) => [f.index, { ...f }])),
        summary: summariseTimeline(9, new Map(frames.map((f) => [f.index, f.state as FrameState]))),
        audit: [],
      },
      4, box, '2026-09-17T00:00:00.000Z',
    );

    for (const f of plan.frames) {
      const other = viaService.frames.get(f.index)!;
      expect({ ...other }, `frame ${f.index} lech giua hai duong`).toEqual({ ...f });
    }
    expect(viaService.audit[0]!.reinterpolated.sort((a, b) => a - b))
      .toEqual(plan.reinterpolated.map((r) => r.after.index).sort((a, b) => a - b));
  });
});
