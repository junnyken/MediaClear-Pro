import { describe, expect, it } from 'vitest';
import {
  CLEANUP_OPERATIONS,
  EVIDENCE_STATUSES,
  JOB_STATES,
  MEDIA_TYPES,
  TERMINAL_JOB_STATES,
  isTerminalJobState,
} from '../src/vocabulary.js';

describe('MCP-01 stable vocabulary', () => {
  it('chot dung bo gia tri theo spec Phase 0', () => {
    expect([...MEDIA_TYPES]).toEqual(['image', 'video']);
    expect([...CLEANUP_OPERATIONS]).toEqual([
      'visible_logo_cleanup',
      'visible_text_cleanup',
      'object_cleanup',
      'crop',
      'blur',
      'inpaint',
      'tracked_inpaint',
      'brand_overlay',
    ]);
    expect([...JOB_STATES]).toEqual([
      'uploaded',
      'validating',
      'queued',
      'processing',
      'review_required',
      'completed',
      'failed',
      'blocked',
      'cancelled',
    ]);
    expect([...EVIDENCE_STATUSES]).toEqual([
      'verified',
      'partially_verified',
      'unknown',
      'unconfirmed',
      'blocked',
    ]);
  });

  it('khong co gia tri trung lap trong tung enum', () => {
    for (const list of [MEDIA_TYPES, CLEANUP_OPERATIONS, JOB_STATES, EVIDENCE_STATUSES]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("'blocked' ton tai o ca hai enum nhung la hai namespace khac nhau (D-004)", () => {
    expect(JOB_STATES).toContain('blocked');
    expect(EVIDENCE_STATUSES).toContain('blocked');
    // Hai enum khong duoc phep tron lan: khong enum nao la tap con cua enum kia.
    const jobSet = new Set<string>(JOB_STATES);
    expect(EVIDENCE_STATUSES.every((v) => jobSet.has(v))).toBe(false);
  });

  it('terminal states dung nhu thiet ke', () => {
    expect([...TERMINAL_JOB_STATES].sort()).toEqual(['blocked', 'cancelled', 'completed', 'failed']);
    expect(isTerminalJobState('processing')).toBe(false);
    expect(isTerminalJobState('blocked')).toBe(true);
  });
});
