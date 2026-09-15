/**
 * MediaClear Pro - Usage ledger & cost measurement contract (MCP-07).
 *
 * Guardrail 17: Phase 0 KHONG thu tien that. Day chi la contract do luong.
 *
 * Dinh nghia don vi (theo prompt muc J):
 *   image_unit        = 1 image processing job duoc CHAP NHAN (output verified)
 *   video_minute_unit = bucket phut duoc lam tron LEN cua video duoc chap nhan
 */
import { ERROR_CODES, apiError, errorDefinition, type ApiError, type ErrorCode } from './errors.js';
import { VIDEO_USAGE_ROUNDING } from './config.js';
import type { MediaType } from './vocabulary.js';

export type UnitType = 'image_unit' | 'video_minute_unit';
export type UsageEntryType = 'reserve' | 'commit' | 'release';

export const RELEASE_REASONS = [
  'provider_error',
  'user_error',
  'validation_failed',
  'cancelled',
  'blocked',
  /** P1.1 (Q-17): reservation qua han 30 phut va duoc hoan tra tu dong. */
  'expired',
] as const;
export type ReleaseReason = (typeof RELEASE_REASONS)[number];

/**
 * Preview KHONG tinh phi - hang so goc nam o config.ts (PREVIEW_IS_BILLABLE),
 * khong dinh nghia lai o day de tranh hai nguon su that.
 * Owner decision Q-10: "Preview is free" + "Preview khong tinh vao video-minute usage".
 */
export const VIDEO_ROUNDING_MODE = VIDEO_USAGE_ROUNDING;

export interface UsageQuantityInput {
  mediaType: MediaType;
  /** Bat buoc cho video. null => khong tinh duoc, phai bao unknown. */
  durationSeconds: number | null;
}

export interface UsageQuantity {
  unitType: UnitType;
  quantity: number;
}

/**
 * Quy doi don vi usage. Video lam tron LEN theo phut (bucket).
 * Nem loi ngu nghia bang cach tra ApiError thay vi doan so.
 */
export function computeUsageQuantity(
  input: UsageQuantityInput,
): { ok: true; value: UsageQuantity } | { ok: false; error: ApiError } {
  if (input.mediaType === 'image') {
    return { ok: true, value: { unitType: 'image_unit', quantity: 1 } };
  }
  if (input.durationSeconds === null || !Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    return { ok: false, error: apiError(ERROR_CODES.MCP_USAGE_QUANTITY_UNKNOWN) };
  }
  return {
    ok: true,
    value: { unitType: 'video_minute_unit', quantity: Math.ceil(input.durationSeconds / 60) },
  };
}

export interface LedgerEntryLike {
  jobId: string;
  entryType: UsageEntryType;
  unitType: UnitType;
  quantity: number;
  idempotencyKey: string;
  /** P1.1: thoi diem ghi but toan. Dung de biet reservedAt/releasedAt. */
  recordedAt?: string;
  /** P1.1: chi co nghia tren but toan 'reserve'. null = but toan cu truoc khi co TTL. */
  expiresAt?: string | null;
  /** Ly do hoan tra, chi co nghia tren but toan 'release'. */
  reasonCode?: string | null;
}

/**
 * Invariant I-7: khong bao gio double-charge khi retry.
 * Quy tac: moi jobId chi duoc dung 1 entry 'commit'. Retry dung lai cung jobId
 * => lan commit thu hai bi tu choi. Job moi (jobId moi) moi tinh phi moi.
 */
export function canCommitUsage(
  jobId: string,
  existingEntries: readonly LedgerEntryLike[],
  /** P1.1: truyen dong ho de chan commit mot reservation DA HET HAN. */
  now?: Date,
): { allowed: boolean; error: ApiError | null } {
  const forJob = existingEntries.filter((e) => e.jobId === jobId);
  if (forJob.some((e) => e.entryType === 'commit')) {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_USAGE_DOUBLE_COMMIT, { jobId }) };
  }
  const reserve = forJob.find((e) => e.entryType === 'reserve');
  if (!reserve) {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_USAGE_RESERVE_MISSING, { jobId }) };
  }
  if (forJob.some((e) => e.entryType === 'release')) {
    // Da hoan tra thi khong duoc commit lai tren cung reserve.
    return { allowed: false, error: apiError(ERROR_CODES.MCP_USAGE_RESERVE_MISSING, { jobId }) };
  }
  // Het han thi khong con gi de commit - phai tao job moi va reservation moi (Q-17).
  if (now && reserve.expiresAt && now.getTime() > new Date(reserve.expiresAt).getTime()) {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_USAGE_RESERVATION_EXPIRED, { jobId }) };
  }
  return { allowed: true, error: null };
}

/**
 * Invariant I-6: provider that bai KHONG duoc tinh nhu thanh cong.
 * Tra ve entryType phai ghi khi job ket thuc o mot state cu the.
 */
export function usageOutcomeForJobState(
  state: 'completed' | 'failed' | 'blocked' | 'cancelled',
  reason: ReleaseReason | null,
): { entryType: UsageEntryType; reasonCode: ReleaseReason | null } {
  if (state === 'completed') {
    return { entryType: 'commit', reasonCode: null };
  }
  return { entryType: 'release', reasonCode: reason ?? (state === 'blocked' ? 'blocked' : 'cancelled') };
}

/**
 * Owner decision Q-10: mot job chi duoc reserve MOT lan.
 * Reserve lan hai (vd do retry gui trung request) => MCP_USAGE_RESERVATION_CONFLICT.
 */
export function canReserveUsage(
  jobId: string,
  existingEntries: readonly LedgerEntryLike[],
): { allowed: boolean; error: ApiError | null } {
  const forJob = existingEntries.filter((e) => e.jobId === jobId);
  if (forJob.some((e) => e.entryType === 'reserve')) {
    return { allowed: false, error: apiError(ERROR_CODES.MCP_USAGE_RESERVATION_CONFLICT, { jobId }) };
  }
  return { allowed: true, error: null };
}

/**
 * "Release reservation according to error policy" (owner decision Q-10):
 * hanh vi usage cua tung ma loi doc tu ERROR_CATALOGUE, khong hard-code rai rac.
 */
export function usageEffectOfError(code: ErrorCode): {
  releasesReservation: boolean;
  retryAllowed: boolean;
} {
  const def = errorDefinition(code);
  return { releasesReservation: def.releasesUsageReservation, retryAllowed: def.retryAllowed };
}

/**
 * Chi phi provider (ProviderRun.actualCostUsd) la so lieu NOI BO,
 * doc lap voi usage tinh cho khach hang. Provider error => khach khong bi tru,
 * nhung chi phi noi bo (neu co) van duoc ghi lai de benchmark.
 */
export const COST_SEPARATION_NOTE =
  'customer_usage_ledger != provider_cost_ledger; provider error releases customer usage but still records ProviderRun cost evidence';
