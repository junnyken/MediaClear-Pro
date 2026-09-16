/**
 * MediaClear Pro - Metadata / provenance / receipt contract (MCP-05).
 *
 * Guardrail 4: KHONG tuyen bo xoa/vo hieu hoa/kiem soat SynthID hay watermark vo hinh.
 * Guardrail 6: preserve metadata + preserve AI provenance mac dinh ON.
 * Guardrail 7: MVP khong co tuy chon 'remove provenance'.
 */
import type { EvidenceStatus, Presence, PreservationResult } from './vocabulary.js';

export const PRESERVATION_DEFAULTS = {
  preserveOriginalMetadata: true,
  preserveAiProvenance: true,
  /** Khong ton tai trong MVP. Giu bien nay de test khang dinh no luon false. */
  allowRemoveProvenance: false,
} as const;

/** i18n key cua disclaimer bat buoc hien thi o man Provenance review + export. */
export const INVISIBLE_WATERMARK_DISCLAIMER_KEY = 'provenance.invisible_watermark_disclaimer';

export interface ProvenanceProbe {
  originalMetadataPresence: Presence;
  aiProvenancePresence: Presence;
  /** Gioi han that cua bo do hien tai; null neu chua co bo do nao. */
  detectorId: string | null;
  detectorLimitationNote: string | null;
}

export interface PreservationOutcome {
  requested: boolean;
  attempted: boolean;
  result: PreservationResult;
  evidenceStatus: EvidenceStatus;
}

/**
 * Suy ra evidence status cua mot lan bao toan metadata.
 * Quy tac: chua do duoc (unknown) thi KHONG duoc bao 'verified'.
 */
export function evaluatePreservation(
  probeBefore: ProvenanceProbe,
  probeAfter: ProvenanceProbe | null,
  attempted: boolean,
): PreservationOutcome {
  if (!attempted) {
    return { requested: true, attempted: false, result: 'unknown', evidenceStatus: 'unconfirmed' };
  }
  if (probeAfter === null) {
    return { requested: true, attempted: true, result: 'unknown', evidenceStatus: 'unknown' };
  }
  if (probeBefore.originalMetadataPresence === 'unknown' || probeAfter.originalMetadataPresence === 'unknown') {
    return { requested: true, attempted: true, result: 'unknown', evidenceStatus: 'unknown' };
  }
  if (probeBefore.originalMetadataPresence === 'present' && probeAfter.originalMetadataPresence === 'absent') {
    return { requested: true, attempted: true, result: 'lost', evidenceStatus: 'verified' };
  }
  /*
   * D-044. 'unknown' KHONG phai 'absent'.
   *
   * Ban dau dieu kien duoi day gop chung hai gia tri do: `before.ai !== 'present'` dung cho ca
   * "do duoc la khong co" lan "khong do duoc". Hau qua do duoc that: voi
   * `before.ai='unknown', after.ai='absent'` ham tra ve `preserved` / `verified` - tuc la khai
   * DA KIEM CHUNG rang dau vet AI con nguyen, ngay trong ca bo do vua thay no BIEN MAT.
   *
   * He thong nay KHONG doc duoc C2PA (Q-12 con mo), nen bo do that luon tra 'unknown'. Neu
   * khong chan o day, MOI bien nhan se mang mot loi khai khong co co so nao.
   *
   * Y dinh goc ("khong co gi thi khong mat gi") duoc giu - nhung phai DO DUOC la khong co.
   */
  if (probeBefore.aiProvenancePresence === 'unknown' || probeAfter.aiProvenancePresence === 'unknown') {
    return { requested: true, attempted: true, result: 'unknown', evidenceStatus: 'unknown' };
  }

  const provenanceHeld =
    probeBefore.aiProvenancePresence !== 'present' || probeAfter.aiProvenancePresence === 'present';
  return {
    requested: true,
    attempted: true,
    result: provenanceHeld ? 'preserved' : 'partial',
    evidenceStatus: provenanceHeld ? 'verified' : 'partially_verified',
  };
}

/**
 * Invariant I-5: preview la ban render phai sinh, KHONG dong vao SourceFile.
 * Ham nay chi de contract test khang dinh y dinh thiet ke.
 */
export function previewTouchesSourceFile(): false {
  return false;
}
