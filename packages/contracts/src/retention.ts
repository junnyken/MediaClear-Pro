/**
 * MediaClear Pro - Luat luu giu du lieu (P1.1-MCP-18, owner decision Q-18).
 *
 * NGUYEN TAC AN TOAN: module nay chi TINH TOAN, khong xoa gi. Khong ham nao o day
 * cham vao storage hay database. Phase 1.1 chi co duong "thu khong xoa" (dry run).
 *
 * LUU Y TU VUNG: `CleanupOperation` cua domain nghia la LAM SACH ANH/VIDEO, khong
 * lien quan toi don du lieu. O day dung tu "retention" va "ung vien xoa".
 */
import {
  AUDIT_RETENTION_DAYS,
  DELETED_TOMBSTONE_RETENTION_DAYS,
  FAILED_INTERMEDIATE_RETENTION_DAYS,
  PREVIEW_PROXY_RETENTION_HOURS,
  RETENTION_POLICY_VERSION,
  RIGHTS_ATTESTATION_VALIDITY_DAYS,
  SOURCE_OUTPUT_RETENTION_DAYS,
  USAGE_LEDGER_RETENTION_MONTHS,
} from './config.js';

export const RETENTION_STATES = ['active', 'scheduled_for_deletion', 'deleted', 'legal_hold'] as const;
export type RetentionState = (typeof RETENTION_STATES)[number];

/** Lop du lieu - moi lop mot luat rieng, khong lop nao an theo lop khac. */
export const RETENTION_DATA_CLASSES = [
  'source_asset',
  'output_asset',
  'failed_intermediate',
  'preview_proxy',
  'audit_event',
  'usage_ledger',
  'deleted_tombstone',
  'rights_attestation',
  'account_record',
] as const;
export type RetentionDataClass = (typeof RETENTION_DATA_CLASSES)[number];

/** Moc tinh han: theo lan truy cap cuoi, theo ngay tao, hay theo luc bi xoa. */
export type RetentionBasis = 'last_accessed' | 'created' | 'deleted_at' | 'account_active' | 'follows_asset';

export interface RetentionRule {
  dataClass: RetentionDataClass;
  basis: RetentionBasis;
  /** null = khong tu het han theo thoi gian. */
  windowMs: number | null;
  /** Ly do ghi ra bao cao khi ban ghi tro thanh ung vien. */
  candidateReason: string | null;
  /** false = lop du lieu nay KHONG bao gio bi don theo retention cua asset. */
  assetScoped: boolean;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** 24 thang = 730 ngay (365 * 2). Ghi ro de khong ai doan "thang" la bao nhieu ngay. */
const MONTH_AS_DAYS = 365 / 12;

export const RETENTION_REASONS = {
  SOURCE_INACTIVE: `source_inactive_${SOURCE_OUTPUT_RETENTION_DAYS}d`,
  OUTPUT_INACTIVE: `output_inactive_${SOURCE_OUTPUT_RETENTION_DAYS}d`,
  PREVIEW_EXPIRED: `preview_expired_${PREVIEW_PROXY_RETENTION_HOURS}h`,
  FAILED_INTERMEDIATE: `failed_intermediate_${FAILED_INTERMEDIATE_RETENTION_DAYS}d`,
  TOMBSTONE_EXPIRED: `tombstone_expired_${DELETED_TOMBSTONE_RETENTION_DAYS}d`,
  LEGAL_HOLD_EXCLUDED: 'legal_hold_excluded',
  WITHIN_RETENTION: 'within_retention',
  NOT_ASSET_SCOPED: 'not_asset_scoped',
  ALREADY_DELETED: 'already_deleted',
} as const;

export const RETENTION_RULES: Readonly<Record<RetentionDataClass, RetentionRule>> = {
  source_asset: {
    dataClass: 'source_asset',
    // Tinh theo TRUY CAP CUOI: tep con duoc dung thi khong bi xoa du da tao lau.
    basis: 'last_accessed',
    windowMs: SOURCE_OUTPUT_RETENTION_DAYS * DAY_MS,
    candidateReason: RETENTION_REASONS.SOURCE_INACTIVE,
    assetScoped: true,
  },
  output_asset: {
    dataClass: 'output_asset',
    basis: 'last_accessed',
    windowMs: SOURCE_OUTPUT_RETENTION_DAYS * DAY_MS,
    candidateReason: RETENTION_REASONS.OUTPUT_INACTIVE,
    assetScoped: true,
  },
  failed_intermediate: {
    dataClass: 'failed_intermediate',
    basis: 'created',
    windowMs: FAILED_INTERMEDIATE_RETENTION_DAYS * DAY_MS,
    candidateReason: RETENTION_REASONS.FAILED_INTERMEDIATE,
    assetScoped: true,
  },
  preview_proxy: {
    dataClass: 'preview_proxy',
    basis: 'created',
    windowMs: PREVIEW_PROXY_RETENTION_HOURS * HOUR_MS,
    candidateReason: RETENTION_REASONS.PREVIEW_EXPIRED,
    assetScoped: true,
  },
  deleted_tombstone: {
    dataClass: 'deleted_tombstone',
    basis: 'deleted_at',
    windowMs: DELETED_TOMBSTONE_RETENTION_DAYS * DAY_MS,
    candidateReason: RETENTION_REASONS.TOMBSTONE_EXPIRED,
    assetScoped: true,
  },
  // Audit va usage KHONG bao gio bi don theo retention cua asset: chung co luat rieng
  // va phuc vu doi soat/truy vet. Day la lop bao ve, khong phai chi tiet ky thuat.
  audit_event: {
    dataClass: 'audit_event',
    basis: 'created',
    windowMs: AUDIT_RETENTION_DAYS * DAY_MS,
    candidateReason: null,
    assetScoped: false,
  },
  usage_ledger: {
    dataClass: 'usage_ledger',
    basis: 'created',
    windowMs: Math.round(USAGE_LEDGER_RETENTION_MONTHS * MONTH_AS_DAYS) * DAY_MS,
    candidateReason: null,
    assetScoped: false,
  },
  rights_attestation: {
    dataClass: 'rights_attestation',
    // Luu cung asset; hieu luc rieng 365 ngay do policy gate kiem, khong phai retention.
    basis: 'follows_asset',
    windowMs: RIGHTS_ATTESTATION_VALIDITY_DAYS * DAY_MS,
    candidateReason: null,
    assetScoped: false,
  },
  account_record: {
    dataClass: 'account_record',
    basis: 'account_active',
    windowMs: null,
    candidateReason: null,
    assetScoped: false,
  },
};

export interface RetentionSubject {
  id: string;
  workspaceId: string;
  dataClass: RetentionDataClass;
  createdAt: string;
  /** null = chua ghi nhan lan truy cap nao. */
  lastAccessedAt: string | null;
  deletedAt: string | null;
  retentionState: RetentionState;
  legalHoldAt: string | null;
  /** null = khong do duoc dung luong. Khong duoc dien 0 thay cho "chua biet". */
  byteSize: number | null;
}

export interface RetentionDecision {
  subjectId: string;
  dataClass: RetentionDataClass;
  isCandidate: boolean;
  reason: string;
  /** Moc giu toi. null = khong tinh duoc hoac khong het han theo thoi gian. */
  retainUntil: string | null;
}

function basisTimestamp(subject: RetentionSubject, rule: RetentionRule): string | null {
  if (rule.basis === 'last_accessed') return subject.lastAccessedAt ?? subject.createdAt;
  if (rule.basis === 'created') return subject.createdAt;
  if (rule.basis === 'deleted_at') return subject.deletedAt;
  return null;
}

/**
 * Quyet dinh cho MOT ban ghi. Ham thuan, nhan `asOf` => test kiem duoc moi ca bien
 * va ban dry-run dung dung ham nay, khong co phien ban thu hai.
 */
export function retentionDecisionFor(subject: RetentionSubject, asOf: Date): RetentionDecision {
  const rule = RETENTION_RULES[subject.dataClass];
  const base = { subjectId: subject.id, dataClass: subject.dataClass };

  // 1) Giu theo yeu cau phap ly thi khong bao gio la ung vien - kiem TRUOC moi thu khac.
  if (subject.retentionState === 'legal_hold' || subject.legalHoldAt !== null) {
    return { ...base, isCandidate: false, reason: RETENTION_REASONS.LEGAL_HOLD_EXCLUDED, retainUntil: null };
  }

  // 2) Lop khong thuoc pham vi don theo asset thi khong bao gio vao danh sach nay.
  if (!rule.assetScoped) {
    return { ...base, isCandidate: false, reason: RETENTION_REASONS.NOT_ASSET_SCOPED, retainUntil: null };
  }

  // 3) Ban ghi da xoa: chi con dau vet, tinh theo moc bi xoa.
  if (subject.retentionState === 'deleted' && subject.dataClass !== 'deleted_tombstone') {
    return { ...base, isCandidate: false, reason: RETENTION_REASONS.ALREADY_DELETED, retainUntil: null };
  }

  const anchor = basisTimestamp(subject, rule);
  if (anchor === null || rule.windowMs === null) {
    return { ...base, isCandidate: false, reason: RETENTION_REASONS.WITHIN_RETENTION, retainUntil: null };
  }

  const retainUntilMs = new Date(anchor).getTime() + rule.windowMs;
  if (!Number.isFinite(retainUntilMs)) {
    return { ...base, isCandidate: false, reason: RETENTION_REASONS.WITHIN_RETENTION, retainUntil: null };
  }
  const retainUntil = new Date(retainUntilMs).toISOString();
  // Bien INCLUSIVE: dung moc retainUntil van con duoc giu.
  const isCandidate = asOf.getTime() > retainUntilMs;
  return {
    ...base,
    isCandidate,
    reason: isCandidate ? (rule.candidateReason ?? RETENTION_REASONS.WITHIN_RETENTION) : RETENTION_REASONS.WITHIN_RETENTION,
    retainUntil,
  };
}

export interface RetentionDryRunInput {
  asOf: Date;
  workspaceId?: string | null;
  dataClass?: RetentionDataClass | null;
}

export interface RetentionDryRunReport {
  /** Luon true: khong co duong nao trong module nay xoa du lieu. */
  dryRun: true;
  asOf: string;
  policyVersion: number;
  candidateCount: number;
  byRetentionState: Record<string, number>;
  byDataClass: Record<string, number>;
  byReason: Record<string, number>;
  oldestCandidateAt: string | null;
  /** null = khong do duoc dung luong cua toan bo ung vien. */
  wouldDeleteBytes: number | null;
  scannedCount: number;
}

/** Dem ung vien. KHONG xoa gi, khong tra ve du lieu nhay cam cua tung ban ghi. */
export function retentionDryRun(
  subjects: readonly RetentionSubject[],
  input: RetentionDryRunInput,
): RetentionDryRunReport {
  const scope = subjects.filter(
    (s) =>
      (!input.workspaceId || s.workspaceId === input.workspaceId) &&
      (!input.dataClass || s.dataClass === input.dataClass),
  );

  const byRetentionState: Record<string, number> = {};
  const byDataClass: Record<string, number> = {};
  const byReason: Record<string, number> = {};
  let candidateCount = 0;
  let oldestCandidateAt: string | null = null;
  let bytes = 0;
  let bytesKnown = true;

  for (const subject of scope) {
    const decision = retentionDecisionFor(subject, input.asOf);
    byReason[decision.reason] = (byReason[decision.reason] ?? 0) + 1;
    if (!decision.isCandidate) continue;

    candidateCount += 1;
    byRetentionState[subject.retentionState] = (byRetentionState[subject.retentionState] ?? 0) + 1;
    byDataClass[subject.dataClass] = (byDataClass[subject.dataClass] ?? 0) + 1;
    const anchor = basisTimestamp(subject, RETENTION_RULES[subject.dataClass]) ?? subject.createdAt;
    if (oldestCandidateAt === null || anchor < oldestCandidateAt) oldestCandidateAt = anchor;
    if (subject.byteSize === null) bytesKnown = false;
    else bytes += subject.byteSize;
  }

  return {
    dryRun: true,
    asOf: input.asOf.toISOString(),
    policyVersion: RETENTION_POLICY_VERSION,
    candidateCount,
    byRetentionState,
    byDataClass,
    byReason,
    oldestCandidateAt,
    wouldDeleteBytes: bytesKnown ? bytes : null,
    scannedCount: scope.length,
  };
}
