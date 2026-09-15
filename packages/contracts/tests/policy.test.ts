import { describe, expect, it } from 'vitest';
import { RIGHTS_ATTESTATION_VALIDITY_DAYS } from '../src/config.js';
import {
  ATTESTATION_SCOPE,
  RIGHTS_STATEMENT,
  blockReasonKindFor,
  evaluateProcessingPolicy,
  type PolicyEvaluationInput,
} from '../src/policy.js';

const now = new Date('2026-09-15T00:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const base: PolicyEvaluationInput = {
  actor: { userId: 'u1', workspaceId: 'ws1', role: 'member' },
  assetId: 'a1',
  assetWorkspaceId: 'ws1',
  assetSourceFileId: 'sf1',
  operations: ['visible_logo_cleanup'],
  attestation: {
    assetId: 'a1',
    sourceFileId: 'sf1',
    statementId: RIGHTS_STATEMENT.id,
    statementVersion: RIGHTS_STATEMENT.version,
    attestedAt: daysAgo(1),
    status: 'active',
  },
  mediaValid: true,
  removeProvenanceRequested: false,
  now,
};

const codes = (input: PolicyEvaluationInput) =>
  evaluateProcessingPolicy(input).errors.map((e) => e.code);

describe('MCP-02 rights guard & policy gate', () => {
  it('du dieu kien => allow, van ghi audit event', () => {
    const d = evaluateProcessingPolicy(base);
    expect(d.decision).toBe('allow');
    expect(d.auditEventType).toBe('policy.allowed');
    expect(d.errors).toEqual([]);
    expect(d.blockReasonKind).toBeNull();
  });

  it('khong xac nhan quyen => block + audit event + policy_block', () => {
    const d = evaluateProcessingPolicy({ ...base, attestation: null });
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    expect(d.auditEventType).toBe('policy.blocked');
    expect(d.blockReasonKind).toBe('policy_block');
  });

  it('attestation cua asset KHAC hoac source file KHAC khong duoc dung lai (Q-09)', () => {
    expect(
      codes({ ...base, attestation: { ...base.attestation!, assetId: 'a-other' } }),
    ).toContain('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    expect(
      codes({ ...base, attestation: { ...base.attestation!, sourceFileId: 'sf-new' } }),
    ).toContain('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
  });

  it('bien hieu luc attestation: 365 ngay con hop le, 366 ngay het han', () => {
    expect(RIGHTS_ATTESTATION_VALIDITY_DAYS).toBe(365);
    expect(
      evaluateProcessingPolicy({
        ...base,
        attestation: { ...base.attestation!, attestedAt: daysAgo(365) },
      }).decision,
    ).toBe('allow');
    expect(
      codes({ ...base, attestation: { ...base.attestation!, attestedAt: daysAgo(366) } }),
    ).toContain('MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED');
  });

  it('attestation bi block (asset dang bi report) => khong cho submit', () => {
    expect(
      codes({ ...base, attestation: { ...base.attestation!, status: 'blocked' } }),
    ).toContain('MCP_POLICY_RIGHTS_ATTESTATION_BLOCKED');
  });

  it('attestation ky theo ban statement cu => phai xac nhan lai (stale khac expired)', () => {
    expect(
      codes({ ...base, attestation: { ...base.attestation!, statementVersion: 0 } }),
    ).toContain('MCP_POLICY_RIGHTS_ATTESTATION_STALE');
  });

  it('yeu cau xoa provenance => luon block (guardrail 7)', () => {
    expect(codes({ ...base, removeProvenanceRequested: true })).toContain(
      'MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED',
    );
  });

  it('asset thuoc workspace khac => block va KHONG lo su ton tai (Q-04)', () => {
    const d = evaluateProcessingPolicy({ ...base, assetWorkspaceId: 'ws2' });
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toEqual(['MCP_AUTHZ_WORKSPACE_ACCESS_DENIED']);
    expect(d.revealsResourceExistence).toBe(false);
    expect(d.auditDetail.assetId).toBeNull();
  });

  it('viewer khong tao duoc processing job (Q-04)', () => {
    const d = evaluateProcessingPolicy({
      ...base,
      actor: { ...base.actor, role: 'viewer' },
    });
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toEqual(['MCP_AUTHZ_INSUFFICIENT_ROLE']);
  });

  it('owner/admin/member deu tao duoc job khi du dieu kien', () => {
    for (const role of ['owner', 'admin', 'member'] as const) {
      expect(
        evaluateProcessingPolicy({ ...base, actor: { ...base.actor, role } }).decision,
      ).toBe('allow');
    }
  });

  it('media khong hop le => validation_block, khac policy_block', () => {
    const d = evaluateProcessingPolicy({ ...base, mediaValid: false });
    expect(d.decision).toBe('block');
    expect(d.blockReasonKind).toBe('policy_block');
    expect(blockReasonKindFor('MCP_VAL_FILE_TOO_LARGE')).toBe('validation_block');
    expect(blockReasonKindFor('MCP_PROVIDER_TIMEOUT')).toBe('provider_block');
    expect(blockReasonKindFor('MCP_AUTHZ_INSUFFICIENT_ROLE')).toBe('policy_block');
  });

  it('audit detail khong chua text nhay cam / khong chua binary', () => {
    const d = evaluateProcessingPolicy({ ...base, attestation: null });
    const serialized = JSON.stringify(d.auditDetail);
    expect(serialized).not.toMatch(/data:|base64|api[_-]?key/i);
    expect(ATTESTATION_SCOPE).toBe('asset');
  });
});
