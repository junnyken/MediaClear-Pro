/**
 * `P5-MCP-53` + `P5-MCP-54` — giai quyet lua chon lop phu cua nguoi dung thanh thao tac THAT.
 *
 * Muc nay tra loi dung mot cau: "voi job nay, co dan lop phu khong, va dan gi".
 *
 * NGUYEN TAC: moi duong khong chac chan deu tra `null` — KHONG dan gi. He thong khong bao gio duoc
 * dan mot thu ma nguoi dung khong chon, va cung khong bao gio duoc dan mot PHIEN BAN khac voi
 * phien ban nguoi dung da chon.
 */
import type { BrandingRequest, DisclosureResult, OverlayPosition } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';

export interface ResolvedBranding {
  brandKitId: string;
  brandKitVersion: number;
  logoBytes: Uint8Array | null;
  logoAssetId: string | null;
  position: OverlayPosition;
  opacity: number;
  /** Cau chu cong bo DA DICH, hoac `null` khi nguoi dung khong bat. */
  disclosureText: string | null;
}

/**
 * Doc bo nhan dien nguoi dung chon va lay byte logo.
 *
 * Tra `null` khi: khong chon gi · bo nhan dien khong thuoc workspace nay · phien ban khong ton tai.
 * Ba truong hop do deu co nghia la KHONG DAN — khong co duong nao "dan tam mot cai gan giong".
 *
 * `logoBytes` co the la `null` ngay ca khi `applyLogo` bat: phien ban do chua gan tep logo nao.
 * Khi do lop phu cong bo van dan duoc, va bien nhan se ghi `brandLogoAssetId: null` — dung su that.
 */
export async function resolveBranding(
  ctx: AppContext,
  workspaceId: string,
  request: BrandingRequest | null,
  disclosureTextFor: (result: DisclosureResult) => string | null,
  disclosure: DisclosureResult,
): Promise<ResolvedBranding | null> {
  if (!request) return null;

  // Pham vi workspace duoc ep o day: `findById` loc theo workspace, khong tin id trong yeu cau.
  const kit = await ctx.persistence.brandKits.findById(workspaceId, request.brandKitId);
  if (!kit) return null;

  /*
   * Lay dung PHIEN BAN nguoi dung chon, KHONG lay `currentVersion`.
   *
   * Neu lay phien ban dang hieu luc, mot lan sua bo nhan dien giua luc nguoi dung bam se lam ban
   * xuat mang mot noi dung khac voi cai ho da xem truoc — va bien nhan se ghi mot so phien ban
   * dung trong khi hinh anh la cua phien ban khac.
   */
  const version = await ctx.persistence.brandKits.findVersion(
    workspaceId, request.brandKitId, request.brandKitVersion);
  if (!version) return null;

  let logoBytes: Uint8Array | null = null;
  let logoAssetId: string | null = null;
  if (request.applyLogo && version.logoAssetId) {
    const logo = await ctx.persistence.brandLogos.findById(workspaceId, version.logoAssetId);
    if (logo) {
      try {
        logoBytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: logo.storageKey });
        logoAssetId = logo.id;
      } catch {
        // Kho khong doc duoc: KHONG dan logo, va noi that. Khong lam do ca luot xu ly.
        logoBytes = null;
        logoAssetId = null;
      }
    }
  }

  return {
    brandKitId: kit.id,
    brandKitVersion: version.version,
    logoBytes,
    logoAssetId,
    position: version.overlayPosition,
    opacity: version.overlayOpacity,
    disclosureText: request.applyDisclosure ? disclosureTextFor(disclosure) : null,
  };
}
