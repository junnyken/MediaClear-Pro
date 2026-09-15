import { describe, expect, it } from 'vitest';
import {
  ALL_ERROR_CODES,
  ERROR_CATALOGUE,
  ERROR_CODES,
  errorDefinition,
  errorI18nKey,
  httpStatusFor,
} from '../src/errors.js';

describe('Error catalogue (owner decision 4.5)', () => {
  it('moi ma loi deu co day du metadata bat buoc', () => {
    for (const code of ALL_ERROR_CODES) {
      const def = errorDefinition(code);
      expect(def.code, `${code} sai code`).toBe(code);
      expect(typeof def.category).toBe('string');
      expect(def.httpStatus, `${code} thieu HTTP mapping`).toBeGreaterThanOrEqual(400);
      expect(typeof def.retryAllowed, `${code} thieu retryAllowed`).toBe('boolean');
      expect(typeof def.releasesUsageReservation, `${code} thieu releasesUsageReservation`).toBe(
        'boolean',
      );
      expect(errorI18nKey(code)).toBe(`errors.${code.toLowerCase()}`);
    }
  });

  it('catalogue phu het danh sach ma loi, khong thua khong thieu', () => {
    expect(Object.keys(ERROR_CATALOGUE).sort()).toEqual([...ALL_ERROR_CODES].sort());
  });

  it('co du cac ma loi owner yeu cau', () => {
    const required = [
      'MCP_VAL_UNSUPPORTED_FORMAT',
      'MCP_VAL_FILE_TOO_LARGE',
      'MCP_VAL_DURATION_EXCEEDED',
      'MCP_VAL_VIDEO_WIDTH_EXCEEDED',
      'MCP_VAL_VIDEO_HEIGHT_EXCEEDED',
      'MCP_POLICY_RIGHTS_ATTESTATION_MISSING',
      'MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED',
      'MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED',
      'MCP_AUTHZ_WORKSPACE_ACCESS_DENIED',
      'MCP_AUTHZ_INSUFFICIENT_ROLE',
      'MCP_STATE_JOB_BLOCKED',
      'MCP_PROVIDER_CAPABILITY_UNKNOWN',
      'MCP_PROVIDER_UNAVAILABLE',
      'MCP_STATE_OUTPUT_NOT_VERIFIED',
      'MCP_USAGE_RESERVATION_CONFLICT',
      'MCP_USAGE_DOUBLE_COMMIT',
    ] as const;
    for (const code of required) {
      expect(ALL_ERROR_CODES, `thieu ma loi ${code}`).toContain(code);
    }
  });

  it('cross-workspace tra 404 de khong lo su ton tai (I-10)', () => {
    expect(httpStatusFor(ERROR_CODES.MCP_AUTHZ_WORKSPACE_ACCESS_DENIED)).toBe(404);
    expect(httpStatusFor(ERROR_CODES.MCP_AUTHZ_INSUFFICIENT_ROLE)).toBe(403);
  });

  it('loi provider cho phep retry va giai phong reservation', () => {
    for (const code of ['MCP_PROVIDER_TIMEOUT', 'MCP_PROVIDER_UNAVAILABLE', 'MCP_PROVIDER_SUBMIT_FAILED'] as const) {
      expect(errorDefinition(code).retryAllowed).toBe(true);
      expect(errorDefinition(code).releasesUsageReservation).toBe(true);
    }
  });

  it('loi usage double-commit KHONG giai phong reservation va khong cho retry', () => {
    const def = errorDefinition(ERROR_CODES.MCP_USAGE_DOUBLE_COMMIT);
    expect(def.retryAllowed).toBe(false);
    expect(def.releasesUsageReservation).toBe(false);
  });

  it('route chua trien khai map sang 501', () => {
    expect(httpStatusFor(ERROR_CODES.MCP_NOT_IMPLEMENTED)).toBe(501);
  });
});
