/**
 * P1.1-MCP-17: han cua usage reservation.
 * Bien INCLUSIVE: dung moc expiresAt van con hieu luc, qua 1 mili giay moi het.
 */
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_RESERVATION_TRANSITIONS,
  EXPIRY_RELEASE_REASON,
  RESERVATION_STATES,
  USAGE_RESERVATION_TTL_SECONDS,
  canCommitUsage,
  canTransitionReservation,
  expirableReservationJobIds,
  isReservationExpired,
  reservationExpiresAt,
  reservationViewOf,
  type LedgerEntryLike,
} from '../src/index.js';

const RESERVED_AT = '2026-09-15T10:00:00.000Z';
const EXPIRES_AT = reservationExpiresAt(RESERVED_AT);

function reserve(jobId = 'job_1', expiresAt: string | null = EXPIRES_AT): LedgerEntryLike {
  return {
    jobId,
    entryType: 'reserve',
    unitType: 'image_unit',
    quantity: 1,
    idempotencyKey: `${jobId}:reserve`,
    recordedAt: RESERVED_AT,
    expiresAt,
  };
}
function release(jobId = 'job_1', reasonCode = 'cancelled'): LedgerEntryLike {
  return {
    jobId,
    entryType: 'release',
    unitType: 'image_unit',
    quantity: 1,
    idempotencyKey: `${jobId}:release`,
    recordedAt: '2026-09-15T10:05:00.000Z',
    reasonCode,
    expiresAt: null,
  };
}
function commit(jobId = 'job_1'): LedgerEntryLike {
  return {
    jobId,
    entryType: 'commit',
    unitType: 'image_unit',
    quantity: 1,
    idempotencyKey: `${jobId}:commit`,
    recordedAt: '2026-09-15T10:05:00.000Z',
    expiresAt: null,
  };
}

describe('TTL cua reservation', () => {
  it('TTL chot o 1800 giay va expiresAt = reservedAt + 1800s', () => {
    expect(USAGE_RESERVATION_TTL_SECONDS).toBe(1800);
    expect(EXPIRES_AT).toBe('2026-09-15T10:30:00.000Z');
  });

  it('bien: 1799s chua het, dung 1800s CHUA het, 1801s moi het', () => {
    const at = (seconds: number) => new Date(new Date(RESERVED_AT).getTime() + seconds * 1000);
    expect(isReservationExpired(EXPIRES_AT, at(1799))).toBe(false);
    expect(isReservationExpired(EXPIRES_AT, at(1800))).toBe(false);
    expect(isReservationExpired(EXPIRES_AT, at(1801))).toBe(true);
  });

  it('cung moc thoi gian viet o mui gio khac cho cung ket qua', () => {
    // 10:30Z == 17:30+07:00. Hai chuoi khac nhau, cung mot thoi diem.
    const utc = reservationExpiresAt('2026-09-15T10:00:00.000Z');
    const plus7 = reservationExpiresAt('2026-09-15T17:00:00.000+07:00');
    expect(new Date(utc).getTime()).toBe(new Date(plus7).getTime());
    const justAfter = new Date('2026-09-15T17:30:00.001+07:00');
    expect(isReservationExpired(utc, justAfter)).toBe(true);
  });

  it('but toan cu khong co expiresAt thi KHONG bi coi la het han', () => {
    expect(isReservationExpired(null, new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('Trang thai reservation suy ra tu ledger', () => {
  it('chi co reserve va con han => reserved', () => {
    const view = reservationViewOf('job_1', [reserve()], new Date('2026-09-15T10:10:00.000Z'));
    expect(view?.state).toBe('reserved');
    expect(view?.reservedAt).toBe(RESERVED_AT);
    expect(view?.expiresAt).toBe(EXPIRES_AT);
  });

  it('qua han ma chua hoan tra => expired (khoan treo phai lo ra)', () => {
    const view = reservationViewOf('job_1', [reserve()], new Date('2026-09-15T11:00:00.000Z'));
    expect(view?.state).toBe('expired');
    expect(view?.releasedAt).toBeNull();
  });

  it('da hoan tra => released kem ly do va moc hoan tra', () => {
    const view = reservationViewOf('job_1', [reserve(), release('job_1', EXPIRY_RELEASE_REASON)], new Date('2026-09-15T11:00:00.000Z'));
    expect(view?.state).toBe('released');
    expect(view?.releaseReason).toBe('expired');
    expect(view?.releasedAt).toBe('2026-09-15T10:05:00.000Z');
  });

  it('da commit => committed, khong bi dong ho lam doi', () => {
    const view = reservationViewOf('job_1', [reserve(), commit()], new Date('2030-01-01T00:00:00.000Z'));
    expect(view?.state).toBe('committed');
  });

  it('khong co but toan reserve => khong co reservation', () => {
    expect(reservationViewOf('job_khac', [reserve()], new Date())).toBeNull();
  });
});

describe('Transition cua reservation', () => {
  it('bang transition phu het cac trang thai', () => {
    expect(Object.keys(ALLOWED_RESERVATION_TRANSITIONS).sort()).toEqual([...RESERVATION_STATES].sort());
  });

  it('cho phep: reserved->expired, expired->released, reserved->released, reserved->committed', () => {
    for (const [from, to] of [
      ['reserved', 'expired'],
      ['expired', 'released'],
      ['reserved', 'released'],
      ['reserved', 'committed'],
    ] as const) {
      expect(canTransitionReservation(from, to).allowed, `${from}->${to}`).toBe(true);
    }
  });

  it('CAM: released->committed, expired->committed, committed->released, released->reserved', () => {
    for (const [from, to] of [
      ['released', 'committed'],
      ['expired', 'committed'],
      ['committed', 'released'],
      ['released', 'reserved'],
    ] as const) {
      const result = canTransitionReservation(from, to);
      expect(result.allowed, `${from}->${to} phai bi cam`).toBe(false);
      expect(result.error).not.toBeNull();
    }
  });
});

describe('Khong commit duoc khoan da het han', () => {
  it('con han => cho commit', () => {
    const result = canCommitUsage('job_1', [reserve()], new Date('2026-09-15T10:10:00.000Z'));
    expect(result.allowed).toBe(true);
  });

  it('het han => tu choi bang dung ma loi', () => {
    const result = canCommitUsage('job_1', [reserve()], new Date('2026-09-15T11:00:00.000Z'));
    expect(result.allowed).toBe(false);
    expect(result.error?.code).toBe('MCP_USAGE_RESERVATION_EXPIRED');
  });

  it('da hoan tra => van khong commit duoc (I-8)', () => {
    const result = canCommitUsage('job_1', [reserve(), release()], new Date('2026-09-15T10:10:00.000Z'));
    expect(result.allowed).toBe(false);
  });

  it('khong truyen dong ho => giu nguyen hanh vi cu cua Phase 0', () => {
    expect(canCommitUsage('job_1', [reserve()]).allowed).toBe(true);
  });
});

describe('Tim khoan qua han de hoan tra', () => {
  it('chi lay khoan qua han VA chua hoan tra', () => {
    const entries = [
      reserve('job_con_han', reservationExpiresAt('2026-09-15T12:00:00.000Z')),
      reserve('job_qua_han'),
      reserve('job_da_tra'),
      release('job_da_tra'),
      reserve('job_da_commit'),
      commit('job_da_commit'),
    ];
    const now = new Date('2026-09-15T11:00:00.000Z');
    expect(expirableReservationJobIds(entries, now)).toEqual(['job_qua_han']);
  });

  it('chay lai sau khi da hoan tra => khong con gi de lam (idempotent)', () => {
    const entries = [reserve('job_qua_han'), release('job_qua_han', EXPIRY_RELEASE_REASON)];
    expect(expirableReservationJobIds(entries, new Date('2026-09-15T11:00:00.000Z'))).toEqual([]);
  });
});
