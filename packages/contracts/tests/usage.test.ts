import { describe, expect, it } from 'vitest';
import {
  PREVIEW_IS_BILLABLE,
  canCommitUsage,
  computeUsageQuantity,
  usageOutcomeForJobState,
  type LedgerEntryLike,
} from '../src/usage.js';

const reserve = (jobId: string): LedgerEntryLike => ({
  jobId,
  entryType: 'reserve',
  unitType: 'image_unit',
  quantity: 1,
  idempotencyKey: `${jobId}:reserve`,
});

describe('MCP-07 usage ledger', () => {
  it('image = 1 image_unit', () => {
    const r = computeUsageQuantity({ mediaType: 'image', durationSeconds: null });
    expect(r.ok && r.value).toEqual({ unitType: 'image_unit', quantity: 1 });
  });

  it('video lam tron LEN theo phut', () => {
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

  it('preview khong tinh phi', () => {
    expect(PREVIEW_IS_BILLABLE).toBe(false);
  });

  it('commit khong co reserve => tu choi', () => {
    const r = canCommitUsage('j1', []);
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_USAGE_RESERVE_MISSING');
  });

  it('commit lan hai tren cung job => chan double charge (I-7)', () => {
    const entries: LedgerEntryLike[] = [
      reserve('j1'),
      { ...reserve('j1'), entryType: 'commit', idempotencyKey: 'j1:commit' },
    ];
    const r = canCommitUsage('j1', entries);
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_USAGE_DOUBLE_COMMIT');
  });

  it('da release thi khong duoc commit lai tren cung reserve', () => {
    const entries: LedgerEntryLike[] = [
      reserve('j1'),
      { ...reserve('j1'), entryType: 'release', idempotencyKey: 'j1:release' },
    ];
    expect(canCommitUsage('j1', entries).allowed).toBe(false);
  });

  it('provider error => release, khong tinh nhu success (I-6)', () => {
    expect(usageOutcomeForJobState('failed', 'provider_error')).toEqual({
      entryType: 'release',
      reasonCode: 'provider_error',
    });
    expect(usageOutcomeForJobState('blocked', null).entryType).toBe('release');
    expect(usageOutcomeForJobState('completed', null).entryType).toBe('commit');
  });
});
