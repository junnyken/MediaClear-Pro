/**
 * UI Phase 4 — hop dong va cong chan, kiem o muc logic thuan.
 *
 * Man hinh that da duoc bam tay tren Chrome; bo test nay canh nhung LUAT ma bam tay khong lap lai
 * duoc moi lan: nut tai ve chi mo khi cong noi `completed`, va phan hoi sai hinh dang bi chan.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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
  lastCorrection: null,
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

/**
 * `D-073` — man hinh kiem khung hinh phai CO DUONG DI TOI.
 *
 * Mot man hinh chay dung nhung khong lien ket tu dau ca thi voi nguoi dung no khong ton tai.
 * `/jobs/:id/frames` da o trong tinh trang do suot Phase 4: toan bo test xanh, ban than man hinh
 * hoat dong, nhung cach duy nhat vao duoc la go tay URL. Bam tay moi lo ra, vi khong test nao hoi
 * cau "nguoi dung di toi day bang cach nao".
 *
 * Phep chan nay doc MA NGUON chu khong doc DOM: no phai do duoc ngay ca khi khong dung trinh duyet.
 */
describe('D-073 — duong di toi man hinh kiem khung hinh', () => {
  const APP = join(import.meta.dirname, '../app');

  function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
      else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
    }
    return out;
  }

  it('co it nhat mot lien ket tro toi `/jobs/:id/frames` tu man hinh KHAC', () => {
    const linkers = sourceFiles(APP)
      .filter((f) => !f.includes(join('jobs', '[jobId]', 'frames')))
      .filter((f) => /href=\{?[`'"]\/jobs\/\$\{[^}]+\}\/frames/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(APP, 'app'));
    expect(linkers, 'man hinh kiem khung hinh khong co loi vao — nguoi dung phai go tay URL')
      .not.toEqual([]);
  });

  it('lien ket do nam o nhanh `review_required`, dung cho nguoi dung can no', () => {
    const text = readFileSync(join(APP, 'jobs/[jobId]/page.tsx'), 'utf8');
    const start = text.indexOf('needsReview ? (');
    expect(start, 'khong tim thay nhanh review_required').toBeGreaterThan(0);
    // Cat den `</Card>` chu KHONG den `) : null}` dau tien: nhanh audio ben trong cung ket thuc
    // bang `) : null}`, nen moc do cat cut mat phan con lai cua the.
    const block = text.slice(start, text.indexOf('</Card>', start));
    expect(block, 'lien ket co ton tai nhung khong nam o cho nguoi dung dang bi chan').toContain('/frames');
  });
});

/**
 * `D-074` — luu xong thi man hinh phai NAP LAI.
 *
 * Mot lan sua nay dong toi NHIEU frame (frame duoc sua + cac frame lan can duoc tinh lai), nen
 * giu lai man hinh cu sau khi luu thanh cong khong con la "hoi cham mot nhip" — no hien mot
 * timeline khac han voi thu vua duoc ghi xuong kho.
 *
 * Doi chung am `NC9` cho thay: go `resource.reload()` di thi TOAN BO bo test van xanh. Khong phep
 * do nao hoi cau "sau khi luu, man hinh co con dung khong".
 */
describe('D-074 — man hinh nap lai sau khi luu', () => {
  const PAGE = join(import.meta.dirname, '../app/jobs/[jobId]/frames/page.tsx');

  it('nhanh luu THANH CONG co nap lai du lieu tu may chu', () => {
    const text = readFileSync(PAGE, 'utf8');
    const start = text.indexOf('async function save(');
    expect(start, 'khong tim thay ham luu').toBeGreaterThan(0);
    const body = text.slice(start, text.indexOf('\n  }', start));

    // Nhanh loi phai thoat truoc; phan CON LAI la nhanh thanh cong.
    const guard = body.indexOf('if (!result.ok)');
    expect(guard, 'khong tim thay nhanh xu ly loi').toBeGreaterThan(0);
    const nhanhThanhCong = body.slice(body.indexOf('}', guard));

    expect(
      /reload\(\)|setData\(|mutate\(/.test(nhanhThanhCong),
      'luu xong ma man hinh khong nap lai => nguoi dung nhin mot timeline da cu',
    ).toBe(true);
  });
});
