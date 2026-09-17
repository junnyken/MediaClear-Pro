/**
 * UI Phase 4 — hop dong va cong chan, kiem o muc logic thuan.
 *
 * Man hinh that da duoc bam tay tren Chrome; bo test nay canh nhung LUAT ma bam tay khong lap lai
 * duoc moi lan: nut tai ve chi mo khi cong noi `completed`, va phan hoi sai hinh dang bi chan.
 */
import { describe, expect, it } from 'vitest';
import {
  FRAME_TRACKING_VIEW_SCHEMA,
  QUALITY_GATE_REASONS,
  qualityReviewVerdict,
  summariseTimeline,
  type FrameState,
} from '@mediaclear/contracts';
import { MESSAGES } from '@mediaclear/i18n';

const counts0 = () => Object.fromEntries(QUALITY_GATE_REASONS.map((r) => [r, 0]));
const view = (patch: Record<string, unknown> = {}) => ({
  jobId: 'job_1', jobState: 'review_required',
  timeline: { expectedFrameCount: 2, reportedFrameCount: 2, missing: 0, lowConfidence: 0, reviewRequired: 0, failed: 0, ok: 2, canComplete: true },
  frames: [{ index: 0, state: 'frame_tracked', box: { x: 0, y: 0, width: 1, height: 1 }, confidence: 0.9, source: 'tracked' }],
  gate: { verdict: 'completed', reasons: [], counts: counts0() },
  ...patch,
});

/** Dung LUAT ma man hinh dung: nut tai ve chi mo khi cong noi `completed`. */
const canExport = (verdict: string): boolean => verdict === 'completed';

describe('UI Phase 4 — cong chan tai ve', () => {
  it('con frame do tin cay thap => KHONG cho tai ve', () => {
    const states = new Map<number, FrameState>([[0, 'frame_low_confidence'], [1, 'frame_tracked']]);
    const gate = qualityReviewVerdict({ timeline: summariseTimeline(2, states), unreviewedFlicker: 0, audioVerdict: 'preserved' });
    expect(canExport(gate.verdict), 'mo nut tai ve khi con frame chua dat').toBe(false);
  });

  it('audio bi mat => KHONG cho tai ve', () => {
    const states = new Map<number, FrameState>([[0, 'frame_tracked'], [1, 'frame_tracked']]);
    const gate = qualityReviewVerdict({ timeline: summariseTimeline(2, states), unreviewedFlicker: 0, audioVerdict: 'lost' });
    expect(canExport(gate.verdict)).toBe(false);
  });

  it('con frame THIEU => KHONG cho tai ve, va so luong thieu phai hien duoc', () => {
    const states = new Map<number, FrameState>([[0, 'frame_tracked']]);
    const summary = summariseTimeline(5, states);
    const gate = qualityReviewVerdict({ timeline: summary, unreviewedFlicker: 0, audioVerdict: 'preserved' });
    expect(canExport(gate.verdict)).toBe(false);
    expect(gate.counts.frames_missing, 'UI phai noi duoc "thieu 4", khong chi "co loi"').toBe(4);
  });

  it('du dieu kien => cho tai ve', () => {
    const states = new Map<number, FrameState>([[0, 'frame_tracked'], [1, 'frame_correction_applied']]);
    const gate = qualityReviewVerdict({ timeline: summariseTimeline(2, states), unreviewedFlicker: 0, audioVerdict: 'preserved' });
    expect(canExport(gate.verdict)).toBe(true);
  });

  it('phan hoi SAI ENUM hoac THIEU TRUONG bi chan — trang khong crash', () => {
    expect(FRAME_TRACKING_VIEW_SCHEMA.check(view()).ok).toBe(true);
    expect(FRAME_TRACKING_VIEW_SCHEMA.check(view({ jobState: 'khong_co_that' })).ok).toBe(false);
    const { gate, ...thieu } = view();
    void gate;
    expect(FRAME_TRACKING_VIEW_SCHEMA.check(thieu).ok).toBe(false);
  });

  it('MOI ly do cua cong deu co cau chu o CA HAI ngon ngu', () => {
    const thieu = QUALITY_GATE_REASONS.filter(
      (r) => MESSAGES.vi[`gate_reason.${r}`] === undefined || MESSAGES.en[`gate_reason.${r}`] === undefined,
    );
    expect(thieu, 'ly do khong co nhan => man hinh hien khoa tho').toEqual([]);
  });
});
