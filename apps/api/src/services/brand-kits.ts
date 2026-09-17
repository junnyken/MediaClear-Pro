/**
 * `P5-MCP-53` — bo nhan dien thuong hieu, pham vi WORKSPACE.
 *
 * BA DIEU DINH HINH MUC NAY, va moi dieu deu la mot cach he thong co the noi doi neu lam sai:
 *
 *  1. **Sua = tao PHIEN BAN moi.** Bien nhan cua mot ban xuat tro toi `(brandKitId, version)`.
 *     Sua truc tiep noi dung se lam bien nhan cu tro toi mot thu KHAC voi cai da that su duoc ap
 *     dung — ho so noi doi ve qua khu. Bang phien ban khong co duong UPDATE nao.
 *  2. **Khong co duong XOA.** Bo khong dung nua thi `archived`. Xoa dong la xoa luon bang chung
 *     rang mot ban xuat da tung mang bo nhan dien nao.
 *  3. **Khong tu ap dung.** Khong ham nao o day dien `brandKitId` vao bien nhan. Chi khi nguoi
 *     dung CHON thi duong xuat moi ghi — xem `P5-MCP-54` va `applyBrandKitToReceipt`.
 *
 * Quyen: doc dung `asset.read`, sua dung `project.manage`. KHONG them quyen moi — ma tran quyen
 * la quyet dinh cua owner (`Q-04`), khong phai thu mot muc tu no rong ra.
 */
import {
  ERROR_CODES,
  apiError,
  validateBrandKitDraft,
  type BrandKitError,
  type BrandKitState,
  type BrandKitVersion,
  type OverlayPosition,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { ensurePermission, type Actor } from './access.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { fail, ok, type ServiceResult } from './result.js';
import type { BrandKitRecord, BrandKitVersionRecord } from '../persistence/types.js';

export interface BrandKitView {
  id: string;
  state: BrandKitState;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  versions: BrandKitVersion[];
}

export interface BrandKitDraft {
  name: string;
  colors: string[];
  logoAssetId: string | null;
  overlayPosition: OverlayPosition;
  overlayOpacity: number;
  overlayIncludeDisclosure: boolean;
}

function toVersion(r: BrandKitVersionRecord): BrandKitVersion {
  return {
    version: r.version,
    name: r.name,
    colors: r.colors,
    logoAssetId: r.logoAssetId,
    overlayDefaults: {
      position: r.overlayPosition,
      opacity: r.overlayOpacity,
      includeDisclosure: r.overlayIncludeDisclosure,
    },
    createdAt: r.createdAt,
    createdByUserId: r.createdByUserId,
  };
}

async function view(ctx: AppContext, workspaceId: string, kit: BrandKitRecord): Promise<BrandKitView> {
  const versions = await ctx.persistence.brandKits.listVersions(workspaceId, kit.id);
  return {
    id: kit.id,
    state: kit.state,
    currentVersion: kit.currentVersion,
    createdAt: kit.createdAt,
    updatedAt: kit.updatedAt,
    versions: versions.map(toVersion),
  };
}

/** Doc bo thao tu yeu cau, KHONG tin hinh dang client gui — moi truong deu duoc kiem o duoi. */
function readDraft(body: unknown): BrandKitDraft | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const overlay = (typeof b.overlayDefaults === 'object' && b.overlayDefaults !== null)
    ? b.overlayDefaults as Record<string, unknown>
    : {};
  if (typeof b.name !== 'string') return null;
  const colors = Array.isArray(b.colors) ? b.colors : [];
  if (!colors.every((c) => typeof c === 'string')) return null;
  return {
    name: b.name,
    colors: colors as string[],
    logoAssetId: typeof b.logoAssetId === 'string' ? b.logoAssetId : null,
    overlayPosition: overlay.position as OverlayPosition,
    overlayOpacity: typeof overlay.opacity === 'number' ? overlay.opacity : Number.NaN,
    overlayIncludeDisclosure: overlay.includeDisclosure === true,
  };
}

function invalid(errors: BrandKitError[]) {
  /* Tra DANH SACH loi: nguoi dung khong sua duoc cai ho khong biet la gi. */
  return apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'brandKit', reasons: errors.join(',') });
}

export async function createBrandKit(
  ctx: AppContext, actor: Actor, body: unknown,
): Promise<ServiceResult<BrandKitView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'workspace',
    resourceId: actor.workspace.id, permission: 'project.manage',
  });
  if (!allowed.ok) return fail(allowed.error);

  const draft = readDraft(body);
  if (!draft) return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'brandKit' }));
  const errors = validateBrandKitDraft({
    name: draft.name, colors: draft.colors,
    overlayDefaults: {
      position: draft.overlayPosition, opacity: draft.overlayOpacity,
      includeDisclosure: draft.overlayIncludeDisclosure,
    },
  });
  if (errors.length > 0) return fail(invalid(errors));

  const now = ctx.now().toISOString();
  const id = newId('bkt');
  const kit: BrandKitRecord = {
    id, workspaceId: actor.workspace.id, state: 'active', currentVersion: 1,
    createdAt: now, updatedAt: now, createdByUserId: actor.user.id,
  };
  await ctx.persistence.brandKits.create(kit, {
    brandKitId: id, workspaceId: actor.workspace.id, version: 1,
    name: draft.name.trim(), colors: draft.colors, logoAssetId: draft.logoAssetId,
    overlayPosition: draft.overlayPosition, overlayOpacity: draft.overlayOpacity,
    overlayIncludeDisclosure: draft.overlayIncludeDisclosure,
    createdAt: now, createdByUserId: actor.user.id,
  });

  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id, actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.BRAND_KIT_CREATED, subjectType: 'brand_kit', subjectId: id,
    detail: { version: 1 },
  });
  return ok(await view(ctx, actor.workspace.id, kit));
}

/**
 * Sua = ghi them mot PHIEN BAN. Dong cu khong bao gio bi dung toi.
 *
 * Neu ham nay `UPDATE` dong phien ban dang co, moi bien nhan da phat hanh truoc do se lap tuc tro
 * toi mot noi dung khac — va khong cach nao phat hien duoc dieu do sau khi da xay ra.
 */
export async function addBrandKitVersion(
  ctx: AppContext, actor: Actor, brandKitId: string, body: unknown,
): Promise<ServiceResult<BrandKitView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'workspace',
    resourceId: actor.workspace.id, permission: 'project.manage',
  });
  if (!allowed.ok) return fail(allowed.error);

  const existing = await ctx.persistence.brandKits.findById(actor.workspace.id, brandKitId);
  // Cung mot ma loi cho "khong ton tai" va "cua workspace khac": khong xac nhan su ton tai cua
  // tai nguyen nguoi khac (`I-10`).
  if (!existing) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'brand_kit' }));

  const draft = readDraft(body);
  if (!draft) return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'brandKit' }));
  const errors = validateBrandKitDraft({
    name: draft.name, colors: draft.colors,
    overlayDefaults: {
      position: draft.overlayPosition, opacity: draft.overlayOpacity,
      includeDisclosure: draft.overlayIncludeDisclosure,
    },
  });
  if (errors.length > 0) return fail(invalid(errors));

  const now = ctx.now().toISOString();
  const next = existing.currentVersion + 1;
  const updated = await ctx.persistence.brandKits.addVersion(actor.workspace.id, brandKitId, {
    brandKitId, workspaceId: actor.workspace.id, version: next,
    name: draft.name.trim(), colors: draft.colors, logoAssetId: draft.logoAssetId,
    overlayPosition: draft.overlayPosition, overlayOpacity: draft.overlayOpacity,
    overlayIncludeDisclosure: draft.overlayIncludeDisclosure,
    createdAt: now, createdByUserId: actor.user.id,
  });

  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id, actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.BRAND_KIT_VERSION_ADDED, subjectType: 'brand_kit', subjectId: brandKitId,
    detail: { version: next },
  });
  return ok(await view(ctx, actor.workspace.id, updated));
}

/** Luu tru / dung lai. KHONG phai xoa — ban ghi va moi phien ban deu o lai. */
export async function setBrandKitState(
  ctx: AppContext, actor: Actor, brandKitId: string, state: unknown,
): Promise<ServiceResult<BrandKitView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'workspace',
    resourceId: actor.workspace.id, permission: 'project.manage',
  });
  if (!allowed.ok) return fail(allowed.error);
  if (state !== 'active' && state !== 'archived') {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'state' }));
  }
  const existing = await ctx.persistence.brandKits.findById(actor.workspace.id, brandKitId);
  if (!existing) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'brand_kit' }));

  const updated = await ctx.persistence.brandKits.setState(
    actor.workspace.id, brandKitId, state, ctx.now().toISOString());
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id, actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.BRAND_KIT_STATE_CHANGED, subjectType: 'brand_kit', subjectId: brandKitId,
    detail: { state },
  });
  return ok(await view(ctx, actor.workspace.id, updated));
}

export async function listBrandKits(ctx: AppContext, actor: Actor): Promise<ServiceResult<{ items: BrandKitView[] }>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'workspace',
    resourceId: actor.workspace.id, permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const kits = await ctx.persistence.brandKits.listByWorkspace(actor.workspace.id);
  const items: BrandKitView[] = [];
  for (const kit of kits) items.push(await view(ctx, actor.workspace.id, kit));
  return ok({ items });
}

export async function getBrandKit(
  ctx: AppContext, actor: Actor, brandKitId: string,
): Promise<ServiceResult<BrandKitView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'workspace',
    resourceId: actor.workspace.id, permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const kit = await ctx.persistence.brandKits.findById(actor.workspace.id, brandKitId);
  if (!kit) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'brand_kit' }));
  return ok(await view(ctx, actor.workspace.id, kit));
}
