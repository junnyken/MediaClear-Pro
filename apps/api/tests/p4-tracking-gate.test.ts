/**
 * MCP-41…44 + BA BAT BIEN COT LOI cua Phase 4.
 *
 * Ba bat bien duoc de bai ghi nguyen van:
 *   1. "Khong co frame nao bi bo sot ma UI lai bao tracking hoan tat."
 *   2. "Frame confidence thap phai duoc danh dau review."
 *   3. "Video khong duoc xuat neu audio bi mat ngoai y muon."
 *
 * Moi bat bien co phep kiem TRUC TIEP duoi day, khong suy luan gian tiep qua mot module khac.
 */
import { describe, expect, it } from 'vitest';
import {
  FRAME_CONFIDENCE_THRESHOLD,
  detectFlicker,
  qualityReviewVerdict,
  summariseTimeline,
  type FrameState,
  type MaskBox,
} from '@mediaclear/contracts';
import { DeterministicTrackingProvider } from '../src/providers/tracking.js';
import { applyCorrection, maskMapOf, trackTimeline } from '../src/services/frame-tracking.js';
import type { FrameTimeline } from '../src/media/frame-timeline.js';

const BOX: MaskBox = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };

/** Timeline dung san — khong can decode video that cho phan logic nay. */
function timeline(count: number, fps = 10, declared = count): FrameTimeline {
  return {
    expectedFrameCount: declared,
    declaredFrameCount: declared,
    decodedFrameCount: count,
    undecodableFrames: Math.max(0, declared - count),
    fps,
    variableFrameRate: false,
    frames: Array.from({ length: count }, (_, i) => ({ index: i, ptsSeconds: i / fps })),
    framesWithoutTimestamp: 0,
  };
}

const AUDIO_OK = 'preserved' as const;

describe('MCP-41 — motion mask tracking', () => {
  it('logo TINH: track dung vi tri qua toan bo frame voi confidence cao', async () => {
    const r = await trackTimeline(new DeterministicTrackingProvider(), timeline(10), BOX);
    expect(r.summary.reportedFrameCount).toBe(10);
    expect(r.summary.ok).toBe(10);
    expect(r.summary.canComplete).toBe(true);
    for (const f of r.frames.values()) expect(f.box?.x).toBeCloseTo(BOX.x, 6);
  });

  it('logo DI CHUYEN tuyen tinh: vi tri tien deu, van track duoc', async () => {
    const r = await trackTimeline(new DeterministicTrackingProvider({ driftPerFrame: 0.01 }), timeline(10), BOX);
    expect(r.summary.canComplete).toBe(true);
    expect(r.frames.get(9)!.box!.x).toBeCloseTo(BOX.x + 0.1, 5);
  });

  it('logo BI CHE KHUAT: confidence thap => frame_low_confidence, job KHONG duoc completed', async () => {
    const r = await trackTimeline(
      new DeterministicTrackingProvider({ occludedFrames: [4, 5] }), timeline(10), BOX);
    expect(r.summary.lowConfidence).toBe(2);
    expect(r.summary.canComplete).toBe(false);
    const v = qualityReviewVerdict({ timeline: r.summary, unreviewedFlicker: 0, audioVerdict: AUDIO_OK });
    expect(v.verdict).toBe('review_required');
    expect(v.reasons).toContain('frames_low_confidence');
    expect(v.counts.frames_low_confidence).toBe(2);
  });

  it('provider QUA HAN: frame_failed, KHONG doan vi tri, va khong lam sap ca job', async () => {
    const r = await trackTimeline(
      new DeterministicTrackingProvider({ timeoutFrames: [3] }), timeline(10), BOX);
    expect(r.frames.get(3)!.state).toBe('frame_failed');
    expect(r.frames.get(3)!.box, 'qua han ma van dien vi tri => so lieu bia').toBeNull();
    expect(r.summary.failed).toBe(1);
    expect(r.summary.reportedFrameCount, 'job sap, mat cac frame con lai').toBe(10);
  });

  it('provider KHONG tra confidence: `null` KHONG phai 0 — phai di duong review (D-044)', async () => {
    const r = await trackTimeline(
      new DeterministicTrackingProvider({ noConfidenceFrames: [2] }), timeline(10), BOX);
    expect(r.frames.get(2)!.state).toBe('frame_review_required');
    expect(r.summary.canComplete).toBe(false);
  });

  it('BAT BIEN 2 — chi MOT frame confidence thap => review_required, khong bao gio completed', async () => {
    const r = await trackTimeline(
      new DeterministicTrackingProvider({ occludedFrames: [7] }), timeline(50), BOX);
    expect(r.summary.ok).toBe(49);
    expect(r.summary.lowConfidence).toBe(1);
    const v = qualityReviewVerdict({ timeline: r.summary, unreviewedFlicker: 0, audioVerdict: AUDIO_OK });
    expect(v.verdict, '49/50 frame tot KHONG duoc coi la du de bao hoan tat').not.toBe('completed');
    expect(v.verdict).toBe('review_required');
  });

  it('BAT BIEN 1 — mot frame bien mat khoi ket qua => KHONG BAO GIO completed', async () => {
    /*
     * Dung canh that: timeline dem duoc 10 frame tren tep, nhung tracking chi tra ve 9 (mot frame
     * bi bo sot vi decode timeout / su co mot phan). So ky vong den tu MCP-40, khong tu ket qua —
     * do la ly do phat hien duoc.
     */
    const states = new Map<number, FrameState>();
    for (let i = 0; i < 9; i += 1) states.set(i, 'frame_tracked');
    const summary = summariseTimeline(10, states);

    expect(summary.missing).toBe(1);
    expect(summary.canComplete).toBe(false);
    const v = qualityReviewVerdict({ timeline: summary, unreviewedFlicker: 0, audioVerdict: AUDIO_OK });
    expect(v.verdict).toBe('failed');
    expect(v.reasons).toContain('frames_missing');
    expect(v.counts.frames_missing).toBe(1);
  });

  it('frame hong decode van nam trong TONG SO, khong bi bo qua am tham', async () => {
    // Container khai 12, giai ma duoc 10 => 2 frame hong.
    const r = await trackTimeline(new DeterministicTrackingProvider(), timeline(10, 10, 12), BOX);
    expect(r.summary.expectedFrameCount).toBe(12);
    expect(r.summary.reportedFrameCount).toBe(12);
    expect(r.summary.failed).toBe(2);
    expect(r.summary.missing, 'frame hong phai co mat trong bang, khong duoc tinh la "thieu"').toBe(0);
    expect(r.summary.canComplete).toBe(false);
  });
});

describe('MCP-42 — keyframe correction', () => {
  it('sua mot keyframe: frame lan can duoc TINH LAI, khong de lai cu nhay', async () => {
    const r = await trackTimeline(
      new DeterministicTrackingProvider({ occludedFrames: [5] }), timeline(10), BOX);
    const fixed = applyCorrection(r, 5, { x: 0.5, y: 0.5, width: 0.2, height: 0.2 }, '2026-09-17T00:00:00.000Z');

    expect(fixed.frames.get(5)!.source).toBe('manual');
    expect(fixed.frames.get(5)!.state).toBe('frame_correction_applied');
    expect(fixed.audit[0]!.reinterpolated.length, 'sua mot frame roi bo mac lan can').toBeGreaterThan(0);
    for (const idx of fixed.audit[0]!.reinterpolated) {
      expect(fixed.frames.get(idx)!.source, 'gia tri suy ra bi tron voi gia tri do duoc').toBe('interpolated');
    }
  });

  it('audit trail giu CA truoc lan sau, va KHONG bao gio bi ghi de', async () => {
    const r = await trackTimeline(new DeterministicTrackingProvider(), timeline(10), BOX);
    const a = applyCorrection(r, 4, { x: 0.3, y: 0.3, width: 0.2, height: 0.2 }, 't1');
    const b = applyCorrection(a, 6, { x: 0.7, y: 0.7, width: 0.2, height: 0.2 }, 't2');

    expect(b.audit).toHaveLength(2);
    expect(b.audit[0]!.frameIndex).toBe(4);
    expect(b.audit[1]!.frameIndex).toBe(6);
    // Ban ghi TRUOC khi sua phai con nguyen, neu khong thi khong doi chieu lai duoc.
    expect(b.audit[0]!.before.source).toBe('tracked');
    expect(b.audit[0]!.before.box).not.toBeNull();
    expect(b.audit[1]!.after.source).toBe('manual');
  });

  it('sua tren frame HONG DECODE: xu ly ro rang, khong gia dinh frame da ton tai', async () => {
    const r = await trackTimeline(new DeterministicTrackingProvider(), timeline(9, 10, 10), BOX);
    expect(r.frames.get(9)!.state).toBe('frame_failed');
    expect(r.frames.get(9)!.box).toBeNull();

    const fixed = applyCorrection(r, 9, { x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, 't');
    expect(fixed.frames.get(9)!.state).toBe('frame_correction_applied');
    // Ban ghi truoc khi sua phai noi that rang no tung la frame hong.
    expect(fixed.audit[0]!.before.state).toBe('frame_failed');
    expect(fixed.audit[0]!.before.box).toBeNull();
  });

  it('sua khong lam mat confidence cua frame KHONG lien quan', async () => {
    const r = await trackTimeline(new DeterministicTrackingProvider(), timeline(20), BOX);
    const truoc = r.frames.get(19)!.confidence;
    const fixed = applyCorrection(r, 2, { x: 0.3, y: 0.3, width: 0.2, height: 0.2 }, 't');
    expect(fixed.frames.get(19)!.confidence).toBe(truoc);
    expect(fixed.frames.get(19)!.source).toBe('tracked');
  });
});

describe('MCP-43 — temporal consistency', () => {
  it('mask on dinh: KHONG bao sai la flicker', async () => {
    const r = await trackTimeline(new DeterministicTrackingProvider({ driftPerFrame: 0.005 }), timeline(30, 30), BOX);
    expect(detectFlicker(maskMapOf(r), 30)).toHaveLength(0);
  });

  it('mask NHAY bat thuong: bi phat hien', () => {
    const masks = new Map<number, MaskBox>();
    for (let i = 0; i < 10; i += 1) masks.set(i, { ...BOX, x: 0.1 + i * 0.001 });
    masks.set(5, { ...BOX, x: 0.9 }); // cu nhay gia lap
    const found = detectFlicker(masks, 30);
    expect(found.length).toBeGreaterThan(0);
    expect(found.some((f) => f.toFrame === 5 || f.fromFrame === 5)).toBe(true);
  });

  it('nguong tinh theo FRAME RATE THAT, khong hardcode 30fps', () => {
    const masks = new Map<number, MaskBox>([
      [0, BOX],
      [1, { ...BOX, x: BOX.x + 0.04 }], // nhay 0.04 moi frame
    ]);
    /*
     * Cung mot cu nhay: o 60fps thi vuot nguong (1.5/60 = 0.025), o 24fps thi khong (1.5/24 =
     * 0.0625). Neu nguong bi ghim theo 30fps thi hai ket qua nay se giong nhau.
     */
    expect(detectFlicker(masks, 60), 'nguong khong doi theo frame rate').toHaveLength(1);
    expect(detectFlicker(masks, 24)).toHaveLength(0);
  });

  it('khong biet frame rate thi KHONG ket toi flicker', () => {
    const masks = new Map<number, MaskBox>([[0, BOX], [1, { ...BOX, x: 0.99 }]]);
    expect(detectFlicker(masks, 0)).toHaveLength(0);
  });
});

describe('MCP-44 — quality review gate', () => {
  const okTimeline = summariseTimeline(5, new Map([
    [0, 'frame_tracked'], [1, 'frame_tracked'], [2, 'frame_correction_applied'],
    [3, 'frame_tracked'], [4, 'frame_tracked'],
  ] as [number, FrameState][]));

  it('du dieu kien => completed', () => {
    const v = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: AUDIO_OK });
    expect(v.verdict).toBe('completed');
    expect(v.reasons).toEqual([]);
  });

  it('BAT BIEN 3 — audio bi mat => KHONG BAO GIO completed', () => {
    for (const verdict of ['lost', 'duration_drift', 'channel_changed', 'unknown'] as const) {
      const v = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: verdict });
      expect(v.verdict, `audio '${verdict}' van cho xuat video`).not.toBe('completed');
      expect(v.reasons).toContain('audio_not_preserved');
    }
    // `lost` la mat that => `failed`; nguoi bam "duyet" khong lam audio quay lai.
    expect(qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: 'lost' }).verdict).toBe('failed');
  });

  it('audio VANG THEO THIET KE van cho completed — khong chan oan video khong co tieng', () => {
    const v = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: 'absent_by_design' });
    expect(v.verdict).toBe('completed');
  });

  /*
   * BA truong hop audio KHAC NHAU, va gop bat ky hai cai nao lai cung la noi sai mot trong hai.
   *
   * Loi that da gap o completion patch: duong tich hop truyen `'unknown'` cho ca truong hop CHUA
   * RENDER, va cong doc thanh "audio co van de" => tra `failed` trong khi ly do that chi la mot
   * frame do tin cay thap. Mot job dang le `review_required` bi bao la `failed`.
   */
  it('audio: KHONG DO DUOC (`null`) khac han MAT (`lost`) va khac han VANG THEO THIET KE', () => {
    // 1) Vang theo thiet ke: video von khong co tieng => KHONG phai mat, cho `completed`.
    const vang = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: 'absent_by_design' });
    expect(vang.verdict).toBe('completed');
    expect(vang.counts.audio_not_preserved, 'video khong tieng bi ket toi la mat tieng').toBe(0);

    // 2) MAT that: co tieng o dau vao, khong con o dau ra => chan, va NOI RO la van de audio.
    const mat = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: 'lost' });
    expect(mat.verdict).toBe('failed');
    expect(mat.counts.audio_not_preserved).toBe(1);
    expect(mat.reasons).toContain('audio_not_preserved');

    // 3) CHUA DO DUOC: khong bao gio `completed`, NHUNG cung khong duoc ket toi la mat audio.
    const chuaDo = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 0, audioVerdict: null });
    expect(chuaDo.verdict, 'chua do audio ma van cho xuat video').not.toBe('completed');
    expect(chuaDo.counts.audio_not_preserved, 'chua do duoc bi bao thanh "audio bi mat" => ly do sai').toBe(0);
    expect(chuaDo.reasons, 'chua do duoc khong duoc tinh la mot van de audio').not.toContain('audio_not_preserved');
  });

  it('audio chua do duoc + frame co van de => ly do phai la FRAME, khong phai audio', () => {
    /*
     * Dung canh that cua duong tich hop: frame chua dat nen co y khong render, nen audio chua co gi
     * de do. Ly do bao ra phai la frame do tin cay thap — thu nguoi dung sua duoc — chu khong phai
     * mot loi audio khong ai dong vao duoc.
     */
    const states = new Map<number, FrameState>([[0, 'frame_low_confidence'], [1, 'frame_tracked']]);
    const v = qualityReviewVerdict({ timeline: summariseTimeline(2, states), unreviewedFlicker: 0, audioVerdict: null });
    expect(v.verdict).toBe('review_required');
    expect(v.reasons).toEqual(['frames_low_confidence']);
    expect(v.counts.audio_not_preserved).toBe(0);
  });

  it('doan flicker CHUA duoc review => review_required', () => {
    const v = qualityReviewVerdict({ timeline: okTimeline, unreviewedFlicker: 3, audioVerdict: AUDIO_OK });
    expect(v.verdict).toBe('review_required');
    expect(v.counts.flicker_unreviewed).toBe(3);
  });

  it('ly do phai CU THE de UI noi duoc "12 frame do tin cay thap", khong chi mot nhan chung', () => {
    const states = new Map<number, FrameState>();
    for (let i = 0; i < 12; i += 1) states.set(i, 'frame_low_confidence');
    for (let i = 12; i < 50; i += 1) states.set(i, 'frame_tracked');
    const v = qualityReviewVerdict({ timeline: summariseTimeline(50, states), unreviewedFlicker: 0, audioVerdict: AUDIO_OK });
    expect(v.counts.frames_low_confidence).toBe(12);
    expect(v.reasons).toEqual(['frames_low_confidence']);
  });

  it('nguong confidence nam TUONG MINH mot cho, khong an trong logic', () => {
    expect(FRAME_CONFIDENCE_THRESHOLD).toBeGreaterThan(0);
    expect(FRAME_CONFIDENCE_THRESHOLD).toBeLessThan(1);
  });
});
