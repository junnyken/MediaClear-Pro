import { describe, expect, it } from 'vitest';
import { ALLOWED_TRANSITIONS, canSubmitProviderJob, canTransition } from '../src/job-state-machine.js';
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

  it('blocked la terminal: go block phai tao job moi (D-005)', () => {
    expect(canTransition('blocked', 'validating').allowed).toBe(false);
    expect(canTransition('blocked', 'queued').allowed).toBe(false);
  });

  it('canSubmitProviderJob chi true o queued/processing', () => {
    for (const s of JOB_STATES) {
      expect(canSubmitProviderJob(s)).toBe(s === 'queued' || s === 'processing');
    }
  });
});
