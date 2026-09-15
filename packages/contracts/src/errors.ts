/**
 * MediaClear Pro - Error code catalogue (MCP-03).
 *
 * Quy uoc: MCP_<DOMAIN>_<REASON>. Moi ma co i18n key tuong ung
 * (errors.<ma viet thuong>) trong packages/i18n; API khong tra text tho.
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
  MCP_VAL_CORRUPT_MEDIA: 'MCP_VAL_CORRUPT_MEDIA',

  // --- Rights / policy (MCP-02) ---
  MCP_POLICY_RIGHTS_ATTESTATION_MISSING: 'MCP_POLICY_RIGHTS_ATTESTATION_MISSING',
  MCP_POLICY_RIGHTS_ATTESTATION_STALE: 'MCP_POLICY_RIGHTS_ATTESTATION_STALE',
  MCP_POLICY_OPERATION_NOT_PERMITTED: 'MCP_POLICY_OPERATION_NOT_PERMITTED',
  MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED: 'MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED',
  MCP_POLICY_WORKSPACE_MISMATCH: 'MCP_POLICY_WORKSPACE_MISMATCH',

  // --- State machine (MCP-03) ---
  MCP_STATE_INVALID_TRANSITION: 'MCP_STATE_INVALID_TRANSITION',
  MCP_STATE_TERMINAL: 'MCP_STATE_TERMINAL',
  MCP_STATE_OUTPUT_NOT_VERIFIED: 'MCP_STATE_OUTPUT_NOT_VERIFIED',

  // --- Provider (MCP-04) ---
  MCP_PROVIDER_CAPABILITY_UNSUPPORTED: 'MCP_PROVIDER_CAPABILITY_UNSUPPORTED',
  MCP_PROVIDER_SUBMIT_FAILED: 'MCP_PROVIDER_SUBMIT_FAILED',
  MCP_PROVIDER_TIMEOUT: 'MCP_PROVIDER_TIMEOUT',
  MCP_PROVIDER_RESULT_MISSING: 'MCP_PROVIDER_RESULT_MISSING',
  MCP_PROVIDER_NOT_PRODUCTION: 'MCP_PROVIDER_NOT_PRODUCTION',

  // --- Usage (MCP-07) ---
  MCP_USAGE_DOUBLE_COMMIT: 'MCP_USAGE_DOUBLE_COMMIT',
  MCP_USAGE_RESERVE_MISSING: 'MCP_USAGE_RESERVE_MISSING',
  MCP_USAGE_QUANTITY_UNKNOWN: 'MCP_USAGE_QUANTITY_UNKNOWN',

  // --- Chung ---
  MCP_NOT_IMPLEMENTED: 'MCP_NOT_IMPLEMENTED',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ALL_ERROR_CODES: readonly ErrorCode[] = Object.values(ERROR_CODES);

/** i18n key tuong ung cua mot ma loi. */
export function errorI18nKey(code: ErrorCode): string {
  return `errors.${code.toLowerCase()}`;
}

export interface ApiError {
  code: ErrorCode;
  /** i18n key, KHONG phai text da dich. Client tu render theo locale. */
  messageKey: string;
  /** Tham so de noi suy vao message, vd { limitMb: 200 }. Khong chua PII. */
  params?: Record<string, string | number>;
}

export function apiError(code: ErrorCode, params?: Record<string, string | number>): ApiError {
  return params
    ? { code, messageKey: errorI18nKey(code), params }
    : { code, messageKey: errorI18nKey(code) };
}
