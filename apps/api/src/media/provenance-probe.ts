/**
 * Do dau vet nguon goc tren BYTE THAT (P2-MCP-30).
 *
 * Hai thu khac han nhau, khong duoc gop:
 *
 *  - `originalMetadataPresence`: EXIF / ICC / XMP / IPTC. Cai nay DO DUOC - libvips doc duoc
 *    that su, nen tra 'present' hoac 'absent' deu la ket luan co co so.
 *
 *  - `aiProvenancePresence`: dau vet C2PA / Content Credentials. He thong nay KHONG CO bo doc
 *    nao cho chuan do (Q-12 con mo), nen luon tra 'unknown'. KHONG duoc tra 'absent': 'absent'
 *    nghia la "da tim va khong thay", con su that la "chua tung tim". Nham hai cai nay chinh la
 *    loi D-044 vua sua o tang hop dong.
 *
 * Guardrail 4: he thong khong phat hien, khong go va khong cam ket kiem soat dau an vo hinh
 * (ke ca SynthID). Bo do nay cung khong gia vo lam duoc dieu do.
 */
import sharp from 'sharp';
import type { MediaType, Presence, ProvenanceProbe } from '@mediaclear/contracts';

/** Ten bo do, ghi vao ban ghi de ve sau biet ket luan den tu dau. */
export const METADATA_DETECTOR_ID = 'libvips-metadata-v1';

/** Noi thang gioi han, khong giau trong tai lieu. */
export const C2PA_LIMITATION_NOTE =
  'Chua co bo doc C2PA / Content Credentials. Dau vet AI trong tep KHONG duoc kiem tra.';

/**
 * Do tren byte that. Khong nem loi: tep hong hay dinh dang khong doc duoc thi tra 'unknown',
 * vi mot phep do that bai KHONG phai la bang chung rang metadata khong ton tai.
 */
export async function probeProvenance(bytes: Uint8Array, mediaType: MediaType): Promise<ProvenanceProbe> {
  const base = {
    aiProvenancePresence: 'unknown' as Presence,
    detectorId: METADATA_DETECTOR_ID,
    detectorLimitationNote: C2PA_LIMITATION_NOTE,
  };

  if (mediaType !== 'image') {
    /*
     * Video: chua co duong doc metadata nao trong he thong (header-probe chi doc kich thuoc
     * va thoi luong). Noi 'unknown' chu khong doan.
     */
    return { ...base, originalMetadataPresence: 'unknown' };
  }

  try {
    const meta = await sharp(Buffer.from(bytes)).metadata();
    const hasAny =
      (meta.exif?.length ?? 0) > 0 ||
      (meta.icc?.length ?? 0) > 0 ||
      (meta.xmp?.length ?? 0) > 0 ||
      (meta.iptc?.length ?? 0) > 0;
    return { ...base, originalMetadataPresence: hasAny ? 'present' : 'absent' };
  } catch {
    return { ...base, originalMetadataPresence: 'unknown' };
  }
}
