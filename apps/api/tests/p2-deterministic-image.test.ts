/**
 * P2-MCP-27: xu ly anh tat dinh.
 *
 * Chay tren BYTE THAT, khong mock sharp. Mock o day se lam moi khang dinh ve ket qua tro thanh
 * vo nghia - thu can kiem chinh la anh ra co dung khong.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { DeterministicImageProvider } from '../src/providers/deterministic-image.js';

const provider = new DeterministicImageProvider();

/**
 * Anh goc: nua TRAI la soc dung xen ke (co CHI TIET), nua PHAI xanh dac.
 *
 * Vi sao phai co chi tiet: lam mo mot vung MAU DONG NHAT cho ra dung mau do - khong co gi
 * de xoa. Anh qua don gian se khien phep kiem "blur co tac dung khong" luon that bai ma
 * khong phai do provider sai. Soc manh la thu blur that su pha duoc.
 */
async function sourceImage(width = 240, height = 160): Promise<Uint8Array> {
  const half = width / 2;
  const stripes = Buffer.alloc(half * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < half; x += 1) {
      const i = (y * half + x) * 3;
      const on = Math.floor(x / 4) % 2 === 0;
      stripes[i] = on ? 240 : 10;
      stripes[i + 1] = on ? 240 : 10;
      stripes[i + 2] = on ? 240 : 10;
    }
  }
  const left = await sharp(stripes, { raw: { width: half, height, channels: 3 } }).png().toBuffer();
  const right = await sharp({ create: { width: half, height, channels: 3, background: { r: 30, g: 30, b: 220 } } }).png().toBuffer();
  const out = await sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: half, top: 0 }])
    .png()
    .toBuffer();
  return new Uint8Array(out);
}

/** Do lech chuan - do "con bao nhieu chi tiet". Blur lam giam manh chi so nay. */
async function detail(bytes: Uint8Array, box: { left: number; top: number; width: number; height: number }): Promise<number> {
  const cropped = await sharp(Buffer.from(bytes)).extract(box).png().toBuffer();
  const stats = await sharp(cropped).stats();
  return stats.channels[0]?.stdev ?? 0;
}

const FULL = { x: 0, y: 0, width: 1, height: 1, startSeconds: null, endSeconds: null };
const LEFT_HALF = { x: 0, y: 0, width: 0.5, height: 1, startSeconds: null, endSeconds: null };

/**
 * Mau trung binh cua mot o - de khang dinh "vung nay DA doi" bang so, khong bang cam nhan.
 *
 * BAY: `sharp(...).extract(box).stats()` tra ve thong ke cua anh DAU VAO, bo qua `extract()`.
 * Phai ghi o ra buffer TRUOC roi moi do, neu khong moi phep do deu la do ca anh.
 */
async function meanColor(bytes: Uint8Array, box: { left: number; top: number; width: number; height: number }) {
  const cropped = await sharp(Buffer.from(bytes)).extract(box).png().toBuffer();
  const stats = await sharp(cropped).stats();
  return stats.channels.map((c) => Math.round(c.mean));
}

describe('P2-MCP-27 — provider tat dinh', () => {
  it('tu khai lam duoc gi, va KHONG khai bua thu khong lam duoc', () => {
    const caps = provider.capabilities();
    expect(caps.every((c) => c.mediaType === 'image')).toBe(true);
    expect(caps.map((c) => c.operation).sort()).toEqual(['blur', 'brand_overlay', 'crop']);
    // Thao tac can AI thi KHONG duoc co mat.
    expect(provider.supports('inpaint', 'image')).toBe(false);
    expect(provider.supports('visible_logo_cleanup', 'image')).toBe(false);
    // Video thi khong lam duoc gi ca.
    expect(provider.supports('blur', 'video')).toBe(false);
  });

  it('tu khai la provider production', () => {
    expect(provider.isProductionProvider).toBe(true);
  });

  it('CROP cat dung kich thuoc theo toa do chuan hoa', async () => {
    const src = await sourceImage(240, 160);
    const out = await provider.process(src, 'crop', [LEFT_HALF]);
    expect(out.widthPx).toBe(120);
    expect(out.heightPx).toBe(160);
    expect(out.mimeType).toBe('image/png');
  });

  it('BLUR chi doi VUNG DUOC CHON, phan con lai giu nguyen', async () => {
    const src = await sourceImage(240, 160);
    const out = await provider.process(src, 'blur', [LEFT_HALF]);
    expect(out.widthPx).toBe(240);

    // Nua phai (khong dong toi) phai giu nguyen mau xanh.
    const rightBefore = await meanColor(src, { left: 130, top: 10, width: 100, height: 140 });
    const rightAfter = await meanColor(out.bytes, { left: 130, top: 10, width: 100, height: 140 });
    expect(rightAfter).toEqual(rightBefore);

    // Vung bi lam mo phai MAT CHI TIET: do lech chuan giam manh.
    const box = { left: 10, top: 10, width: 100, height: 140 };
    const before = await detail(src, box);
    const after = await detail(out.bytes, box);
    expect(before, 'anh goc phai co chi tiet thi phep kiem moi co nghia').toBeGreaterThan(50);
    expect(after, 'blur phai xoa duoc chi tiet').toBeLessThan(before / 3);
  });

  it('BRAND_OVERLAY phu kin vung duoc chon', async () => {
    const src = await sourceImage(240, 160);
    const out = await provider.process(src, 'brand_overlay', [LEFT_HALF]);
    const patch = await meanColor(out.bytes, { left: 10, top: 10, width: 100, height: 140 });
    // Mang mau dac (32,34,38): lech toi da 2 don vi cho moi kenh.
    expect(Math.abs(patch[0]! - 32)).toBeLessThanOrEqual(2);
    expect(Math.abs(patch[1]! - 34)).toBeLessThanOrEqual(2);
    expect(Math.abs(patch[2]! - 38)).toBeLessThanOrEqual(2);
  });

  it('KHONG bao gio sua anh dau vao (bat bien I-1)', async () => {
    const src = await sourceImage();
    const before = Buffer.from(src);
    await provider.process(src, 'blur', [FULL]);
    expect(Buffer.from(src).equals(before)).toBe(true);
  });

  it('TAT DINH: cung dau vao cho ra cung checksum', async () => {
    const src = await sourceImage();
    const a = await provider.process(src, 'blur', [LEFT_HALF]);
    const b = await provider.process(src, 'blur', [LEFT_HALF]);
    expect(a.checksumSha256).toBe(b.checksumSha256);
  });

  it('GIU NGUYEN metadata goc (guardrail 6) - sharp mac dinh XOA', async () => {
    const withMeta = await sharp({ create: { width: 100, height: 80, channels: 3, background: { r: 10, g: 20, b: 30 } } })
      .withExif({ IFD0: { Copyright: 'MediaClear Pro test', Artist: 'nguoi-dung-goc' } })
      .png()
      .toBuffer();
    const before = await sharp(withMeta).metadata();
    expect(before.exif).toBeDefined();

    const out = await provider.process(new Uint8Array(withMeta), 'blur', [FULL]);
    const after = await sharp(Buffer.from(out.bytes)).metadata();
    expect(after.exif, 'metadata bi xoa: vi pham cam ket giu nguyen thong tin goc').toBeDefined();
  });

  it('checksum khop voi byte that su tra ra', async () => {
    const { createHash } = await import('node:crypto');
    const src = await sourceImage();
    const out = await provider.process(src, 'blur', [LEFT_HALF]);
    expect(createHash('sha256').update(Buffer.from(out.bytes)).digest('hex')).toBe(out.checksumSha256);
    expect(out.byteSize).toBe(out.bytes.byteLength);
  });

  it('uoc tinh: lam duoc thi chi phi 0 CO BANG CHUNG; khong lam duoc thi `unknown`', () => {
    const ok = provider.estimate({ operation: 'blur', mediaType: 'image', durationSeconds: null, widthPx: 240, heightPx: 160 });
    expect(ok.costUsd).toBe(0);
    expect(ok.costEvidence).toBe('verified');

    const no = provider.estimate({ operation: 'inpaint', mediaType: 'image', durationSeconds: null, widthPx: 240, heightPx: 160 });
    expect(no.costUsd).toBeNull();
    expect(no.costEvidence).toBe('unknown');
  });
});
