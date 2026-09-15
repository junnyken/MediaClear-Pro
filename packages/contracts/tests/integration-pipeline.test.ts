/**
 * Integration test: ghep CAC CONTRACT THAT lai voi nhau theo dung thu tu nghiep vu
 * (validate -> policy -> reserve -> provider -> verify output -> commit) tren mot
 * storage adapter in-memory.
 *
 * GIOI HAN TRUNG THUC: day KHONG phai pipeline xu ly media that. Khong co ffmpeg,
 * khong goi provider AI that, khong co DB. Muc tieu la chung minh cac contract
 * khop nhau va khong co duong tat nao vuot qua gate.
 */
import { describe, expect, it } from 'vitest';
import { validateMedia, type MediaProbe } from '../src/media-limits.js';
import { RIGHTS_STATEMENT, evaluateProcessingPolicy, type PolicyEvaluationInput } from '../src/policy.js';
import { assertCanSubmitProviderJob, canTransition } from '../src/job-state-machine.js';
import {
  canCommitUsage,
  canReserveUsage,
  computeUsageQuantity,
  usageEffectOfError,
  usageOutcomeForJobState,
  type LedgerEntryLike,
} from '../src/usage.js';
import { NoopContractProvider } from '../src/providers/noop-provider.js';
import { InMemoryStorageAdapter } from '../src/storage-adapters/in-memory-adapter.js';
import { storageKeyFor } from '../src/storage.js';
import { assertOutputDoesNotOverwriteSource } from '../src/invariants.js';
import { roleHasPermission } from '../src/tenancy.js';
import type { WorkspaceRole } from '../src/tenancy.js';

const NOW = new Date('2026-09-15T00:00:00.000Z');
const BUCKET = 'mediaclear-test';

const probe = (over: Partial<MediaProbe> = {}): MediaProbe => ({
  mediaType: 'video',
  mimeType: 'video/mp4',
  byteSize: 5_000_000,
  durationSeconds: 90,
  widthPx: 1080,
  heightPx: 1920,
  corrupt: false,
  ...over,
});

const policyInput = (over: Partial<PolicyEvaluationInput> = {}): PolicyEvaluationInput => ({
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
    attestedAt: '2026-09-10T00:00:00.000Z',
    status: 'active',
  },
  mediaValid: true,
  removeProvenanceRequested: false,
  now: NOW,
  ...over,
});

/** Ledger don gian trong bo nho, ap dung dung quy tac cua contract usage. */
class Ledger {
  readonly entries: LedgerEntryLike[] = [];

  reserve(jobId: string, unitType: LedgerEntryLike['unitType'], quantity: number): boolean {
    if (!canReserveUsage(jobId, this.entries).allowed) return false;
    this.entries.push({ jobId, entryType: 'reserve', unitType, quantity, idempotencyKey: `${jobId}:reserve` });
    return true;
  }

  commit(jobId: string, unitType: LedgerEntryLike['unitType'], quantity: number): boolean {
    if (!canCommitUsage(jobId, this.entries).allowed) return false;
    this.entries.push({ jobId, entryType: 'commit', unitType, quantity, idempotencyKey: `${jobId}:commit` });
    return true;
  }

  release(jobId: string, unitType: LedgerEntryLike['unitType'], quantity: number): void {
    this.entries.push({ jobId, entryType: 'release', unitType, quantity, idempotencyKey: `${jobId}:release` });
  }

  committedQuantity(): number {
    return this.entries.filter((e) => e.entryType === 'commit').reduce((sum, e) => sum + e.quantity, 0);
  }
}

describe('Integration: contract pipeline', () => {
  it('upload -> validate -> policy -> reserve -> output verified -> commit', async () => {
    const storage = new InMemoryStorageAdapter();
    const ledger = new Ledger();
    const sourceKey = storageKeyFor('ws1', 'source', 'sf1', 'mp4');
    await storage.putObject({ bucket: BUCKET, key: sourceKey }, new Uint8Array([1, 2, 3]), 'video/mp4');

    // 1) Validate truoc khi tao job.
    const validation = validateMedia(probe());
    expect(validation.valid).toBe(true);

    // 2) Policy gate.
    const decision = evaluateProcessingPolicy(policyInput({ mediaValid: validation.valid }));
    expect(decision.decision).toBe('allow');

    // 3) Reserve usage (video 90s -> 2 phut).
    const quantity = computeUsageQuantity({ mediaType: 'video', durationSeconds: 90 });
    expect(quantity.ok && quantity.value.quantity).toBe(2);
    expect(ledger.reserve('job1', 'video_minute_unit', 2)).toBe(true);

    // 4) Job chay den processing, duoc phep submit provider.
    expect(canTransition('uploaded', 'validating').allowed).toBe(true);
    expect(canTransition('validating', 'queued').allowed).toBe(true);
    expect(assertCanSubmitProviderJob('queued').allowed).toBe(true);
    expect(canTransition('queued', 'processing').allowed).toBe(true);

    // 5) Output la object MOI, khong ghi de source.
    const outputKey = storageKeyFor('ws1', 'output', 'o1', 'mp4');
    await storage.putObject({ bucket: BUCKET, key: outputKey }, new Uint8Array([9]), 'video/mp4');
    expect(
      assertOutputDoesNotOverwriteSource(
        { id: 'sf1', storageKey: sourceKey },
        { storageKey: outputKey, sourceAssetId: 'a1' },
      ).ok,
    ).toBe(true);
    expect((await storage.head({ bucket: BUCKET, key: sourceKey })).byteSize).toBe(3);

    // 6) Chi completed khi output verified, va commit dung mot lan.
    expect(canTransition('processing', 'completed', { outputAssetId: 'o1', outputValidated: true }).allowed).toBe(true);
    expect(usageOutcomeForJobState('completed', null).entryType).toBe('commit');
    expect(ledger.commit('job1', 'video_minute_unit', 2)).toBe(true);
    expect(ledger.committedQuantity()).toBe(2);

    // 7) Retry gui lai commit khong tao lan tinh phi thu hai.
    expect(ledger.commit('job1', 'video_minute_unit', 2)).toBe(false);
    expect(ledger.committedQuantity()).toBe(2);
  });

  it('upload khong hop le bi chan TRUOC khi submit provider job', () => {
    const validation = validateMedia(probe({ durationSeconds: 600 }));
    expect(validation.valid).toBe(false);
    const decision = evaluateProcessingPolicy(policyInput({ mediaValid: validation.valid }));
    expect(decision.decision).toBe('block');
    // Job bi block => khong bao gio duoc submit provider.
    expect(assertCanSubmitProviderJob('blocked').allowed).toBe(false);
  });

  it('provider that bai => release reservation, khong commit', async () => {
    const ledger = new Ledger();
    expect(ledger.reserve('job2', 'image_unit', 1)).toBe(true);

    const provider = new NoopContractProvider();
    const ref = await provider.submit({
      jobId: 'job2',
      operation: 'visible_logo_cleanup',
      mediaType: 'image',
      sourceUrl: 'memory://source',
      regions: [],
      preserveOriginalMetadata: true,
      preserveAiProvenance: true,
      idempotencyKey: 'job2',
    });
    const status = await provider.getStatus(ref);
    expect(status.state).toBe('failed');

    const effect = usageEffectOfError(status.errorCode!);
    expect(effect.releasesReservation).toBe(true);
    ledger.release('job2', 'image_unit', 1);

    expect(usageOutcomeForJobState('failed', 'provider_error').entryType).toBe('release');
    expect(ledger.commit('job2', 'image_unit', 1)).toBe(false);
    expect(ledger.committedQuantity()).toBe(0);
  });

  it('job fail truoc khi provider chay => khong co commit nao', () => {
    const ledger = new Ledger();
    // Chua reserve (fail tu buoc validate) => commit bi tu choi.
    expect(ledger.commit('job3', 'image_unit', 1)).toBe(false);
    expect(ledger.committedQuantity()).toBe(0);
  });

  it('workspace isolation: khong doc duoc asset cua workspace khac', () => {
    const decision = evaluateProcessingPolicy(policyInput({ assetWorkspaceId: 'ws-other' }));
    expect(decision.decision).toBe('block');
    expect(decision.errors[0]?.code).toBe('MCP_AUTHZ_WORKSPACE_ACCESS_DENIED');
    expect(decision.revealsResourceExistence).toBe(false);
  });

  it('viewer khong tao duoc job; member khong quan ly duoc billing', () => {
    const viewer = evaluateProcessingPolicy(
      policyInput({ actor: { userId: 'u2', workspaceId: 'ws1', role: 'viewer' } }),
    );
    expect(viewer.decision).toBe('block');
    expect(viewer.errors[0]?.code).toBe('MCP_AUTHZ_INSUFFICIENT_ROLE');
    expect(roleHasPermission('member' as WorkspaceRole, 'billing.manage')).toBe(false);
  });

  it('attestation thieu hoac het han chan xu ly', () => {
    expect(evaluateProcessingPolicy(policyInput({ attestation: null })).decision).toBe('block');
    const expired = evaluateProcessingPolicy(
      policyInput({
        attestation: { ...policyInput().attestation!, attestedAt: '2020-01-01T00:00:00.000Z' },
      }),
    );
    expect(expired.errors.map((e) => e.code)).toContain('MCP_POLICY_RIGHTS_ATTESTATION_EXPIRED');
  });

  it('job blocked khong the quay lai processing bang bat ky duong nao', () => {
    expect(canTransition('blocked', 'processing').allowed).toBe(false);
    expect(canTransition('blocked', 'queued').allowed).toBe(false);
    expect(canTransition('blocked', 'validating').allowed).toBe(false);
    expect(assertCanSubmitProviderJob('blocked').error?.code).toBe('MCP_STATE_JOB_BLOCKED');
  });
});
