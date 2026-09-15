import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  assertCanSubmitProviderJob,
  canSubmitProviderJob,
  canTransition,
  resolveBlockedJob,
} from '../src/job-state-machine.js';
import { JOB_STATES } from '../src/vocabulary.js';

describe('MCP-03 job state machine', () => {
  it('luong hop le: uploaded -> validating -> queued -> processing', () => {
    expect(canTransition('uploaded', 'validating').allowed).toBe(true);
    expect(canTransition('validating', 'queued').allowed).toBe(true);
    expect(canTransition('queued', 'processing').allowed).toBe(true);
  });

  it('chan nhay coc: uploaded -> completed', () => {
    const r = canTransition('uploaded', 'completed', { outputAssetId: 'o1', outputValidated: true });
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_STATE_INVALID_TRANSITION');
  });

  it('moi terminal state deu khong co transition ra', () => {
    for (const s of ['completed', 'failed', 'blocked', 'cancelled'] as const) {
      expect(ALLOWED_TRANSITIONS[s]).toEqual([]);
      const r = canTransition(s, 'processing');
      expect(r.allowed).toBe(false);
      expect(r.error?.code).toBe('MCP_STATE_TERMINAL');
    }
  });

  it('bang transition phu het moi state trong vocabulary', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual([...JOB_STATES].sort());
  });

  it('review_required co the quay lai processing (sua lai) hoac completed', () => {
    expect(canTransition('review_required', 'processing').allowed).toBe(true);
    expect(
      canTransition('review_required', 'completed', { outputAssetId: 'o1', outputValidated: true })
        .allowed,
    ).toBe(true);
  });

  it('owner decision Q-08: blocked la terminal, khong co duong tat nao quay lai', () => {
    for (const target of JOB_STATES) {
      expect(canTransition('blocked', target).allowed, `blocked -> ${target}`).toBe(false);
    }
    expect(canTransition('blocked', 'processing').error?.code).toBe('MCP_STATE_TERMINAL');
    expect(canTransition('blocked', 'completed', { outputAssetId: 'o1', outputValidated: true }).allowed).toBe(false);
  });

  it('go block = tao job MOI, job cu giu nguyen trang thai blocked', () => {
    const outcome = resolveBlockedJob();
    expect(outcome.previousJobStaysBlocked).toBe(true);
    expect(outcome.newJobInitialState).toBe('uploaded');
  });

  it('canSubmitProviderJob chi true o queued/processing', () => {
    for (const s of JOB_STATES) {
      expect(canSubmitProviderJob(s)).toBe(s === 'queued' || s === 'processing');
    }
  });

  it('job blocked tra ma loi rieng khi co gang submit provider job', () => {
    const r = assertCanSubmitProviderJob('blocked');
    expect(r.allowed).toBe(false);
    expect(r.error?.code).toBe('MCP_STATE_JOB_BLOCKED');
    expect(assertCanSubmitProviderJob('queued').allowed).toBe(true);
    expect(assertCanSubmitProviderJob('uploaded').error?.code).toBe('MCP_STATE_INVALID_TRANSITION');
  });
});
