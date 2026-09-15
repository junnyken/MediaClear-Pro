import { describe, expect, it } from 'vitest';
import {
  ATTESTATION_SCOPE,
  RIGHTS_STATEMENT,
  evaluateProcessingPolicy,
  type PolicyEvaluationInput,
} from '../src/policy.js';

const now = new Date('2026-09-15T00:00:00.000Z');

const base: PolicyEvaluationInput = {
  workspaceId: 'ws1',
  assetWorkspaceId: 'ws1',
  assetId: 'a1',
  operations: ['visible_logo_cleanup'],
  attestation: {
    assetId: 'a1',
    statementId: RIGHTS_STATEMENT.id,
    statementVersion: RIGHTS_STATEMENT.version,
    attestedAt: '2026-09-14T00:00:00.000Z',
  },
  mediaValid: true,
  removeProvenanceRequested: false,
  now,
};

describe('MCP-02 rights guard & policy gate', () => {
  it('du dieu kien => allow, van ghi audit event', () => {
    const d = evaluateProcessingPolicy(base);
    expect(d.decision).toBe('allow');
    expect(d.auditEventType).toBe('policy.allowed');
    expect(d.errors).toEqual([]);
  });

  it('khong xac nhan quyen => block + audit event', () => {
    const d = evaluateProcessingPolicy({ ...base, attestation: null });
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    expect(d.auditEventType).toBe('policy.blocked');
  });

  it('attestation cua asset KHAC khong duoc dung lai', () => {
    const d = evaluateProcessingPolicy({
      ...base,
      attestation: { ...base.attestation!, assetId: 'a-other' },
    });
    expect(d.decision).toBe('block');
  });

  it('attestation qua han (> validityDays) => stale', () => {
    const d = evaluateProcessingPolicy({
      ...base,
      attestation: { ...base.attestation!, attestedAt: '2024-01-01T00:00:00.000Z' },
    });
    expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_RIGHTS_ATTESTATION_STALE');
  });

  it('attestation ky theo ban statement cu => phai xac nhan lai', () => {
    const d = evaluateProcessingPolicy({
      ...base,
      attestation: { ...base.attestation!, statementVersion: 0 },
    });
    expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_RIGHTS_ATTESTATION_STALE');
  });

  it('yeu cau xoa provenance => luon block (guardrail 7)', () => {
    const d = evaluateProcessingPolicy({ ...base, removeProvenanceRequested: true });
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_PROVENANCE_REMOVAL_REQUESTED');
  });

  it('asset thuoc workspace khac => block (chan IDOR cross-tenant)', () => {
    const d = evaluateProcessingPolicy({ ...base, assetWorkspaceId: 'ws2' });
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_WORKSPACE_MISMATCH');
  });

  it('media khong hop le => khong duoc cho qua gate', () => {
    expect(evaluateProcessingPolicy({ ...base, mediaValid: false }).decision).toBe('block');
  });

  it('audit detail khong chua text nhay cam / khong chua binary', () => {
    const d = evaluateProcessingPolicy({ ...base, attestation: null });
    const serialized = JSON.stringify(d.auditDetail);
    expect(serialized).not.toMatch(/data:|base64|api[_-]?key/i);
    expect(ATTESTATION_SCOPE).toBe('asset');
  });
});
