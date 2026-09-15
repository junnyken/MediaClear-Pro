/**
 * P1.1-MCP-18: luat luu giu du lieu.
 * Moi luat mot test, moi bien kiem HAI phia (chua toi han / da qua han).
 */
import { describe, expect, it } from 'vitest';
import {
  RETENTION_DATA_CLASSES,
  RETENTION_REASONS,
  RETENTION_RULES,
  RETENTION_STATES,
  retentionDecisionFor,
  retentionDryRun,
  type RetentionDataClass,
  type RetentionSubject,
} from '../src/index.js';

const NOW = new Date('2026-09-15T10:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

function subject(patch: Partial<RetentionSubject> = {}): RetentionSubject {
  return {
    id: 'src_1',
    workspaceId: 'wsp_1',
    dataClass: 'source_asset',
    createdAt: daysAgo(100),
    lastAccessedAt: daysAgo(1),
    deletedAt: null,
    retentionState: 'active',
    legalHoldAt: null,
    byteSize: 1000,
    ...patch,
  };
}

describe('Luat luu giu theo tung lop du lieu', () => {
  it('moi lop deu co luat, khong lop nao bi bo quen', () => {
    for (const dataClass of RETENTION_DATA_CLASSES) {
      expect(RETENTION_RULES[dataClass as RetentionDataClass], dataClass).toBeDefined();
    }
    expect(RETENTION_STATES).toEqual(['active', 'scheduled_for_deletion', 'deleted', 'legal_hold']);
  });

  it('source: 29 ngay khong dung toi CHUA phai ung vien, 31 ngay thi phai', () => {
    expect(retentionDecisionFor(subject({ lastAccessedAt: daysAgo(29) }), NOW).isCandidate).toBe(false);
    const over = retentionDecisionFor(subject({ lastAccessedAt: daysAgo(31) }), NOW);
    expect(over.isCandidate).toBe(true);
    expect(over.reason).toBe(RETENTION_REASONS.SOURCE_INACTIVE);
  });

  it('source: dung moc 30 ngay van con duoc giu (bien inclusive)', () => {
    expect(retentionDecisionFor(subject({ lastAccessedAt: daysAgo(30) }), NOW).isCandidate).toBe(false);
  });

  it('source: tao lau nhung MOI truy cap thi khong bi don (tinh theo truy cap, khong theo ngay tao)', () => {
    const old = subject({ createdAt: daysAgo(400), lastAccessedAt: daysAgo(2) });
    expect(retentionDecisionFor(old, NOW).isCandidate).toBe(false);
  });

  it('source: chua tung duoc truy cap thi lay ngay tao lam moc', () => {
    expect(retentionDecisionFor(subject({ lastAccessedAt: null, createdAt: daysAgo(31) }), NOW).isCandidate).toBe(true);
    expect(retentionDecisionFor(subject({ lastAccessedAt: null, createdAt: daysAgo(10) }), NOW).isCandidate).toBe(false);
  });

  it('output dung dung luat truy cap nhu source', () => {
    const out = subject({ dataClass: 'output_asset', lastAccessedAt: daysAgo(31) });
    expect(retentionDecisionFor(out, NOW).reason).toBe(RETENTION_REASONS.OUTPUT_INACTIVE);
    expect(retentionDecisionFor(subject({ dataClass: 'output_asset', lastAccessedAt: daysAgo(29) }), NOW).isCandidate).toBe(false);
  });

  it('tep trung gian/that bai dung luat 7 ngay tinh tu luc tao', () => {
    expect(retentionDecisionFor(subject({ dataClass: 'failed_intermediate', createdAt: daysAgo(6) }), NOW).isCandidate).toBe(false);
    const over = retentionDecisionFor(subject({ dataClass: 'failed_intermediate', createdAt: daysAgo(8) }), NOW);
    expect(over.isCandidate).toBe(true);
    expect(over.reason).toBe(RETENTION_REASONS.FAILED_INTERMEDIATE);
  });

  it('ban xem thu dung luat 24 gio', () => {
    expect(retentionDecisionFor(subject({ dataClass: 'preview_proxy', createdAt: hoursAgo(23) }), NOW).isCandidate).toBe(false);
    const over = retentionDecisionFor(subject({ dataClass: 'preview_proxy', createdAt: hoursAgo(25) }), NOW);
    expect(over.isCandidate).toBe(true);
    expect(over.reason).toBe(RETENTION_REASONS.PREVIEW_EXPIRED);
  });

  it('dau vet cua tep da xoa giu 30 ngay roi moi thanh ung vien', () => {
    const fresh = subject({ dataClass: 'deleted_tombstone', retentionState: 'deleted', deletedAt: daysAgo(29) });
    const old = subject({ dataClass: 'deleted_tombstone', retentionState: 'deleted', deletedAt: daysAgo(31) });
    expect(retentionDecisionFor(fresh, NOW).isCandidate).toBe(false);
    expect(retentionDecisionFor(old, NOW).reason).toBe(RETENTION_REASONS.TOMBSTONE_EXPIRED);
  });

  it('audit event KHONG bao gio bi don theo retention cua asset', () => {
    const audit = subject({ dataClass: 'audit_event', createdAt: daysAgo(400), lastAccessedAt: null });
    const decision = retentionDecisionFor(audit, NOW);
    expect(decision.isCandidate).toBe(false);
    expect(decision.reason).toBe(RETENTION_REASONS.NOT_ASSET_SCOPED);
  });

  it('so sach muc dung giu 24 thang va cung khong bi don theo asset', () => {
    expect(RETENTION_RULES.usage_ledger.windowMs).toBe(730 * 86_400_000);
    const ledger = subject({ dataClass: 'usage_ledger', createdAt: daysAgo(800) });
    expect(retentionDecisionFor(ledger, NOW).isCandidate).toBe(false);
  });

  it('giu theo yeu cau phap ly thi KHONG BAO GIO la ung vien, du qua han bao lau', () => {
    const held = subject({ lastAccessedAt: daysAgo(999), retentionState: 'legal_hold', legalHoldAt: daysAgo(500) });
    const decision = retentionDecisionFor(held, NOW);
    expect(decision.isCandidate).toBe(false);
    expect(decision.reason).toBe(RETENTION_REASONS.LEGAL_HOLD_EXCLUDED);
  });

  it('chi can co moc legal hold la duoc loai tru, khong phu thuoc trang thai', () => {
    const held = subject({ lastAccessedAt: daysAgo(999), legalHoldAt: daysAgo(1) });
    expect(retentionDecisionFor(held, NOW).isCandidate).toBe(false);
  });

  it('tep da xoa khong bi tinh lai nhu tep dang song', () => {
    const deleted = subject({ retentionState: 'deleted', deletedAt: daysAgo(1), lastAccessedAt: daysAgo(999) });
    expect(retentionDecisionFor(deleted, NOW).reason).toBe(RETENTION_REASONS.ALREADY_DELETED);
  });
});

describe('Bao cao thu-khong-xoa', () => {
  const subjects = [
    subject({ id: 'a', lastAccessedAt: daysAgo(40) }),
    subject({ id: 'b', lastAccessedAt: daysAgo(35) }),
    subject({ id: 'c', lastAccessedAt: daysAgo(1) }),
    subject({ id: 'd', lastAccessedAt: daysAgo(999), legalHoldAt: daysAgo(2), retentionState: 'legal_hold' }),
    subject({ id: 'e', workspaceId: 'wsp_khac', lastAccessedAt: daysAgo(99) }),
  ];

  it('dem dung ung vien va luon tu khai la ban thu', () => {
    const report = retentionDryRun(subjects, { asOf: NOW });
    expect(report.dryRun).toBe(true);
    expect(report.candidateCount).toBe(3);
    expect(report.byReason[RETENTION_REASONS.LEGAL_HOLD_EXCLUDED]).toBe(1);
    // 'd' cu hon nhung dang legal hold nen KHONG phai ung vien => ung vien cu nhat la 'e'.
    expect(report.oldestCandidateAt).toBe(daysAgo(99));
    expect(report.wouldDeleteBytes).toBe(3000);
    expect(report.scannedCount).toBe(5);
  });

  it('loc duoc theo workspace', () => {
    const report = retentionDryRun(subjects, { asOf: NOW, workspaceId: 'wsp_khac' });
    expect(report.scannedCount).toBe(1);
    expect(report.candidateCount).toBe(1);
  });

  it('khong do duoc dung luong thi bao null, khong bao 0', () => {
    const report = retentionDryRun([subject({ id: 'x', lastAccessedAt: daysAgo(40), byteSize: null })], { asOf: NOW });
    expect(report.wouldDeleteBytes).toBeNull();
  });

  it('khong ban ghi nao bi doi: ham chi doc', () => {
    const before = JSON.stringify(subjects);
    retentionDryRun(subjects, { asOf: NOW });
    expect(JSON.stringify(subjects)).toBe(before);
  });
});
