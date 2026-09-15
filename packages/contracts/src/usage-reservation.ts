/**
 * MediaClear Pro - Trang thai cua usage reservation (P1.1-MCP-17).
 *
 * NGUYEN TAC: trang thai reservation duoc SUY RA tu ledger + dong ho, khong luu
 * thanh cot thu hai. Ledger la append-only va la nguon su that duy nhat; neu co
 * them mot cot trang thai thi se co luc hai nguon noi khac nhau.
 *
 * PHAN BIET RO: `ProcessingJob.state` va `UsageReservation.state` la HAI thu khac
 * nhau. Reservation het han KHONG doi state cua job.
 */
import { USAGE_RESERVATION_TTL_SECONDS } from './config.js';
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { LedgerEntryLike, ReleaseReason } from './usage.js';

export const RESERVATION_STATES = ['reserved', 'expired', 'released', 'committed'] as const;
export type ReservationState = (typeof RESERVATION_STATES)[number];

/**
 * Transition hop le. Luu y `expired` la trang thai DAN XUAT theo dong ho:
 * mot reservation qua han nhung chua ghi but toan hoan tra van la 'expired'.
 */
export const ALLOWED_RESERVATION_TRANSITIONS: Readonly<Record<ReservationState, readonly ReservationState[]>> = {
  reserved: ['expired', 'released', 'committed'],
  expired: ['released'],
  released: [],
  committed: [],
};

export function canTransitionReservation(
  from: ReservationState,
  to: ReservationState,
): { allowed: boolean; error: ApiError | null } {
  if (ALLOWED_RESERVATION_TRANSITIONS[from].includes(to)) {
    return { allowed: true, error: null };
  }
  const code =
    to === 'committed' ? ERROR_CODES.MCP_USAGE_RESERVATION_EXPIRED : ERROR_CODES.MCP_STATE_INVALID_TRANSITION;
  return { allowed: false, error: apiError(code, { from, to }) };
}

/** expiresAt = reservedAt + TTL. Mot cho duy nhat tinh gia tri nay. */
export function reservationExpiresAt(reservedAt: string): string {
  return new Date(new Date(reservedAt).getTime() + USAGE_RESERVATION_TTL_SECONDS * 1000).toISOString();
}

/**
 * Het han chua? Bien INCLUSIVE: dung moc expiresAt van con hieu luc.
 * So sanh bang moc thoi gian tuyet doi nen chuoi ISO o mui gio nao cung cho cung ket qua.
 */
export function isReservationExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  return now.getTime() > new Date(expiresAt).getTime();
}

export interface ReservationView {
  jobId: string;
  state: ReservationState;
  reservedAt: string | null;
  expiresAt: string | null;
  releasedAt: string | null;
  releaseReason: string | null;
  unitType: LedgerEntryLike['unitType'] | null;
  quantity: number;
}

/** Suy trang thai reservation cua mot job tu cac but toan cua chinh job do. */
export function reservationViewOf(
  jobId: string,
  entries: readonly LedgerEntryLike[],
  now: Date,
): ReservationView | null {
  const forJob = entries.filter((e) => e.jobId === jobId);
  const reserve = forJob.find((e) => e.entryType === 'reserve');
  if (!reserve) return null;

  const commit = forJob.find((e) => e.entryType === 'commit');
  const release = forJob.find((e) => e.entryType === 'release');
  const base = {
    jobId,
    reservedAt: reserve.recordedAt ?? null,
    expiresAt: reserve.expiresAt ?? null,
    unitType: reserve.unitType,
    quantity: reserve.quantity,
  };

  if (commit) {
    return { ...base, state: 'committed', releasedAt: null, releaseReason: null };
  }
  if (release) {
    return {
      ...base,
      state: 'released',
      releasedAt: release.recordedAt ?? null,
      releaseReason: release.reasonCode ?? null,
    };
  }
  if (isReservationExpired(reserve.expiresAt, now)) {
    // Da qua han nhung CHUA hoan tra: van la mot khoan dang treo, phai lo ra.
    return { ...base, state: 'expired', releasedAt: null, releaseReason: null };
  }
  return { ...base, state: 'reserved', releasedAt: null, releaseReason: null };
}

/** Ly do hoan tra khi het han. */
export const EXPIRY_RELEASE_REASON: ReleaseReason = 'expired';

/**
 * Cac jobId co reservation da qua han va CHUA duoc hoan tra.
 * Ham thuan => lenh hoan tra chay lai duoc ma khong can trang thai ben ngoai.
 */
export function expirableReservationJobIds(entries: readonly LedgerEntryLike[], now: Date): string[] {
  const jobIds = new Set(entries.filter((e) => e.entryType === 'reserve').map((e) => e.jobId));
  const out: string[] = [];
  for (const jobId of jobIds) {
    const view = reservationViewOf(jobId, entries, now);
    if (view?.state === 'expired') out.push(jobId);
  }
  return out.sort();
}
