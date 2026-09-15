/**
 * Regression tests bao ve 12 invariant Phase 0 (owner decisions, muc 5).
 * Moi test map 1-1 voi mot ID trong INVARIANTS.
 */
import { describe, expect, it } from 'vitest';
import { INVARIANTS, assertOutputDoesNotOverwriteSource } from '../src/invariants.js';
import { assertCanSubmitProviderJob, canSubmitProviderJob, canTransition } from '../src/job-state-machine.js';
import { PRESERVATION_DEFAULTS, previewTouchesSourceFile } from '../src/provenance.js';
import { canCommitUsage, usageOutcomeForJobState, type LedgerEntryLike } from '../src/usage.js';
import { RIGHTS_STATEMENT, evaluateProcessingPolicy, type PolicyEvaluationInput } from '../src/policy.js';
import { authorize, roleHasPermission } from '../src/tenancy.js';
import { EVIDENCE_STATUSES, JOB_STATES } from '../src/vocabulary.js';
import { planPreview } from '../src/preview.js';

const now = new Date('2026-09-15T00:00:00.000Z');
const policyInput = (over: Partial<PolicyEvaluationInput> = {}): PolicyEvaluationInput => ({
  actor: { userId: 'u1', workspaceId: 'ws1', role: 'member' },
  assetId: 'a1',
  assetWorkspaceId: 'ws1',
  assetSourceFileId: 'sf1',
  operations: ['inpaint'],
  attestation: {
    assetId: 'a1',
    sourceFileId: 'sf1',
    statementId: RIGHTS_STATEMENT.id,
    statementVersion: RIGHTS_STATEMENT.version,
    attestedAt: '2026-09-14T00:00:00.000Z',
    status: 'active',
  },
  mediaValid: true,
  removeProvenanceRequested: false,
  now,
  ...over,
});

describe('Invariants (regression)', () => {
  it('I-1: output khong bao gio ghi de file goc, luon co link toi source', () => {
    const source = { id: 's1', storageKey: 'ws1/source/abc.mp4' };
    expect(
      assertOutputDoesNotOverwriteSource(source, { storageKey: 'ws1/source/abc.mp4', sourceAssetId: 'a1' }).ok,
    ).toBe(false);
    expect(
      assertOutputDoesNotOverwriteSource(source, { storageKey: 'ws1/output/abc-1.mp4', sourceAssetId: '' }).ok,
    ).toBe(false);
    expect(
      assertOutputDoesNotOverwriteSource(source, { storageKey: 'ws1/output/abc-1.mp4', sourceAssetId: 'a1' }).ok,
    ).toBe(true);
  });

  it('I-2: khong completed khi output chua ton tai hoac chua verified', () => {
    expect(canTransition('processing', 'completed', {}).allowed).toBe(false);
    expect(canTransition('processing', 'completed', { outputAssetId: 'o1', outputValidated: false }).allowed).toBe(false);
    expect(canTransition('processing', 'completed', { outputAssetId: '', outputValidated: true }).allowed).toBe(false);
    expect(canTransition('processing', 'completed', { outputAssetId: 'o1', outputValidated: true }).allowed).toBe(true);
  });

  it('I-3: blocked khong bao gio submit provider job', () => {
    expect(canSubmitProviderJob('blocked')).toBe(false);
    expect(assertCanSubmitProviderJob('blocked').error?.code).toBe('MCP_STATE_JOB_BLOCKED');
    const decision = evaluateProcessingPolicy(policyInput({ attestation: null }));
    expect(decision.decision).toBe('block');
  });

  it('I-4: blocked khong bao gio quay lai processing', () => {
    for (const target of JOB_STATES) {
      expect(canTransition('blocked', target).allowed).toBe(false);
    }
  });

  it('I-5: attestation khong bao gio duoc suy dien tu membership/role', () => {
    // Owner co moi quyen nhung van bi chan khi thieu attestation.
    for (const role of ['owner', 'admin', 'member'] as const) {
      const d = evaluateProcessingPolicy(policyInput({ actor: { userId: 'u1', workspaceId: 'ws1', role }, attestation: null }));
      expect(d.decision, `role ${role} khong duoc mien attestation`).toBe('block');
      expect(d.errors.map((e) => e.code)).toContain('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    }
    // Contract khong ton tai khai niem "ownership verified"; chi co self-declared.
    expect(Object.keys(RIGHTS_STATEMENT)).not.toContain('ownershipVerified');
  });

  it('I-6: viewer khong tao duoc processing job', () => {
    expect(roleHasPermission('viewer', 'job.create')).toBe(false);
    const d = evaluateProcessingPolicy(policyInput({ actor: { userId: 'u1', workspaceId: 'ws1', role: 'viewer' } }));
    expect(d.decision).toBe('block');
    expect(d.errors.map((e) => e.code)).toContain('MCP_AUTHZ_INSUFFICIENT_ROLE');
  });

  it('I-7: provider failure khong duoc tinh nhu success', () => {
    expect(usageOutcomeForJobState('failed', 'provider_error').entryType).toBe('release');
  });

  it('I-8: retry khong double-charge', () => {
    const entries: LedgerEntryLike[] = [
      { jobId: 'j1', entryType: 'reserve', unitType: 'image_unit', quantity: 1, idempotencyKey: 'j1:r' },
      { jobId: 'j1', entryType: 'commit', unitType: 'image_unit', quantity: 1, idempotencyKey: 'j1:c' },
    ];
    expect(canCommitUsage('j1', entries).error?.code).toBe('MCP_USAGE_DOUBLE_COMMIT');
  });

  it('I-9: preserve metadata/provenance = ON mac dinh, khong tat duoc trong MVP', () => {
    expect(PRESERVATION_DEFAULTS.preserveOriginalMetadata).toBe(true);
    expect(PRESERVATION_DEFAULTS.preserveAiProvenance).toBe(true);
    expect(PRESERVATION_DEFAULTS.allowRemoveProvenance).toBe(false);
    expect(previewTouchesSourceFile()).toBe(false);
  });

  it('I-10: tai nguyen ngoai workspace khong lo su ton tai', () => {
    const authzDenied = authorize({
      actorUserId: 'u1',
      actorWorkspaceId: 'ws1',
      actorRole: 'owner',
      resourceWorkspaceId: 'ws2',
      resourceType: 'job',
      resourceId: 'j-secret',
      permission: 'job.read',
    });
    expect(authzDenied.revealsResourceExistence).toBe(false);
    expect(authzDenied.auditDetail.resourceId).toBeNull();

    const policyDenied = evaluateProcessingPolicy(policyInput({ assetWorkspaceId: 'ws2' }));
    expect(policyDenied.revealsResourceExistence).toBe(false);
    expect(JSON.stringify(policyDenied.auditDetail)).not.toContain('a1');
  });

  it('I-11: JobState.blocked va EvidenceStatus.blocked la hai namespace tach biet', () => {
    expect(JOB_STATES).toContain('blocked');
    expect(EVIDENCE_STATUSES).toContain('blocked');
    const jobSet = new Set<string>(JOB_STATES);
    expect(EVIDENCE_STATUSES.every((v) => jobSet.has(v))).toBe(false);
    const evidenceSet = new Set<string>(EVIDENCE_STATUSES);
    expect(JOB_STATES.every((v) => evidenceSet.has(v))).toBe(false);
  });

  it('I-12: preview khong bao gio bi tinh vao video-minute usage', () => {
    const plan = planPreview({ jobId: 'j1', sourceFileId: 'sf1', operations: ['tracked_inpaint'] });
    expect(plan.billable).toBe(false);
    expect(plan.providerJobBudget).toBeLessThanOrEqual(1);
  });

  it('registry invariant du 12 muc va deu co mo ta', () => {
    expect(Object.keys(INVARIANTS)).toHaveLength(12);
    for (const [id, text] of Object.entries(INVARIANTS)) {
      expect(text.length, `${id} thieu mo ta`).toBeGreaterThan(20);
    }
  });
});
