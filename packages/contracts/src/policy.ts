/**
 * MediaClear Pro - Rights Guard & processing policy gate (MCP-02).
 *
 * Flow: Asset upload -> Rights attestation required -> Validate media constraints
 *       -> Allow processing OR block -> Record audit event.
 *
 * Owner decisions 2026-09-15:
 *  - Q-04: kiem tra tenancy + role TRUOC, khong lo su ton tai asset ngoai workspace.
 *  - Q-09: attestation cap asset, hieu luc 365 ngay, gan voi ca sourceFileId;
 *          asset bi report -> attestation 'blocked' -> khong duoc submit job.
 *  - Q-08: phan biet ro policy block / validation block / provider block.
 *
 * Guardrail 11: khong co duong tat bypass gate nay. Moi lan goi deu sinh audit intent.
 */
import { RIGHTS_ATTESTATION_VALIDITY_DAYS } from './config.js';
import { ERROR_CODES, apiError, errorDefinition, type ApiError, type ErrorCode } from './errors.js';
import { authorize, type WorkspaceRole } from './tenancy.js';
import type { CleanupOperation } from './vocabulary.js';

/** Cau xac nhan quyen dang hien hanh. Text that su nam o packages/i18n. */
export const RIGHTS_STATEMENT = {
  id: 'rights_attestation',
  version: 1,
  /** i18n key cua noi dung xac nhan (vi mac dinh, en san sang). */
  i18nKey: 'rights.attestation.v1.statement',
  /** Owner decision Q-09: hieu luc 365 ngay (doc tu config, khong hard-code). */
  validityDays: RIGHTS_ATTESTATION_VALIDITY_DAYS,
} as const;

/**
 * MVP chi luu attestation o scope 'asset' (owner decision Q-09).
 * Khong cho phep attestation cap workspace/project kieu "tich 1 lan cho tat ca".
 */
export const ATTESTATION_SCOPE = 'asset' as const;

/** Phan loai ly do bi chan - de phan tich va de UX noi dung chuyen. */
export const BLOCK_REASON_KINDS = ['policy_block', 'validation_block', 'provider_block'] as const;
export type BlockReasonKind = (typeof BLOCK_REASON_KINDS)[number];

export function blockReasonKindFor(code: ErrorCode): BlockReasonKind | null {
  const category = errorDefinition(code).category;
  if (category === 'policy' || category === 'authz') return 'policy_block';
  if (category === 'validation') return 'validation_block';
  if (category === 'provider') return 'provider_block';
  return null;
}

export interface AttestationSnapshot {
  assetId: string;
  /** Owner decision Q-09: source file moi => phai xac nhan lai. */
  sourceFileId: string;
  statementId: string;
  statementVersion: number;
  attestedAt: string;
  /** 'blocked' khi asset bi report va dang cho review. */
  status: 'active' | 'blocked';
}

export interface PolicyEvaluationInput {
  actor: {
    userId: string;
    workspaceId: string;
    role: WorkspaceRole;
  };
  assetId: string;
  assetWorkspaceId: string;
  assetSourceFileId: string;
  operations: CleanupOperation[];
  /** null = nguoi dung chua xac nhan quyen. */
  attestation: AttestationSnapshot | null;
  /** Ket qua validate media (MCP-03) - policy gate khong tu validate lai. */
  mediaValid: boolean;
  /** Yeu cau xoa provenance => luon block (guardrail 7). */
  removeProvenanceRequested: boolean;
  /** Thoi diem danh gia, inject de test duoc. */
  now: Date;
}

export interface PolicyDecision {
  decision: 'allow' | 'block';
  errors: ApiError[];
  /** null khi allow. */
  blockReasonKind: BlockReasonKind | null;
  /** Su kien audit PHAI duoc ghi du decision la gi (guardrail 11). */
  auditEventType: 'policy.allowed' | 'policy.blocked';
  /** Chi chua metadata phi nhay cam (guardrail 15). */
  auditDetail: Record<string, string | number | boolean | null>;
  /** false khi tu choi cross-workspace: khong duoc lo asset co ton tai hay khong. */
  revealsResourceExistence: boolean;
}

const MS_PER_DAY = 86_400_000;

function attestationErrors(input: PolicyEvaluationInput): ApiError[] {
  const a = input.attestation;
  if (a === null) {
    return [apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_MISSING)];
  }
  // Attestation cua asset khac hoac cua source file khac => coi nhu chua co.
  if (a.assetId !== input.assetId || a.sourceFileId !== input.assetSourceFileId) {
    return [apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_MISSING)];
  }
  if (a.status === 'blocked') {
    return [apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED)];
  }
  if (a.statementId !== RIGHTS_STATEMENT.id || a.statementVersion < RIGHTS_STATEMENT.version) {
    // Cau xac nhan da doi => phai xac nhan lai, khong suy ra tu lan truoc.
    return [apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_STALE)];
  }
  const ageDays = (input.now.getTime() - new Date(a.attestedAt).getTime()) / MS_PER_DAY;
  if (!Number.isFinite(ageDays) || ageDays < 0) {
    return [apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_STALE)];
  }
  if (ageDays > RIGHTS_STATEMENT.validityDays) {
    return [apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED)];
  }
  return [];
}

export function evaluateProcessingPolicy(input: PolicyEvaluationInput): PolicyDecision {
  const baseDetail = {
    assetId: input.assetId,
    workspaceId: input.actor.workspaceId,
    actorUserId: input.actor.userId,
    actorRole: input.actor.role,
    operationCount: input.operations.length,
    attestationPresent: input.attestation !== null,
    statementVersion: input.attestation?.statementVersion ?? null,
  };

  // 1) Tenancy + role truoc tien (owner decision Q-04). Viewer khong duoc tao job.
  const access = authorize({
    actorUserId: input.actor.userId,
    actorWorkspaceId: input.actor.workspaceId,
    actorRole: input.actor.role,
    resourceWorkspaceId: input.assetWorkspaceId,
    resourceType: 'asset',
    resourceId: input.assetId,
    permission: 'job.create',
  });
  if (access.decision === 'deny') {
    const error = access.error as ApiError;
    return {
      decision: 'block',
      errors: [error],
      blockReasonKind: blockReasonKindFor(error.code),
      auditEventType: 'policy.blocked',
      auditDetail: {
        ...baseDetail,
        assetId: access.revealsResourceExistence ? input.assetId : null,
        reasonCodes: error.code,
      },
      revealsResourceExistence: access.revealsResourceExistence,
    };
  }

  const errors: ApiError[] = [];

  if (input.removeProvenanceRequested) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED));
  }

  errors.push(...attestationErrors(input));

  if (!input.mediaValid) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_OPERATION_NOT_PERMITTED));
  }

  if (input.operations.length === 0) {
    errors.push(apiError(ERROR_CODES.MCP_POLICY_OPERATION_NOT_PERMITTED));
  }

  const blocked = errors.length > 0;
  const firstCode = errors[0]?.code;
  return {
    decision: blocked ? 'block' : 'allow',
    errors,
    blockReasonKind: firstCode ? blockReasonKindFor(firstCode) : null,
    auditEventType: blocked ? 'policy.blocked' : 'policy.allowed',
    auditDetail: {
      ...baseDetail,
      reasonCodes: errors.map((e) => e.code).join(',') || null,
    },
    revealsResourceExistence: true,
  };
}
