/**
 * MediaClear Pro - Error code catalogue (MCP-03 + owner decisions 4.5).
 *
 * Quy uoc: MCP_<DOMAIN>_<REASON>. Moi ma co:
 *  - stable machine code (chinh no),
 *  - user-facing translation key (errors.<ma viet thuong>) - co ca vi va en,
 *  - HTTP mapping,
 *  - retryAllowed: co duoc thu lai cung job khong,
 *  - releasesUsageReservation: neu job da reserve usage thi loi nay co giai phong khong.
 */

export const ERROR_CODES = {
  // --- Validation (MCP-03) ---
  MCP_VAL_UNSUPPORTED_FORMAT: 'MCP_VAL_UNSUPPORTED_FORMAT',
  MCP_VAL_MIME_MISMATCH: 'MCP_VAL_MIME_MISMATCH',
  MCP_VAL_FILE_TOO_LARGE: 'MCP_VAL_FILE_TOO_LARGE',
  MCP_VAL_EMPTY_FILE: 'MCP_VAL_EMPTY_FILE',
  MCP_VAL_DURATION_EXCEEDED: 'MCP_VAL_DURATION_EXCEEDED',
  MCP_VAL_DURATION_UNKNOWN: 'MCP_VAL_DURATION_UNKNOWN',
  MCP_VAL_DIMENSION_EXCEEDED: 'MCP_VAL_DIMENSION_EXCEEDED',
  MCP_VAL_DIMENSION_TOO_SMALL: 'MCP_VAL_DIMENSION_TOO_SMALL',
  MCP_VAL_DIMENSION_UNKNOWN: 'MCP_VAL_DIMENSION_UNKNOWN',
  MCP_VAL_VIDEO_WIDTH_EXCEEDED: 'MCP_VAL_VIDEO_WIDTH_EXCEEDED',
  MCP_VAL_VIDEO_HEIGHT_EXCEEDED: 'MCP_VAL_VIDEO_HEIGHT_EXCEEDED',
  MCP_VAL_CORRUPT_MEDIA: 'MCP_VAL_CORRUPT_MEDIA',

  // --- Rights / policy (MCP-02) ---
  MCP_POLICY_RIGHTS_ATTESTATION_MISSING: 'MCP_POLICY_RIGHTS_ATTESTATION_MISSING',
  MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED: 'MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED',
  MCP_POLICY_RIGHTS_ATTESTATION_STALE: 'MCP_POLICY_RIGHTS_ATTESTATION_STALE',
  MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED: 'MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED',
  MCP_POLICY_OPERATION_NOT_PERMITTED: 'MCP_POLICY_OPERATION_NOT_PERMITTED',
  MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED: 'MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED',

  // --- Authorization / tenancy (MCP-09) ---
  MCP_AUTHZ_WORKSPACE_ACCESS_DENIED: 'MCP_AUTHZ_WORKSPACE_ACCESS_DENIED',
  MCP_AUTHZ_INSUFFICIENT_ROLE: 'MCP_AUTHZ_INSUFFICIENT_ROLE',

  // --- State machine (MCP-03) ---
  MCP_STATE_INVALID_TRANSITION: 'MCP_STATE_INVALID_TRANSITION',
  MCP_STATE_TERMINAL: 'MCP_STATE_TERMINAL',
  MCP_STATE_OUTPUT_NOT_VERIFIED: 'MCP_STATE_OUTPUT_NOT_VERIFIED',
  MCP_STATE_JOB_BLOCKED: 'MCP_STATE_JOB_BLOCKED',

  // --- Provider (MCP-04) ---
  MCP_PROVIDER_CAPABILITY_UNSUPPORTED: 'MCP_PROVIDER_CAPABILITY_UNSUPPORTED',
  MCP_PROVIDER_CAPABILITY_UNKNOWN: 'MCP_PROVIDER_CAPABILITY_UNKNOWN',
  MCP_PROVIDER_UNAVAILABLE: 'MCP_PROVIDER_UNAVAILABLE',
  MCP_PROVIDER_SUBMIT_FAILED: 'MCP_PROVIDER_SUBMIT_FAILED',
  MCP_PROVIDER_TIMEOUT: 'MCP_PROVIDER_TIMEOUT',
  MCP_PROVIDER_RESULT_MISSING: 'MCP_PROVIDER_RESULT_MISSING',
  MCP_PROVIDER_NOT_PRODUCTION: 'MCP_PROVIDER_NOT_PRODUCTION',

  // --- Usage (MCP-07) ---
  MCP_USAGE_DOUBLE_COMMIT: 'MCP_USAGE_DOUBLE_COMMIT',
  MCP_USAGE_RESERVE_MISSING: 'MCP_USAGE_RESERVE_MISSING',
  MCP_USAGE_RESERVATION_CONFLICT: 'MCP_USAGE_RESERVATION_CONFLICT',
  MCP_USAGE_QUANTITY_UNKNOWN: 'MCP_USAGE_QUANTITY_UNKNOWN',
  /** P1.1 (Q-17): reservation da qua han 30 phut, khong con commit duoc. */
  MCP_USAGE_RESERVATION_EXPIRED: 'MCP_USAGE_RESERVATION_EXPIRED',

  // --- Storage (MCP-10 Phase 0 / MCP-15 Phase 1) ---
  MCP_STORAGE_OBJECT_NOT_FOUND: 'MCP_STORAGE_OBJECT_NOT_FOUND',
  MCP_STORAGE_WRITE_DENIED: 'MCP_STORAGE_WRITE_DENIED',
  MCP_STORAGE_UPLOAD_FAILED: 'MCP_STORAGE_UPLOAD_FAILED',
  /** Phase 1: upload ticket sai chu ky, het han, hoac khong khop object/content-type. */
  MCP_STORAGE_UPLOAD_TICKET_INVALID: 'MCP_STORAGE_UPLOAD_TICKET_INVALID',

  // --- Chung ---
  MCP_NOT_IMPLEMENTED: 'MCP_NOT_IMPLEMENTED',
  /** Phase 1: chua dang nhap / session het han. KHAC voi thieu quyen (403). */
  MCP_AUTHZ_SESSION_REQUIRED: 'MCP_AUTHZ_SESSION_REQUIRED',
  /**
   * Phase 1: tai nguyen khong ton tai TRONG workspace cua actor.
   * Cross-workspace dung MCP_AUTHZ_WORKSPACE_ACCESS_DENIED - ca hai deu 404 nen
   * nguoi goi khong phan biet duoc tu ben ngoai (I-10).
   */
  MCP_RESOURCE_NOT_FOUND: 'MCP_RESOURCE_NOT_FOUND',
  /** Phase 1: body/tham so request khong hop le. Khong bao gio tra loi noi bo tho. */
  MCP_VAL_REQUEST_INVALID: 'MCP_VAL_REQUEST_INVALID',
  /** Phase 1: asset chua qua buoc validate media => chua duoc tao job. */
  MCP_VAL_NOT_VALIDATED: 'MCP_VAL_NOT_VALIDATED',
  /** Phase 1: idempotencyKey da dung cho mot request khac noi dung. */
  MCP_JOB_IDEMPOTENCY_CONFLICT: 'MCP_JOB_IDEMPOTENCY_CONFLICT',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export type ErrorCategory =
  | 'validation'
  | 'policy'
  | 'authz'
  | 'state'
  | 'provider'
  | 'usage'
  | 'storage'
  | 'generic';

export interface ErrorDefinition {
  code: ErrorCode;
  category: ErrorCategory;
  /** HTTP status khi tra qua API. */
  httpStatus: number;
  /** Thu lai cung job co y nghia khong (false = phai sua input hoac tao job moi). */
  retryAllowed: boolean;
  /** Neu job da reserve usage, loi nay co bat buoc release reservation khong. */
  releasesUsageReservation: boolean;
}

const def = (
  code: ErrorCode,
  category: ErrorCategory,
  httpStatus: number,
  retryAllowed: boolean,
  releasesUsageReservation: boolean,
): ErrorDefinition => ({ code, category, httpStatus, retryAllowed, releasesUsageReservation });

const C = ERROR_CODES;

export const ERROR_CATALOGUE: Readonly<Record<ErrorCode, ErrorDefinition>> = {
  [C.MCP_VAL_UNSUPPORTED_FORMAT]: def(C.MCP_VAL_UNSUPPORTED_FORMAT, 'validation', 415, false, true),
  [C.MCP_VAL_MIME_MISMATCH]: def(C.MCP_VAL_MIME_MISMATCH, 'validation', 415, false, true),
  [C.MCP_VAL_FILE_TOO_LARGE]: def(C.MCP_VAL_FILE_TOO_LARGE, 'validation', 413, false, true),
  [C.MCP_VAL_EMPTY_FILE]: def(C.MCP_VAL_EMPTY_FILE, 'validation', 400, true, true),
  [C.MCP_VAL_DURATION_EXCEEDED]: def(C.MCP_VAL_DURATION_EXCEEDED, 'validation', 422, false, true),
  [C.MCP_VAL_DURATION_UNKNOWN]: def(C.MCP_VAL_DURATION_UNKNOWN, 'validation', 422, true, true),
  [C.MCP_VAL_DIMENSION_EXCEEDED]: def(C.MCP_VAL_DIMENSION_EXCEEDED, 'validation', 422, false, true),
  [C.MCP_VAL_DIMENSION_TOO_SMALL]: def(C.MCP_VAL_DIMENSION_TOO_SMALL, 'validation', 422, false, true),
  [C.MCP_VAL_DIMENSION_UNKNOWN]: def(C.MCP_VAL_DIMENSION_UNKNOWN, 'validation', 422, true, true),
  [C.MCP_VAL_VIDEO_WIDTH_EXCEEDED]: def(C.MCP_VAL_VIDEO_WIDTH_EXCEEDED, 'validation', 422, false, true),
  [C.MCP_VAL_VIDEO_HEIGHT_EXCEEDED]: def(C.MCP_VAL_VIDEO_HEIGHT_EXCEEDED, 'validation', 422, false, true),
  [C.MCP_VAL_CORRUPT_MEDIA]: def(C.MCP_VAL_CORRUPT_MEDIA, 'validation', 422, false, true),

  [C.MCP_POLICY_RIGHTS_ATTESTATION_MISSING]: def(C.MCP_POLICY_RIGHTS_ATTESTATION_MISSING, 'policy', 403, false, true),
  [C.MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED]: def(C.MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED, 'policy', 403, false, true),
  [C.MCP_POLICY_RIGHTS_ATTESTATION_STALE]: def(C.MCP_POLICY_RIGHTS_ATTESTATION_STALE, 'policy', 403, false, true),
  [C.MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED]: def(C.MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED, 'policy', 403, false, true),
  [C.MCP_POLICY_OPERATION_NOT_PERMITTED]: def(C.MCP_POLICY_OPERATION_NOT_PERMITTED, 'policy', 422, false, true),
  [C.MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED]: def(C.MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED, 'policy', 403, false, true),

  // 404 co chu dich: khong xac nhan asset ngoai workspace co ton tai hay khong.
  [C.MCP_AUTHZ_WORKSPACE_ACCESS_DENIED]: def(C.MCP_AUTHZ_WORKSPACE_ACCESS_DENIED, 'authz', 404, false, true),
  [C.MCP_AUTHZ_INSUFFICIENT_ROLE]: def(C.MCP_AUTHZ_INSUFFICIENT_ROLE, 'authz', 403, false, true),

  [C.MCP_STATE_INVALID_TRANSITION]: def(C.MCP_STATE_INVALID_TRANSITION, 'state', 409, false, false),
  [C.MCP_STATE_TERMINAL]: def(C.MCP_STATE_TERMINAL, 'state', 409, false, false),
  [C.MCP_STATE_OUTPUT_NOT_VERIFIED]: def(C.MCP_STATE_OUTPUT_NOT_VERIFIED, 'state', 409, true, false),
  [C.MCP_STATE_JOB_BLOCKED]: def(C.MCP_STATE_JOB_BLOCKED, 'state', 409, false, true),

  [C.MCP_PROVIDER_CAPABILITY_UNSUPPORTED]: def(C.MCP_PROVIDER_CAPABILITY_UNSUPPORTED, 'provider', 422, false, true),
  [C.MCP_PROVIDER_CAPABILITY_UNKNOWN]: def(C.MCP_PROVIDER_CAPABILITY_UNKNOWN, 'provider', 422, false, true),
  [C.MCP_PROVIDER_UNAVAILABLE]: def(C.MCP_PROVIDER_UNAVAILABLE, 'provider', 503, true, true),
  [C.MCP_PROVIDER_SUBMIT_FAILED]: def(C.MCP_PROVIDER_SUBMIT_FAILED, 'provider', 502, true, true),
  [C.MCP_PROVIDER_TIMEOUT]: def(C.MCP_PROVIDER_TIMEOUT, 'provider', 504, true, true),
  [C.MCP_PROVIDER_RESULT_MISSING]: def(C.MCP_PROVIDER_RESULT_MISSING, 'provider', 502, true, true),
  [C.MCP_PROVIDER_NOT_PRODUCTION]: def(C.MCP_PROVIDER_NOT_PRODUCTION, 'provider', 500, false, true),

  [C.MCP_USAGE_DOUBLE_COMMIT]: def(C.MCP_USAGE_DOUBLE_COMMIT, 'usage', 409, false, false),
  [C.MCP_USAGE_RESERVE_MISSING]: def(C.MCP_USAGE_RESERVE_MISSING, 'usage', 409, false, false),
  [C.MCP_USAGE_RESERVATION_CONFLICT]: def(C.MCP_USAGE_RESERVATION_CONFLICT, 'usage', 409, false, false),
  [C.MCP_USAGE_QUANTITY_UNKNOWN]: def(C.MCP_USAGE_QUANTITY_UNKNOWN, 'usage', 422, true, true),
  // Het han roi thi khong con reservation de giai phong nua => releasesUsageReservation = false.
  [C.MCP_USAGE_RESERVATION_EXPIRED]: def(C.MCP_USAGE_RESERVATION_EXPIRED, 'usage', 409, false, false),

  [C.MCP_STORAGE_OBJECT_NOT_FOUND]: def(C.MCP_STORAGE_OBJECT_NOT_FOUND, 'storage', 404, false, true),
  [C.MCP_STORAGE_WRITE_DENIED]: def(C.MCP_STORAGE_WRITE_DENIED, 'storage', 409, false, true),
  [C.MCP_STORAGE_UPLOAD_FAILED]: def(C.MCP_STORAGE_UPLOAD_FAILED, 'storage', 502, true, true),
  [C.MCP_STORAGE_UPLOAD_TICKET_INVALID]: def(C.MCP_STORAGE_UPLOAD_TICKET_INVALID, 'storage', 403, false, true),

  [C.MCP_NOT_IMPLEMENTED]: def(C.MCP_NOT_IMPLEMENTED, 'generic', 501, false, false),
  // 401: chua co danh tinh. Khong phai 403 (da biet la ai nhung thieu quyen).
  [C.MCP_AUTHZ_SESSION_REQUIRED]: def(C.MCP_AUTHZ_SESSION_REQUIRED, 'authz', 401, false, true),
  // 404 giong het cross-workspace: nhin tu ngoai khong phan biet duoc (I-10).
  [C.MCP_RESOURCE_NOT_FOUND]: def(C.MCP_RESOURCE_NOT_FOUND, 'generic', 404, false, true),
  [C.MCP_VAL_REQUEST_INVALID]: def(C.MCP_VAL_REQUEST_INVALID, 'validation', 400, false, true),
  // retry duoc: chay validate xong roi tao job lai la hop le.
  [C.MCP_VAL_NOT_VALIDATED]: def(C.MCP_VAL_NOT_VALIDATED, 'validation', 409, true, true),
  [C.MCP_JOB_IDEMPOTENCY_CONFLICT]: def(C.MCP_JOB_IDEMPOTENCY_CONFLICT, 'state', 409, false, false),
};

export const ALL_ERROR_CODES: readonly ErrorCode[] = Object.values(ERROR_CODES);

/** i18n key tuong ung cua mot ma loi. */
export function errorI18nKey(code: ErrorCode): string {
  return `errors.${code.toLowerCase()}`;
}

export function errorDefinition(code: ErrorCode): ErrorDefinition {
  return ERROR_CATALOGUE[code];
}

export function httpStatusFor(code: ErrorCode): number {
  return ERROR_CATALOGUE[code].httpStatus;
}

export interface ApiError {
  code: ErrorCode;
  /** i18n key, KHONG phai text da dich. Client tu render theo locale. */
  messageKey: string;
  /** Tham so de noi suy vao message, vd { limitMb: 199 }. Khong chua PII. */
  params?: Record<string, string | number>;
}

export function apiError(code: ErrorCode, params?: Record<string, string | number>): ApiError {
  return params
    ? { code, messageKey: errorI18nKey(code), params }
    : { code, messageKey: errorI18nKey(code) };
}
