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

  /*
   * D-044. Bon ca duoi day TRUOC DAY khong ca nao duoc kiem, va ham tra ve 'verified' cho ca
   * bon. Do la loi khai "da kiem chung" ve thu chua he duoc do.
   */
  describe('khong do duoc dau vet AI thi KHONG duoc bao verified (D-044)', () => {
    it('khong do duoc ca truoc lan sau => unknown', () => {
      const r = evaluatePreservation(
        probe({ aiProvenancePresence: 'unknown' }),
        probe({ aiProvenancePresence: 'unknown' }),
        true,
      );
      expect(r.result).toBe('unknown');
      expect(r.evidenceStatus).toBe('unknown');
    });

    it('CA NANG NHAT: truoc khong do duoc, sau do duoc la MAT => van khong duoc bao preserved', () => {
      const r = evaluatePreservation(
        probe({ aiProvenancePresence: 'unknown' }),
        probe({ aiProvenancePresence: 'absent' }),
        true,
      );
      expect(r.result).not.toBe('preserved');
      expect(r.evidenceStatus).not.toBe('verified');
      expect(r.result).toBe('unknown');
    });

    it('truoc do duoc, sau khong do duoc => unknown', () => {
      const r = evaluatePreservation(probe(), probe({ aiProvenancePresence: 'unknown' }), true);
      expect(r.result).toBe('unknown');
      expect(r.evidenceStatus).toBe('unknown');
    });

    it('DO DUOC la khong co tu dau => van duoc bao preserved (y dinh goc con nguyen)', () => {
      const r = evaluatePreservation(
        probe({ aiProvenancePresence: 'absent' }),
        probe({ aiProvenancePresence: 'absent' }),
        true,
      );
      expect(r.result).toBe('preserved');
      expect(r.evidenceStatus).toBe('verified');
    });

    it('metadata MAT van bao "lost" du dau vet AI khong do duoc - phat hien that phai duoc noi', () => {
      const r = evaluatePreservation(
        probe({ aiProvenancePresence: 'unknown' }),
        probe({ originalMetadataPresence: 'absent', aiProvenancePresence: 'unknown' }),
        true,
      );
      expect(r.result).toBe('lost');
    });
  });

  it('preview khong dong vao file goc (I-5)', () => {
    expect(previewTouchesSourceFile()).toBe(false);
  });

  it('co disclaimer watermark vo hinh (guardrail 4)', () => {
    expect(INVISIBLE_WATERMARK_DISCLAIMER_KEY).toBe('provenance.invisible_watermark_disclaimer');
  });
});
