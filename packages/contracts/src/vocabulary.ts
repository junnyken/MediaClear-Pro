/**
 * MediaClear Pro - Stable vocabulary (MCP-01).
 *
 * Nguon: MEDIACLEAR_PRO_PHASE_0 prompt, muc 5B.
 * Audit: repository rong tai thoi diem Phase 0 => khong co vocabulary cu de map.
 * Xem docs/DECISIONS.md (D-002, D-003) truoc khi them/doi bat ky gia tri nao.
 *
 * QUY UOC: moi gia tri la snake_case va on dinh o tang domain/API (English),
 * doc lap voi ngon ngu hien thi (UI mac dinh tieng Viet qua i18n key).
 */

export const MEDIA_TYPES = ['image', 'video'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const CLEANUP_OPERATIONS = [
  'visible_logo_cleanup',
  'visible_text_cleanup',
  'object_cleanup',
  'crop',
  'blur',
  'inpaint',
  'tracked_inpaint',
  'brand_overlay',
] as const;
export type CleanupOperation = (typeof CLEANUP_OPERATIONS)[number];

/**
 * Trang thai cua ProcessingJob.
 * CANH BAO NAMESPACE: gia tri 'blocked' o day KHAC nghia voi EvidenceStatus 'blocked'.
 * - JobState.blocked  = policy/rights gate tu choi, job khong duoc chay.
 * - EvidenceStatus.blocked = khong the thu thap bang chung (vd provider khong tra cost).
 * Khong bao gio dung chung mot cot DB cho hai enum nay (DECISIONS.md D-004).
 */
export const JOB_STATES = [
  'uploaded',
  'validating',
  'queued',
  'processing',
  'review_required',
  'completed',
  'failed',
  'blocked',
  'cancelled',
] as const;
export type JobState = (typeof JOB_STATES)[number];

export const EVIDENCE_STATUSES = [
  'verified',
  'partially_verified',
  'unknown',
  'unconfirmed',
  'blocked',
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** Trang thai tai lieu/capability dung trong docs va trong FeatureFlagContract. */
export const CAPABILITY_STATUSES = ['implemented', 'planned', 'unknown', 'out_of_scope'] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];

/** Su hien dien cua metadata/provenance tren mot file. Khong bao gio suy doan. */
export const PRESENCE_VALUES = ['present', 'absent', 'unknown'] as const;
export type Presence = (typeof PRESENCE_VALUES)[number];

export const PRESERVATION_RESULTS = ['preserved', 'partial', 'lost', 'unknown'] as const;
export type PreservationResult = (typeof PRESERVATION_RESULTS)[number];

/** Terminal states: khong con transition hop le nao ra khoi day. */
export const TERMINAL_JOB_STATES: readonly JobState[] = [
  'completed',
  'failed',
  'blocked',
  'cancelled',
];

export function isTerminalJobState(state: JobState): boolean {
  return TERMINAL_JOB_STATES.includes(state);
}
