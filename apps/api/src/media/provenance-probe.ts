/**
 * Do dau vet nguon goc tren BYTE THAT (P2-MCP-30).
 *
 * Hai thu khac han nhau, khong duoc gop:
 *
 *  - `originalMetadataPresence`: EXIF / ICC / XMP / IPTC. Cai nay DO DUOC - libvips doc duoc
 *    that su, nen tra 'present' hoac 'absent' deu la ket luan co co so.
 *
 *  - `aiProvenancePresence`: dau hieu "tep do AI tao ra" (manifest Content Credentials / C2PA).
 *    Tu `D-069` da CO bo do that (`c2pa-probe.ts`), nhung no chi do SU HIEN DIEN, khong kiem chu
 *    ky. Va no chi tra 'absent' o nhung container da duyet HET cho co the chua (JPEG/PNG/WebP/
 *    MP4-MOV); con lai van 'unknown'. 'absent' nghia la "da tim va khong thay"; "chua tim duoc
 *    het" thi phai la 'unknown' — nham hai cai nay chinh la loi `D-044`.
 *
 * Guardrail 4: he thong khong phat hien, khong go va khong cam ket kiem soat dau an vo hinh
 * (ke ca SynthID). Bo do nay cung khong gia vo lam duoc dieu do.
 */
import sharp from 'sharp';
import type { MediaType, ProvenanceProbe } from '@mediaclear/contracts';
import { C2PA_DETECTOR_ID, detectC2pa } from './c2pa-probe.js';

/** Ten bo do, ghi vao ban ghi de ve sau biet ket luan den tu dau. */
export const METADATA_DETECTOR_ID = 'libvips-metadata-v1';

/**
 * KHOA i18n cua cau noi ve gioi han, KHONG phai cau chu.
 *
 * Ban dau day la mot chuoi tieng Viet KHONG DAU viet thang trong ma nguon - va no di thang ra
 * man hinh nguoi dung qua the "Bien nhan xu ly". Bam tay moi thay. Chu thich trong ma nguon cua
 * repo nay khong dau theo quy uoc, nhung cau chu cho NGUOI DUNG thi phai qua i18n va co dau.
 */
export const C2PA_LIMITATION_KEY = 'provenance.limitation.no_c2pa_reader';

/**
 * Cau noi ve gioi han khi DA do duoc: tim thay/khong tim thay dau hieu, nhung KHONG xac thuc.
 *
 * Phai co khoa rieng, khong dung lai khoa tren: "chua doc duoc" va "doc duoc nhung khong xac
 * thuc" la hai su that khac han nhau, va gop chung lai la noi sai mot trong hai.
 */
export const C2PA_PRESENCE_ONLY_KEY = 'provenance.limitation.presence_only';

/**
 * Do tren byte that. Khong nem loi: tep hong hay dinh dang khong doc duoc thi tra 'unknown',
 * vi mot phep do that bai KHONG phai la bang chung rang metadata khong ton tai.
 */
export async function probeProvenance(bytes: Uint8Array, mediaType: MediaType): Promise<ProvenanceProbe> {
  /*
   * Do dau hieu AI TRUOC, va do tren CUNG mot mang byte voi phep do metadata: hai ket luan trong
   * mot bien nhan phai noi ve dung mot tep.
   */
  const scan = detectC2pa(bytes);
  const base = {
    aiProvenancePresence: scan.presence,
    detectorId: `${METADATA_DETECTOR_ID}+${C2PA_DETECTOR_ID}`,
    // Do duoc thi noi dung gioi han cua phep do; chua do duoc thi noi la chua doc duoc.
    detectorLimitationNote: scan.presence === 'unknown' ? C2PA_LIMITATION_KEY : C2PA_PRESENCE_ONLY_KEY,
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
