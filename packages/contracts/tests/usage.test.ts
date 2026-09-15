import { describe, expect, it } from 'vitest';
import { PREVIEW_IS_BILLABLE, VIDEO_USAGE_ROUNDING } from '../src/config.js';
import {
  canCommitUsage,
  canReserveUsage,
  computeUsageQuantity,
  usageEffectOfError,
  usageOutcomeForJobState,
  type LedgerEntryLike,
} from '../src/usage.js';

const entry = (over: Partial<LedgerEntryLike> & { entryType: LedgerEntryLike['entryType'] }): LedgerEntryLike => ({
  jobId: 'j1',
  unitType: 'image_unit',
  quantity: 1,
  idempotencyKey: `j1:${over.entryType}`,
  ...over,
});

describe('MCP-07 usage ledger (owner decision Q-10)', () => {
  it('image = 1 image_unit', () => {
    const r = computeUsageQuantity({ mediaType: 'image', durationSeconds: null });
    expect(r.ok && r.value).toEqual({ unitType: 'image_unit', quantity: 1 });
  });

  it('video lam tron LEN theo phut xu ly', () => {
    expect(VIDEO_USAGE_ROUNDING).toBe('ceil_minute');
    const cases: Array<[number, number]> = [
      [1, 1],
      [59, 1],
      [60, 1],
      [61, 2],
      [599, 10],
    ];
    for (const [seconds, expected] of cases) {
      const r = computeUsageQuantity({ mediaType: 'video', durationSeconds: seconds });
      expect(r.ok && r.value.quantity).toBe(expected);
    }
  });

  it('video khong biet duration => bao unknown, KHONG doan quantity', () => {
    const r = computeUsageQuantity({ mediaType: 'video', durationSeconds: null });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe('MCP_USAGE_QUANTITY_UNKNOWN');
  });

  it('preview mien phi (I-12)', () => {
    expect(PREVIEW_IS_BILLABLE).toBe(false);
  });

  it('reserve lan hai tren cung job => reservation conflict', () => {
    expect(canReserveUsage('j1', []).allowed).toBe(true);
    const r = canReserveUsage('j1', [entry({ entryType: 'reserve' })]);
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_USAGE_RESERVATION_CONFLICT');
  });

  it('commit khong co reserve => tu choi (job fail truoc provider khong bi tinh tien)', () => {
    const r = canCommitUsage('j1', []);
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_USAGE_RESERVE_MISSING');
  });

  it('commit lan hai tren cung job => chan double charge (I-8)', () => {
    const entries = [entry({ entryType: 'reserve' }), entry({ entryType: 'commit' })];
    const r = canCommitUsage('j1', entries);
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_USAGE_DOUBLE_COMMIT');
  });

  it('da release thi khong duoc commit lai tren cung reserve', () => {
    const entries = [entry({ entryType: 'reserve' }), entry({ entryType: 'release' })];
    expect(canCommitUsage('j1', entries).allowed).toBe(false);
  });

  it('provider error => release, khong tinh nhu success (I-7)', () => {
    expect(usageOutcomeForJobState('failed', 'provider_error')).toEqual({
      entryType: 'release',
      reasonCode: 'provider_error',
    });
    expect(usageOutcomeForJobState('blocked', null).entryType).toBe('release');
    expect(usageOutcomeForJobState('completed', null).entryType).toBe('commit');
  });

  it('hanh vi usage cua tung ma loi doc tu error catalogue', () => {
    expect(usageEffectOfError('MCP_PROVIDER_TIMEOUT')).toEqual({
      releasesReservation: true,
      retryAllowed: true,
    });
    expect(usageEffectOfError('MCP_VAL_FILE_TOO_LARGE')).toEqual({
      releasesReservation: true,
      retryAllowed: false,
    });
    expect(usageEffectOfError('MCP_USAGE_DOUBLE_COMMIT').releasesReservation).toBe(false);
  });
});
