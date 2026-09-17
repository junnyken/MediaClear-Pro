/**
 * Shared contract cho Phase 4 (`D-047` ap dung lai).
 *
 * UI va may chu KHONG duoc co hai khai bao roi nhau cho frame state. Bo test nay chung minh hai
 * dieu: (1) chi co MOT nguon su that; (2) phan hoi sai enum hoac thieu truong bi CHAN luc chay,
 * chu khong lot qua roi lam hong man hinh.
 */
import { describe, expect, it } from 'vitest';
import {
  FRAME_STATES,
  MASK_SOURCES,
  QUALITY_GATE_REASONS,
  QUALITY_GATE_VERDICTS,
} from '../src/phase4.js';
import {
  FRAME_STATE_SCHEMA,
  FRAME_TRACKING_VIEW_SCHEMA,
  FRAME_VIEW_SCHEMA,
  QUALITY_GATE_SCHEMA,
} from '../src/api-schemas.js';
import { checkEnvelope } from '../src/schema.js';

const frame = (patch: Record<string, unknown> = {}) => ({
  index: 0, state: 'frame_tracked', box: { x: 0, y: 0, width: 1, height: 1 },
  confidence: 0.9, source: 'tracked', ...patch,
});

describe('Phase 4 — shared contract UI ↔ may chu', () => {
  it('schema frame state lay THANG tu FRAME_STATES, khong phai ban chep tay', () => {
    for (const s of FRAME_STATES) expect(FRAME_STATE_SCHEMA.check(s).ok).toBe(true);
    expect(FRAME_STATES).toHaveLength(5);
  });

  it('SAI ENUM bi chan luc chay', () => {
    expect(FRAME_STATE_SCHEMA.check('frame_done').ok, 'enum la van lot qua').toBe(false);
    expect(FRAME_VIEW_SCHEMA.check(frame({ state: 'frame_done' })).ok).toBe(false);
    expect(FRAME_VIEW_SCHEMA.check(frame({ source: 'guessed' })).ok).toBe(false);
  });

  it('THIEU TRUONG bi chan; truong THUA thi bo qua', () => {
    const { confidence, ...thieu } = frame();
    void confidence;
    expect(FRAME_VIEW_SCHEMA.check(thieu).ok, 'thieu truong van lot qua => man hinh hong luc chay').toBe(false);
    expect(FRAME_VIEW_SCHEMA.check(frame({ truongLa: 1 })).ok, 'truong thua khong duoc lam hong giao dien cu').toBe(true);
  });

  it('`confidence: null` HOP LE — khac han thieu truong', () => {
    expect(FRAME_VIEW_SCHEMA.check(frame({ confidence: null })).ok).toBe(true);
    // Nhung `confidence` kieu chuoi thi khong.
    expect(FRAME_VIEW_SCHEMA.check(frame({ confidence: '0.9' })).ok).toBe(false);
  });

  it('cong chan chat luong: du ly do, du bo dem', () => {
    const counts = Object.fromEntries(QUALITY_GATE_REASONS.map((r) => [r, 0]));
    expect(QUALITY_GATE_SCHEMA.check({ verdict: 'completed', reasons: [], counts }).ok).toBe(true);
    // Thieu mot ly do trong `counts` => UI khong noi cu the duoc => phai bi chan.
    const { audio_not_preserved, ...thieu } = counts;
    void audio_not_preserved;
    expect(QUALITY_GATE_SCHEMA.check({ verdict: 'completed', reasons: [], counts: thieu }).ok).toBe(false);
    expect(QUALITY_GATE_SCHEMA.check({ verdict: 'done', reasons: [], counts }).ok).toBe(false);
  });

  it('phan hoi day du di qua duoc envelope thuc te', () => {
    const body = {
      ok: true,
      data: {
        jobId: 'job_1', jobState: 'review_required',
        timeline: { expectedFrameCount: 2, reportedFrameCount: 2, missing: 0, lowConfidence: 1, reviewRequired: 0, failed: 0, ok: 1, canComplete: false },
        frames: [frame(), frame({ index: 1, state: 'frame_low_confidence', confidence: 0.2 })],
        gate: { verdict: 'review_required', reasons: ['frames_low_confidence'], counts: Object.fromEntries(QUALITY_GATE_REASONS.map((r) => [r, r === 'frames_low_confidence' ? 1 : 0])) },
      },
    };
    expect(checkEnvelope(FRAME_TRACKING_VIEW_SCHEMA, body).ok).toBe(true);
  });

  it('danh sach gia tri CO THE co duoc khai bao rieng (D-046)', () => {
    expect(QUALITY_GATE_VERDICTS).toContain('completed');
    expect(QUALITY_GATE_VERDICTS).toContain('failed');
    expect(MASK_SOURCES).toContain('interpolated');
  });
});
