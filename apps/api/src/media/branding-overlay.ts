/**
 * `P5-MCP-53` + `P5-MCP-54` — DAN lop phu nhan dien va lop phu cong bo AI vao ban xuat.
 *
 * KHONG NHAM voi thao tac `brand_overlay` da co: thao tac do la MAT NA XAM DAC to kin mot vung
 * (`Q-15`), tuc la XOA thong tin. Muc nay THEM thong tin len tren anh. Hai viec nguoc nhau, va
 * dung lai mot ten cho ca hai se lam bien nhan noi sai ve viec da lam gi voi tep cua nguoi dung.
 *
 * BON DIEU BAT BUOC:
 *
 *  1. **Khong bao gio tu dan.** Ham nay chi chay khi duoc goi voi `applyLogo`/`applyDisclosure`
 *     bat tuong minh. Khong co gia tri mac dinh nao bat chung.
 *  2. **Ban goc khong bi dung toi.** Dan len BAN DA RENDER, va ket qua la mot mang byte MOI.
 *  3. **Giu thong tin kem theo.** `.withMetadata()` bat buoc — guardrail 6/7, va `D-076`.
 *  4. **Cau chu cong bo do NGUOI GOI truyen vao.** Muc nay khong tu che chu: cau chu phai qua i18n
 *     (da tung co tieng Viet khong dau di thang ra man hinh tu mot muc nhu the nay).
 */
import sharp from 'sharp';
import type { OverlayOptions } from 'sharp';
import { createHash } from 'node:crypto';
import type { OverlayPosition } from '@mediaclear/contracts';

/** Ti le be ngang cua logo so voi be ngang anh. Nho co chu y: lop phu la dau, khong phai noi dung. */
export const LOGO_WIDTH_RATIO = 0.18;
/** Le, tinh theo be ngang anh. */
export const OVERLAY_MARGIN_RATIO = 0.03;
/** Chieu cao dai chu cong bo, theo be cao anh. */
export const DISCLOSURE_BAND_RATIO = 0.08;

export interface BrandingInput {
  /** Byte cua ban DA RENDER. Khong bao gio la tep goc. */
  rendered: Uint8Array;
  /** Byte logo. `null` = khong dan logo. */
  logo: Uint8Array | null;
  position: OverlayPosition;
  /** 0..1. */
  opacity: number;
  /** Cau chu cong bo DA DICH. `null` = khong dan dai cong bo. */
  disclosureText: string | null;
}

export interface BrandingResult {
  bytes: Uint8Array;
  byteSize: number;
  checksumSha256: string;
  widthPx: number;
  heightPx: number;
  /** DO DUOC, khong phai loi khai: co that su dan duoc logo khong. */
  logoApplied: boolean;
  disclosureApplied: boolean;
}

function place(
  position: OverlayPosition, imgW: number, imgH: number, itemW: number, itemH: number, margin: number,
): { left: number; top: number } {
  const left = position === 'top_left' || position === 'bottom_left'
    ? margin
    : Math.max(margin, imgW - itemW - margin);
  const top = position === 'top_left' || position === 'top_right'
    ? margin
    : Math.max(margin, imgH - itemH - margin);
  // Kep vao trong anh: mot lop phu tran ra ngoai se lam `composite` nem loi va job do oan.
  return {
    left: Math.max(0, Math.min(left, Math.max(0, imgW - itemW))),
    top: Math.max(0, Math.min(top, Math.max(0, imgH - itemH))),
  };
}


/**
 * Ve dai cong bo, va TU KIEM rang chu that su da duoc ve.
 *
 * Tra `null` khi khong ve duoc chu. Phep kiem la mot DOI CHUNG AM chay luc chay: ve dai voi cau
 * chu that, ve lai dai do voi chuoi rong, roi so hai ket qua. Giong nhau nghia la chu khong len
 * duoc pixel nao — va khi do he thong khong duoc phep noi rang no da cong bo.
 *
 * Vi sao khong chi kiem "co font khong": phep kiem do tra loi mot cau khac. Font co the co mat ma
 * van khong ve duoc chu Viet co dau; dieu duy nhat dang tin la doi chieu PIXEL.
 */
async function renderDisclosureBand(
  width: number, bandH: number, fontSize: number, margin: number, text: string,
): Promise<Buffer | null> {
  const band = (content: string): Buffer => Buffer.from(
    `<svg width="${width}" height="${bandH}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${width}" height="${bandH}" fill="#0B1020" fill-opacity="0.72"/>` +
    `<text x="${margin}" y="${Math.round(bandH * 0.64)}" font-family="sans-serif" ` +
    `font-size="${fontSize}" fill="#F5F7FB">${escapeXml(content)}</text></svg>`,
  );

  try {
    const [coChu, khongChu] = await Promise.all([
      sharp(band(text)).png().toBuffer(),
      sharp(band('')).png().toBuffer(),
    ]);
    // Byte giong het => chu khong len duoc pixel nao.
    if (coChu.equals(khongChu)) return null;
    return coChu;
  } catch {
    return null;
  }
}

/** Thoat ky tu cho SVG. Cau chu den tu i18n, nhung van khong duoc dua thang vao danh dau. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Dan lop phu len ANH.
 *
 * Tra ve `logoApplied`/`disclosureApplied` DO DUOC: neu logo khong doc duoc, ham nay KHONG nem loi
 * lam hong ca luot xu ly — no bao la chua dan duoc, va bien nhan se ghi dung su that do. Mot ban
 * xuat khong co logo van la mot ban xuat dung; mot bien nhan noi da dan trong khi chua dan thi khong.
 */
export async function applyImageBranding(input: BrandingInput): Promise<BrandingResult> {
  const base = sharp(Buffer.from(input.rendered));
  const meta = await base.metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error('khong doc duoc kich thuoc ban da render');
  }

  const margin = Math.round(width * OVERLAY_MARGIN_RATIO);
  const composites: OverlayOptions[] = [];
  let logoApplied = false;
  let disclosureApplied = false;

  if (input.logo) {
    try {
      const targetW = Math.max(1, Math.round(width * LOGO_WIDTH_RATIO));
      const resized = await sharp(Buffer.from(input.logo))
        .resize({ width: targetW, withoutEnlargement: false })
        .ensureAlpha(Math.max(0, Math.min(1, input.opacity)))
        .png()
        .toBuffer();
      const rm = await sharp(resized).metadata();
      const pos = place(input.position, width, height, rm.width ?? targetW, rm.height ?? targetW, margin);
      composites.push({ input: resized, left: pos.left, top: pos.top });
      logoApplied = true;
    } catch {
      // Khong dan duoc thi NOI LA CHUA DAN, khong lam do ca luot xu ly.
      logoApplied = false;
    }
  }

  if (input.disclosureText) {
    const bandH = Math.max(16, Math.round(height * DISCLOSURE_BAND_RATIO));
    const fontSize = Math.max(10, Math.round(bandH * 0.45));
    /*
     * Dai cong bo LUON nam duoi cung, khong theo `position` cua logo. Do la mot cau noi ve tep,
     * khong phai mot yeu to nhan dien — de nguoi dung doi cho no se lam no trong nhu trang tri.
     */
    const band = await renderDisclosureBand(width, bandH, fontSize, margin, input.disclosureText);
    if (band) {
      composites.push({ input: band, left: 0, top: Math.max(0, height - bandH) });
      disclosureApplied = true;
    } else {
      /*
       * KHONG ve duoc chu => KHONG dan dai nao.
       *
       * Do duoc that trong workspace nay: khi he thong khong co font nao (`fc-list` tra ve 0), thu
       * vien ve SVG van tra ve mot anh HOP LE — chi la khong co chu. Neu cu dan, ban xuat se mang
       * mot dai toi mau trong ruot: trong nhu mot dau co chu dinh nhung khong noi gi ca, va bien
       * nhan se khai rang da cong bo. Mot cong bo trong con te hon khong cong bo.
       */
      disclosureApplied = false;
    }
  }

  if (composites.length === 0) {
    return {
      bytes: input.rendered, byteSize: input.rendered.byteLength,
      checksumSha256: createHash('sha256').update(Buffer.from(input.rendered)).digest('hex'),
      widthPx: width, heightPx: height, logoApplied: false, disclosureApplied: false,
    };
  }

  // `.withMetadata()` BAT BUOC: guardrail 6/7 va `D-076`.
  const bytes = await base.composite(composites).withMetadata().png().toBuffer();
  const out = await sharp(bytes).metadata();
  return {
    bytes: new Uint8Array(bytes),
    byteSize: bytes.byteLength,
    checksumSha256: createHash('sha256').update(bytes).digest('hex'),
    widthPx: out.width ?? width,
    heightPx: out.height ?? height,
    logoApplied,
    disclosureApplied,
  };
}
