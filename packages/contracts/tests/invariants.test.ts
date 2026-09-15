/**
 * Regression tests bao ve invariant Phase 0 (MCP-08).
 * Moi test o day map 1-1 voi mot ID trong INVARIANTS.
 */
import { describe, expect, it } from 'vitest';
import { INVARIANTS, assertOutputDoesNotOverwriteSource } from '../src/invariants.js';
import { canSubmitProviderJob, canTransition } from '../src/job-state-machine.js';
import { PRESERVATION_DEFAULTS, previewTouchesSourceFile } from '../src/provenance.js';
import { canCommitUsage, usageOutcomeForJobState, type LedgerEntryLike } from '../src/usage.js';
import { evaluateProcessingPolicy, RIGHTS_STATEMENT } from '../src/policy.js';

describe('Invariants (regression)', () => {
  it('I-1: output khong bao gio ghi de file goc, luon co link toi source', () => {
    const source = { id: 's1', storageKey: 'ws1/source/abc.mp4' };
    expect(
      assertOutputDoesNotOverwriteSource(source, {
        storageKey: 'ws1/source/abc.mp4',
        sourceAssetId: 'a1',
      }).ok,
    ).toBe(false);
    expect(
      assertOutputDoesNotOverwriteSource(source, { storageKey: 'ws1/output/abc-1.mp4', sourceAssetId: '' })
        .ok,
    ).toBe(false);
    expect(
      assertOutputDoesNotOverwriteSource(source, {
        storageKey: 'ws1/output/abc-1.mp4',
        sourceAssetId: 'a1',
      }).ok,
    ).toBe(true);
  });

  it('I-2: khong completed khi output chua ton tai hoac chua verified', () => {
    expect(canTransition('processing', 'completed', {}).allowed).toBe(false);
    expect(
      canTransition('processing', 'completed', { outputAssetId: 'o1', outputValidated: false }).allowed,
    ).toBe(false);
    expect(
      canTransition('processing', 'completed', { outputAssetId: '', outputValidated: true }).allowed,
    ).toBe(false);
    const ok = canTransition('processing', 'completed', { outputAssetId: 'o1', outputValidated: true });
    expect(ok.allowed).toBe(true);
  });

  it('I-3: blocked khong bao gio submit provider job', () => {
    expect(canSubmitProviderJob('blocked')).toBe(false);
    const decision = evaluateProcessingPolicy({
      workspaceId: 'ws1',
      assetWorkspaceId: 'ws1',
      assetId: 'a1',
      operations: ['inpaint'],
      attestation: null,
      mediaValid: true,
      removeProvenanceRequested: false,
      now: new Date('2026-09-15T00:00:00.000Z'),
    });
    expect(decision.decision).toBe('block');
    // Job bi block => state 'blocked' => gate submit phai tu choi.
    expect(canSubmitProviderJob('blocked')).toBe(false);
  });

  it('I-4: rights confirmation chi la user attestation, khong phai bang chung so huu', () => {
    // Contract khong ton tai khai niem "ownership verified"; chi co self-declared.
    const statementKeys = Object.keys(RIGHTS_STATEMENT);
    expect(statementKeys).not.toContain('ownershipVerified');
    expect(INVARIANTS['I-4']).toMatch(/attestation/i);
  });

  it('I-5: preview khong lam mat metadata goc', () => {
    expect(previewTouchesSourceFile()).toBe(false);
  });

  it('I-6: provider failure khong duoc tinh nhu success', () => {
    expect(usageOutcomeForJobState('failed', 'provider_error').entryType).toBe('release');
  });

  it('I-7: retry khong double-charge', () => {
    const entries: LedgerEntryLike[] = [
      { jobId: 'j1', entryType: 'reserve', unitType: 'image_unit', quantity: 1, idempotencyKey: 'j1:r' },
      { jobId: 'j1', entryType: 'commit', unitType: 'image_unit', quantity: 1, idempotencyKey: 'j1:c' },
    ];
    expect(canCommitUsage('j1', entries).error?.code).toBe('MCP_USAGE_DOUBLE_COMMIT');
  });

  it('I-8: preserve provenance = ON mac dinh, khong tat duoc trong MVP', () => {
    expect(PRESERVATION_DEFAULTS.preserveAiProvenance).toBe(true);
    expect(PRESERVATION_DEFAULTS.allowRemoveProvenance).toBe(false);
  });

  it('moi invariant trong registry deu co mo ta', () => {
    expect(Object.keys(INVARIANTS)).toHaveLength(8);
    for (const [id, text] of Object.entries(INVARIANTS)) {
      expect(text.length, `${id} thieu mo ta`).toBeGreaterThan(20);
    }
  });
});
