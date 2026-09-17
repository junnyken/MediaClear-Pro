/**
 * Do DAU HIEU "tep do AI tao ra" tren byte that (Q-12).
 *
 * PHAM VI — doc ky truoc khi tin ket qua cua no:
 *
 *  - Bo do nay tra loi DUNG MOT cau hoi: "trong tep co ban kha nang (manifest) theo chuan
 *    Content Credentials / C2PA hay khong".
 *  - No KHONG kiem chu ky, KHONG xac thuc chuoi tin cay, KHONG doc noi dung ban kha nang.
 *    "Co dau hieu" KHAC HAN "dau hieu that va con nguyen ven". Ai doc ket qua nay ma hieu thanh
 *    "da xac thuc" la hieu sai, nen cau chu cho nguoi dung phai noi ro (xem khoa i18n o duoi).
 *  - Guardrail 4 khong bi dung toi: day van la doc, khong phai phat hien/go dau AN (SynthID...).
 *    Manifest C2PA nam CONG KHAI trong container, khong phai dau vo hinh trong pixel.
 *
 * VI SAO DAM TRA 'absent' O MOT SO DINH DANG MA KHONG PHAI TAT CA:
 *
 * `absent` nghia la "da tim va khong thay" — dung chi khi da tim HET cho co the chua. Cac
 * container duoi day deu la dang the (the noi tiep the), nen duyet het the la duyet het cho:
 *
 *  - JPEG : doan APP11 (0xFFEB)  -> duyet het segment
 *  - PNG  : the `caBX`           -> duyet het chunk
 *  - WebP : the `C2PA` trong RIFF-> duyet het chunk
 *  - MP4/MOV (BMFF): the `uuid`  -> duyet het box muc goc
 *
 * Con lai tra 'unknown', KHONG tra 'absent':
 *
 *  - WebM/Matroska: cau truc EBML khac han, cho dat manifest chua duoc chuan hoa ro. Chua duyet
 *    duoc het cho thi khong duoc noi "khong co".
 *  - Container khong nhan dang duoc, hoac tep hong giua chung.
 *
 * Nham 'unknown' voi 'absent' chinh la loi `D-044`, va do la loi de lam nhat o day.
 */
import type { Presence } from '@mediaclear/contracts';

export const C2PA_DETECTOR_ID = 'c2pa-presence-v1';

/**
 * UUID cua box `uuid` chua manifest trong BMFF (MP4/MOV/HEIF) theo chuan C2PA.
 *
 * GIOI HAN THAT, noi thang: hang so nay lay tu HIEU BIET VE CHUAN, khong phai tu mot tep that do
 * cong cu that sinh ra. Neu no sai thi `detectBmff` se khong bao gio khop — va test cua chinh
 * no cung khong phat hien duoc, vi fixture duoc dung tu cung hang so nay.
 *
 * Vi vay `detectBmff` con tim CA nhan ASCII `c2pa` ben trong box `uuid`: hai duong doc lap, sai
 * mot duong van con duong kia. Va tai lieu ghi ro: CHUA doi chieu voi tep that.
 */
export const C2PA_BMFF_UUID = Uint8Array.from([
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c, 0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81,
]);

/** Nhan JUMBF cua kho manifest. Xuat hien duoi dang ASCII trong box mo ta. */
const C2PA_LABEL = Uint8Array.from([0x63, 0x32, 0x70, 0x61]); // "c2pa"

export interface C2paScan {
  presence: Presence;
  /** Container da nhan dang duoc; `null` khi khong nhan ra. */
  container: 'jpeg' | 'png' | 'webp' | 'bmff' | 'matroska' | null;
  /** Noi tim thay dau hieu, de ve sau doi chieu duoc. `null` khi khong thay. */
  foundIn: string | null;
}

function startsWith(bytes: Uint8Array, at: number, sig: readonly number[]): boolean {
  if (at + sig.length > bytes.length) return false;
  for (let i = 0; i < sig.length; i += 1) if (bytes[at + i] !== sig[i]) return false;
  return true;
}

/** Tim mot chuoi byte trong mot doan. Doan ngan nen quet thang la du. */
function indexOfBytes(hay: Uint8Array, needle: Uint8Array, from: number, to: number): number {
  const end = Math.min(to, hay.length) - needle.length;
  outer: for (let i = Math.max(0, from); i <= end; i += 1) {
    for (let k = 0; k < needle.length; k += 1) if (hay[i + k] !== needle[k]) continue outer;
    return i;
  }
  return -1;
}

const be32 = (b: Uint8Array, at: number): number =>
  ((b[at]! << 24) >>> 0) + (b[at + 1]! << 16) + (b[at + 2]! << 8) + b[at + 3]!;
const le32 = (b: Uint8Array, at: number): number =>
  b[at]! + (b[at + 1]! << 8) + (b[at + 2]! << 16) + ((b[at + 3]! << 24) >>> 0);

/** JPEG: duyet segment, soi payload cua APP11. */
function detectJpeg(b: Uint8Array): C2paScan {
  let i = 2; // bo qua SOI
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return { presence: 'unknown', container: 'jpeg', foundIn: null }; // lech khung => khong dam ket luan
    const marker = b[i + 1]!;
    // SOS: tu day la du lieu nen, khong con segment metadata nao nua.
    if (marker === 0xda) break;
    if (marker === 0xd9) break; // EOI
    const len = (b[i + 2]! << 8) + b[i + 3]!;
    if (len < 2 || i + 2 + len > b.length) return { presence: 'unknown', container: 'jpeg', foundIn: null };
    if (marker === 0xeb) {
      // APP11. C2PA dat kho JUMBF o day; nhan `c2pa` nam trong box mo ta.
      if (indexOfBytes(b, C2PA_LABEL, i + 4, i + 2 + len) >= 0) {
        return { presence: 'present', container: 'jpeg', foundIn: 'jpeg:APP11' };
      }
    }
    i += 2 + len;
  }
  return { presence: 'absent', container: 'jpeg', foundIn: null };
}

/** PNG: duyet chunk, tim `caBX`. */
function detectPng(b: Uint8Array): C2paScan {
  let i = 8; // bo qua chu ky
  while (i + 8 <= b.length) {
    const len = be32(b, i);
    if (len < 0 || i + 12 + len > b.length) return { presence: 'unknown', container: 'png', foundIn: null };
    const type = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    if (type === 'caBX') return { presence: 'present', container: 'png', foundIn: 'png:caBX' };
    if (type === 'IEND') break;
    i += 12 + len; // len + type(4) + data + crc(4)
  }
  return { presence: 'absent', container: 'png', foundIn: null };
}

/** WebP (RIFF): duyet chunk, tim FourCC `C2PA`. */
function detectWebp(b: Uint8Array): C2paScan {
  let i = 12; // 'RIFF' + size + 'WEBP'
  while (i + 8 <= b.length) {
    const type = String.fromCharCode(b[i]!, b[i + 1]!, b[i + 2]!, b[i + 3]!);
    const len = le32(b, i + 4);
    if (len < 0 || i + 8 + len > b.length) return { presence: 'unknown', container: 'webp', foundIn: null };
    if (type === 'C2PA') return { presence: 'present', container: 'webp', foundIn: 'webp:C2PA' };
    i += 8 + len + (len % 2); // chunk RIFF can le duoc dem mot byte
  }
  return { presence: 'absent', container: 'webp', foundIn: null };
}

/** BMFF (MP4/MOV): duyet box muc goc, soi box `uuid`. */
function detectBmff(b: Uint8Array): C2paScan {
  let i = 0;
  while (i + 8 <= b.length) {
    let size = be32(b, i);
    const type = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!);
    let header = 8;
    if (size === 1) {
      // size 64-bit. Chi doc 32 bit thap: tep lon hon 4GB khong nam trong pham vi he thong nay.
      if (i + 16 > b.length) return { presence: 'unknown', container: 'bmff', foundIn: null };
      if (be32(b, i + 8) !== 0) return { presence: 'unknown', container: 'bmff', foundIn: null };
      size = be32(b, i + 12);
      header = 16;
    } else if (size === 0) {
      size = b.length - i; // box keo toi het tep
    }
    if (size < header || i + size > b.length) return { presence: 'unknown', container: 'bmff', foundIn: null };
    if (type === 'uuid') {
      const uuidAt = i + header;
      if (uuidAt + 16 <= b.length) {
        let same = true;
        for (let k = 0; k < 16; k += 1) if (b[uuidAt + k] !== C2PA_BMFF_UUID[k]) { same = false; break; }
        if (same) return { presence: 'present', container: 'bmff', foundIn: 'bmff:uuid' };
      }
      // Duong doc thu hai, doc lap voi hang so UUID o tren.
      if (indexOfBytes(b, C2PA_LABEL, uuidAt, i + size) >= 0) {
        return { presence: 'present', container: 'bmff', foundIn: 'bmff:uuid+label' };
      }
    }
    i += size;
  }
  return { presence: 'absent', container: 'bmff', foundIn: null };
}

/**
 * Nhan dang container roi giao cho bo duyet tuong ung.
 *
 * Khong nem loi: tep hong tra 'unknown'. Mot phep do THAT BAI khong phai bang chung rang dau
 * hieu khong ton tai.
 */
export function detectC2pa(bytes: Uint8Array): C2paScan {
  const b = bytes;
  try {
    if (b.length >= 3 && startsWith(b, 0, [0xff, 0xd8, 0xff])) return detectJpeg(b);
    if (startsWith(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return detectPng(b);
    if (startsWith(b, 0, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, 8, [0x57, 0x45, 0x42, 0x50])) {
      return detectWebp(b);
    }
    // EBML (WebM/Matroska): cau truc khac han, chua duyet het cho duoc => khong noi 'absent'.
    if (startsWith(b, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
      return { presence: 'unknown', container: 'matroska', foundIn: null };
    }
    // BMFF nhan ra bang box `ftyp` o dau (offset 4).
    if (b.length >= 12 && startsWith(b, 4, [0x66, 0x74, 0x79, 0x70])) return detectBmff(b);
    return { presence: 'unknown', container: null, foundIn: null };
  } catch {
    return { presence: 'unknown', container: null, foundIn: null };
  }
}
