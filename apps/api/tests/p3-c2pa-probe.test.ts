/**
 * Q-12 / `D-069`: do dau hieu "tep do AI tao ra".
 *
 * HAI LOAI FIXTURE, va su khac nhau giua chung la phan quan trong nhat cua bo test nay:
 *
 *  - Ca "KHONG co dau hieu" dung **tep THAT trong repo** (`sample.jpg`, `sample.png`,
 *    `video-with-audio.mp4`...). Day moi la bang chung that: bo do khong duoc keu nham tren tep
 *    binh thuong.
 *  - Ca "CO dau hieu" dung tep that DA DUOC CHEN THEM the/segment mang nhan `c2pa`. Cac the nay
 *    **do chinh toi dung theo hieu biet ve chuan**, KHONG phai do cong cu that sinh ra. Neu hieu
 *    biet do sai thi test van xanh ma ban that van truot — gioi han nay duoc ghi ro o `D-069`
 *    va trong `OPEN_QUESTIONS`, khong giau.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectC2pa } from '../src/media/c2pa-probe.js';

const FIXTURES = join(import.meta.dirname, 'fixtures/media');
const real = (name: string): Uint8Array => new Uint8Array(readFileSync(join(FIXTURES, name)));

/** CRC32 cua PNG — de the chen vao van la PNG hop le, khong phai rac. */
function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

const ascii = (s: string): number[] => [...s].map((ch) => ch.charCodeAt(0));
const be32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = (n: number): number[] => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];

/** JPEG: chen mot segment APP11 mang nhan `c2pa` ngay sau SOI. */
function jpegWithMark(src: Uint8Array): Uint8Array {
  const payload = [...ascii('JP'), 0, 1, 0, 0, 0, 1, ...ascii('jumbc2pa')];
  const len = payload.length + 2;
  return Uint8Array.from([...src.slice(0, 2), 0xff, 0xeb, (len >> 8) & 255, len & 255, ...payload, ...src.slice(2)]);
}

/** PNG: chen the `caBX` ngay truoc IEND. */
function pngWithMark(src: Uint8Array): Uint8Array {
  const data = ascii('jumbc2pa-manifest-store');
  const typeAndData = Uint8Array.from([...ascii('caBX'), ...data]);
  const chunk = [...be32(data.length), ...typeAndData, ...be32(crc32(typeAndData))];
  // IEND luon la 12 byte cuoi cung cua mot PNG hop le.
  const cut = src.length - 12;
  return Uint8Array.from([...src.slice(0, cut), ...chunk, ...src.slice(cut)]);
}

/** WebP: chen the `C2PA` vao sau header RIFF. */
function webpWithMark(src: Uint8Array): Uint8Array {
  const data = ascii('jumbc2pa');
  const chunk = [...ascii('C2PA'), ...le32(data.length), ...data];
  const out = Uint8Array.from([...src.slice(0, 12), ...chunk, ...src.slice(12)]);
  // Cap nhat lai kich thuoc RIFF cho khop, neu khong tep thanh rac.
  const riffSize = out.length - 8;
  out.set(le32(riffSize), 4);
  return out;
}

/** BMFF: them mot box `uuid` mang UUID cua C2PA vao cuoi tep. */
function mp4WithMark(src: Uint8Array, uuid: number[]): Uint8Array {
  // Phai mang nhan `c2pa`: day la thu duong doc THU HAI tim, khi hang so UUID khong khop.
  const data = ascii('jumbc2pa-manifest');
  const size = 8 + 16 + data.length;
  return Uint8Array.from([...src, ...be32(size), ...ascii('uuid'), ...uuid, ...data]);
}

const C2PA_UUID = [0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c, 0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81];
const UUID_KHAC = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00];

describe('Q-12 — do dau hieu tep do AI tao ra', () => {
  it('tep THAT binh thuong: khong keu nham, va dam noi la KHONG CO', () => {
    for (const name of ['sample.jpg', 'sample.png', 'sample-lossy.webp', 'video-with-audio.mp4', 'sample.mov']) {
      const scan = detectC2pa(real(name));
      expect(scan.presence, `keu nham tren ${name}`).toBe('absent');
      expect(scan.foundIn).toBeNull();
    }
  });

  it('tep co dau hieu: tim ra o dung cho, trong ca bon container duyet duoc', () => {
    expect(detectC2pa(jpegWithMark(real('sample.jpg')))).toMatchObject({ presence: 'present', foundIn: 'jpeg:APP11' });
    expect(detectC2pa(pngWithMark(real('sample.png')))).toMatchObject({ presence: 'present', foundIn: 'png:caBX' });
    expect(detectC2pa(webpWithMark(real('sample-lossy.webp')))).toMatchObject({ presence: 'present', foundIn: 'webp:C2PA' });
    expect(detectC2pa(mp4WithMark(real('video-with-audio.mp4'), C2PA_UUID))).toMatchObject({ presence: 'present' });
  });

  it('BMFF: nhan ra CA KHI hang so UUID sai, nho duong doc thu hai qua nhan `c2pa`', () => {
    /*
     * `C2PA_BMFF_UUID` lay tu hieu biet ve chuan chu khong tu tep that. Neu no sai, duong doc thu
     * nhat truot. Phep kiem nay chung minh duong thu hai van bat duoc.
     */
    const scan = detectC2pa(mp4WithMark(real('video-with-audio.mp4'), UUID_KHAC));
    expect(scan.presence).toBe('present');
    expect(scan.foundIn).toBe('bmff:uuid+label');
  });

  it('KHONG bao gio noi "khong co" khi chua duyet het cho — day la luat cua D-044', () => {
    // WebM/Matroska: cau truc EBML, chua duyet duoc het cho.
    expect(detectC2pa(real('sample.webm'))).toMatchObject({ presence: 'unknown', container: 'matroska' });
    // Container khong nhan dang duoc.
    expect(detectC2pa(real('empty.bin'))).toMatchObject({ presence: 'unknown', container: null });
    expect(detectC2pa(Uint8Array.from([1, 2, 3, 4, 5]))).toMatchObject({ presence: 'unknown', container: null });
    // Tep hong giua chung: nhan ra container nhung khong duyet het duoc.
    expect(detectC2pa(real('corrupt.png')).presence).toBe('unknown');
  });

  it('tep cut ngang khong lam bo do nem loi hay treo', () => {
    const png = real('sample.png');
    for (const cut of [9, 20, png.length - 5]) {
      expect(() => detectC2pa(png.slice(0, cut))).not.toThrow();
    }
    const mp4 = real('video-with-audio.mp4');
    expect(() => detectC2pa(mp4.slice(0, 30))).not.toThrow();
  });
});
