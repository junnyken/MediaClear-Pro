/**
 * MediaClear Pro - Rights Guard & processing policy gate (MCP-02).
 *
 * Flow: Asset upload -> Rights attestation required -> Validate media constraints
 *       -> Allow processing OR block -> Record audit event.
 *
 * Guardrail 11: khong co duong tat bypass gate nay. Moi lan goi deu sinh audit intent.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';
import type { CleanupOperation } from './vocabulary.js';

/** Cau xac nhan quyen dang hien hanh. Text that su nam o packages/i18n. */
export const RIGHTS_STATEMENT = {
  id: 'rights_attestation',
  version: 1,
  /** i18n key cua noi dung xac nhan (vi mac dinh, en san sang). */
  i18nKey: 'rights.attestation.v1.statement',
  /** Thoi han hieu luc cua mot attestation, tinh tu attestedAt. */
  validityDays: 365,
} as const;

/**
 * MVP chi luu attestation o scope 'asset'.
 * Khong cho phep attestation cap workspace/project kieu "tich 1 lan cho tat ca"
 * vi se bien gate thanh hinh thuc (DECISIONS.md D-006).
 */
export const ATTESTATION_SCOPE = 'asset' as const;

export interface PolicyEvaluationInput {
  workspaceId: string;
  assetWorkspaceId: string;
  assetId: string;
  operations: CleanupOperation[];
  /** null = nguoi dung chua xac nhan quyen. */
  attestation: {
    assetId: string;
    statementId: string;
    statementVersion: number;
    attestedAt: string;
  } | null;
  /** Ket qua validate media (MCP-03) - policy gate khong tu validate lai. */
  mediaValid: boolean;
  /** Yeu cau xoa provenance => luon block trong MVP (guardrail 7). */
  removeProvenanceRequested: boolean;
  /** Thoi diem danh gia, inject de test duoc. */
  now: Date;
}

export interface PolicyDecision {
  decision: 'allow' | 'block';
  errors: ApiError[];
  /** Su kien audit PHAI duoc ghi du decision la gi (guardrail 11). */
  auditEventType: 'policy.allowed' | 'policy.blocked';
  /** Chi chua metadata phi nhay cam (guardrail 15). */
  auditDetail: Record<string, string | number | boolean | null>;
}

const MS_PER_DAY = 86_400_000;

export function evaluateProcessingPolicy(input: PolicyEvaluationInput): PolicyDecision {
  const errors: ApiError[] = [];

  if (input.workspaceId !== input.assetWorkspaceId) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_WORKSPACE_MISMATCH));
  }

  if (input.removeProvenanceRequested) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED));
  }

  if (input.attestation === null) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_MISSING));
  } else {
    const a = input.attestation;
    if (a.assetId !== input.assetId) {
      errors.push(apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_MISSING));
    } else if (a.statementId !== RIGHTS_STATEMENT.id || a.statementVersion < RIGHTS_STATEMENT.version) {
      // Cau xac nhan da doi => phai xac nhan lai, khong suy ra tu lan truoc.
      errors.push(apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_STALE));
    } else {
      const ageDays = (input.now.getTime() - new Date(a.attestedAt).getTime()) / MS_PER_DAY;
      if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > RIGHTS_STATEMENT.validityDays) {
        errors.push(apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_STALE));
      }
    }
  }

  if (!input.mediaValid) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_OPERATION_NOT_PERMITTED));
  }

  if (input.operations.length === 0) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_OPERATION_NOT_PERMITTED));
  }

  const blocked = errors.length > 0;
  return {
    decision: blocked ? 'block' : 'allow',
    errors,
    auditEventType: blocked ? 'policy.blocked' : 'policy.allowed',
    auditDetail: {
      assetId: input.assetId,
      workspaceId: input.workspaceId,
      operationCount: input.operations.length,
      attestationPresent: input.attestation !== null,
      statementVersion: input.attestation?.statementVersion ?? null,
      reasonCodes: errors.map((e) => e.code).join(',') || null,
    },
  };
}
