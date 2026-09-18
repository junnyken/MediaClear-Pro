/**
 * `P5-MCP-53` — tai tep logo cho mot bo nhan dien.
 *
 * BON DIEU BAT BUOC:
 *
 *  1. **Do tren BYTE THAT.** Kieu tep va kich thuoc doc tu chinh byte, khong tu loi khai cua client
 *     — dung quy tac `P1-MCP-02` da dung cho tep nguoi dung.
 *  2. **Di qua tang truu tuong kho**, khong cham he tep truc tiep. Khi `Q-23` co kho dung chung,
 *     duong nay khong phai sua mot dong.
 *  3. **Khong ghi de.** Moi lan tai la mot ban ghi MOI voi khoa kho MOI. Ghi de se lam moi ban xuat
 *     da phat hanh tro toi mot hinh anh khac voi cai da that su dan.
 *  4. **Gan logo = tao PHIEN BAN moi** cua bo nhan dien. Phien ban cu khong bao gio bi dung toi.
 */
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {
  ERROR_CODES,
  MAX_IMAGE_DIMENSION_PX,
  SUPPORTED_IMAGE_FORMATS,
  apiError,
  storageKeyFor,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { ensurePermission, type Actor } from './access.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { fail, ok, type ServiceResult } from './result.js';

/** Tran rieng cho logo: 2 MB. Logo la mot DAU, khong phai mot tep phuong tien. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
/** Logo nho hon 16px khong doc duoc khi dan; lon hon tran anh la khong hop ly. */
export const MIN_LOGO_DIMENSION_PX = 16;

export interface BrandLogoView {
  id: string;
  brandKitId: string;
  mimeType: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
  checksumSha256: string;
  createdAt: string;
  /**
   * `Q-23`. `false` nghia la tep dang nam tren kho CUC BO cua container nay — **khong phai** kho
   * dung chung, va **khong duoc goi la** da luu tru o muc production. Mot lan deploy lai se mat.
   */
  sharedStorage: boolean;
}

export async function uploadBrandLogo(
  ctx: AppContext, actor: Actor, brandKitId: string, bytes: Uint8Array, declaredMime: unknown,
): Promise<ServiceResult<BrandLogoView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'workspace',
    resourceId: actor.workspace.id, permission: 'project.manage',
  });
  if (!allowed.ok) return fail(allowed.error);

  const workspaceId = actor.workspace.id;
  // Pham vi workspace ep o day: `findById` loc theo workspace, khong tin id trong yeu cau.
  const kit = await ctx.persistence.brandKits.findById(workspaceId, brandKitId);
  if (!kit) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'brand_kit' }));

  if (bytes.byteLength === 0) return fail(apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE));
  if (bytes.byteLength > MAX_LOGO_BYTES) {
    return fail(apiError(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, { limitBytes: MAX_LOGO_BYTES }));
  }

  /*
   * Do tren BYTE THAT. `declaredMime` cua client duoc doi chieu chu khong duoc tin: mot tep .exe
   * doi ten thanh .png van khai `image/png`.
   */
  let width = 0;
  let height = 0;
  let format = '';
  try {
    const meta = await sharp(Buffer.from(bytes)).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    format = meta.format ?? '';
  } catch {
    return fail(apiError(ERROR_CODES.MCP_VAL_CORRUPT_MEDIA));
  }

  const mimeFromBytes = format === 'jpeg' ? 'image/jpeg'
    : format === 'png' ? 'image/png'
      : format === 'webp' ? 'image/webp' : '';
  if (!SUPPORTED_IMAGE_FORMATS.includes(mimeFromBytes as typeof SUPPORTED_IMAGE_FORMATS[number])) {
    return fail(apiError(ERROR_CODES.MCP_VAL_UNSUPPORTED_FORMAT, { detected: format || 'unknown' }));
  }
  if (typeof declaredMime === 'string' && declaredMime.length > 0 && declaredMime !== mimeFromBytes) {
    return fail(apiError(ERROR_CODES.MCP_VAL_MIME_MISMATCH, { declared: declaredMime, actual: mimeFromBytes }));
  }
  if (width < MIN_LOGO_DIMENSION_PX || height < MIN_LOGO_DIMENSION_PX) {
    return fail(apiError(ERROR_CODES.MCP_VAL_DIMENSION_TOO_SMALL, { limitPx: MIN_LOGO_DIMENSION_PX }));
  }
  if (width > MAX_IMAGE_DIMENSION_PX || height > MAX_IMAGE_DIMENSION_PX) {
    return fail(apiError(ERROR_CODES.MCP_VAL_DIMENSION_EXCEEDED, { limitPx: MAX_IMAGE_DIMENSION_PX }));
  }

  const id = newId('blg');
  // Khoa MOI moi lan tai: khong duong nao ghi de mot logo da phat hanh.
  const key = storageKeyFor(workspaceId, 'source', id, format === 'jpeg' ? '.jpg' : `.${format}`);
  try {
    await ctx.storage.putObject({ bucket: ctx.bucket, key }, bytes, mimeFromBytes);
  } catch {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED));
  }

  const now = ctx.now().toISOString();
  const record = await ctx.persistence.brandLogos.create({
    id, workspaceId, brandKitId, storageKey: key, mimeType: mimeFromBytes,
    byteSize: bytes.byteLength, widthPx: width, heightPx: height,
    checksumSha256: createHash('sha256').update(Buffer.from(bytes)).digest('hex'),
    createdAt: now, createdByUserId: actor.user.id,
  });

  /*
   * Gan logo = mot PHIEN BAN MOI, khong sua phien ban dang co. Ban xuat cu phai tiep tuc tro toi
   * dung noi dung da that su duoc dan — ke ca khi do la "khong co logo".
   */
  const current = await ctx.persistence.brandKits.findVersion(workspaceId, brandKitId, kit.currentVersion);
  if (!current) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'brand_kit_version' }));
  await ctx.persistence.brandKits.addVersion(workspaceId, brandKitId, {
    ...current, version: kit.currentVersion + 1, logoAssetId: id,
    createdAt: now, createdByUserId: actor.user.id,
  });

  await recordAudit(ctx.persistence, {
    workspaceId, actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.BRAND_LOGO_UPLOADED, subjectType: 'brand_kit', subjectId: brandKitId,
    // KHONG ghi khoa kho vao nhat ky: no la duong dan noi bo, khong phai thong tin nguoi dung can.
    detail: { logoAssetId: id, byteSize: bytes.byteLength, widthPx: width, heightPx: height },
  });

  return ok({
    id: record.id, brandKitId, mimeType: record.mimeType, byteSize: record.byteSize,
    widthPx: record.widthPx, heightPx: record.heightPx, checksumSha256: record.checksumSha256,
    createdAt: record.createdAt,
    /*
     * `Q-23` chua dong: kho hien tai la `local-fs-phase1` tren dia container. Bao `true` o day se
     * lam nguoi doc tuong tep da nam o kho dung chung — va no se bien mat sau mot lan deploy lai.
     */
    sharedStorage: ctx.storage.id !== 'local-fs-phase1',
  });
}
