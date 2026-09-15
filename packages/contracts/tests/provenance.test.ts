import { describe, expect, it } from 'vitest';
import {
  INVISIBLE_WATERMARK_DISCLAIMER_KEY,
  PRESERVATION_DEFAULTS,
  evaluatePreservation,
  previewTouchesSourceFile,
  type ProvenanceProbe,
} from '../src/provenance.js';

const probe = (over: Partial<ProvenanceProbe> = {}): ProvenanceProbe => ({
  originalMetadataPresence: 'present',
  aiProvenancePresence: 'present',
  detectorId: null,
  detectorLimitationNote: null,
  ...over,
});

describe('MCP-05 metadata / provenance', () => {
  it('preserve metadata + provenance mac dinh ON, khong co tuy chon xoa (I-8)', () => {
    expect(PRESERVATION_DEFAULTS.preserveOriginalMetadata).toBe(true);
    expect(PRESERVATION_DEFAULTS.preserveAiProvenance).toBe(true);
    expect(PRESERVATION_DEFAULTS.allowRemoveProvenance).toBe(false);
  });

  it('chua thu bao toan => unconfirmed, khong bao preserved', () => {
    const r = evaluatePreservation(probe(), probe(), false);
    expect(r.result).toBe('unknown');
    expect(r.evidenceStatus).toBe('unconfirmed');
  });

  it('khong do duoc sau xu ly => unknown, khong duoc bao verified', () => {
    expect(evaluatePreservation(probe(), null, true).evidenceStatus).toBe('unknown');
    expect(
      evaluatePreservation(probe(), probe({ originalMetadataPresence: 'unknown' }), true).result,
    ).toBe('unknown');
  });

  it('metadata bi mat => bao "lost", khong im lang cho qua', () => {
    const r = evaluatePreservation(probe(), probe({ originalMetadataPresence: 'absent' }), true);
    expect(r.result).toBe('lost');
  });

  it('mat provenance AI nhung con metadata => partial, khong phai preserved', () => {
    const r = evaluatePreservation(probe(), probe({ aiProvenancePresence: 'absent' }), true);
    expect(r.result).toBe('partial');
    expect(r.evidenceStatus).toBe('partially_verified');
  });

  it('giu duoc ca hai => preserved/verified', () => {
    expect(evaluatePreservation(probe(), probe(), true).result).toBe('preserved');
  });

  it('preview khong dong vao file goc (I-5)', () => {
    expect(previewTouchesSourceFile()).toBe(false);
  });

  it('co disclaimer watermark vo hinh (guardrail 4)', () => {
    expect(INVISIBLE_WATERMARK_DISCLAIMER_KEY).toBe('provenance.invisible_watermark_disclaimer');
  });
});
