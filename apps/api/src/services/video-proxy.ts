/**
 * Ban proxy de xem truoc (P3-MCP-30).
 *
 * Muc tieu: cho nguoi dung NHIN THAY video truoc khi chon vung va truoc khi render — ma khong
 * dong vao tep goc. Proxy la mot object RIENG, o lop luu tru `preview`, va tep goc van bat bien
 * (I-1). Tao lai proxy la chuyen binh thuong (lan truoc that bai, hoac muon ban moi) nen dung
 * `upsert` chu khong phai `create`.
 *
 * Proxy KHONG phai ket qua xu ly: no khong di kem bien nhan, khong tinh muc dung, va khong bao
 * gio duoc coi la tep de tai ve thay cho ban ket qua.
 */
import {
  ERROR_CODES,
  apiError,
  storageKeyFor,
  type VideoProxy,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';
import { ffmpegAvailable, makeProxy } from '../media/ffmpeg.js';
import { newId } from '../ids.js';
import type { VideoProxyRecord } from '../persistence/types.js';

function viewOf(record: VideoProxyRecord): VideoProxy {
  return {
    proxyAssetId: record.id,
    originalAssetId: record.assetId,
    widthPx: record.widthPx ?? 0,
    heightPx: record.heightPx ?? 0,
    durationSeconds: record.durationSeconds,
    byteSize: record.byteSize,
    hasAudio: record.hasAudio,
  };
}

async function loadAsset(ctx: AppContext, actor: Actor, assetId: string) {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return { ok: false as const, error: allowed.error };
  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return { ok: false as const, error: apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }) };
  return { ok: true as const, asset };
}

/**
 * Sinh ban proxy. Goi lai khi lan truoc that bai la AN TOAN: no ghi de ban cu, khong sinh ban thu
 * hai, va khong bao gio dung toi khoa `source`.
 */
export async function createVideoProxy(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<VideoProxy>> {
  const found = await loadAsset(ctx, actor, assetId);
  if (!found.ok) return fail(found.error);
  const { asset } = found;

  if (asset.mediaType !== 'video') {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'mediaType' }));
  }
  /* `ffmpeg` la nhi phan NGOAI: thieu no la phu thuoc thieu, phai noi ro thay vi bao loi chung. */
  if (!(await ffmpegAvailable())) {
    return fail(apiError(ERROR_CODES.MCP_PROVIDER_UNAVAILABLE, { reason: 'ffmpeg_missing' }));
  }

  const source = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!source || source.uploadState !== 'stored') {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
  }

  const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: source.storageKey });

  let rendered;
  try {
    rendered = await makeProxy(bytes);
  } catch {
    // Proxy that bai KHONG lam hong asset: nguoi dung thu lai duoc, tep goc van nguyen.
    return fail(apiError(ERROR_CODES.MCP_PROVIDER_SUBMIT_FAILED, { stage: 'proxy' }));
  }

  const proxyId = newId('prx');
  // Lop `preview`: KHONG phai `source`, nen khong bao gio dung toi tep goc.
  const key = storageKeyFor(actor.workspace.id, 'preview', proxyId, '.mp4');
  await ctx.storage.putObject({ bucket: ctx.bucket, key }, rendered.bytes, 'video/mp4');

  const record = await ctx.persistence.videoProxies.upsert({
    id: proxyId,
    workspaceId: actor.workspace.id,
    assetId,
    sourceFileId: source.id,
    storageKey: key,
    mimeType: 'video/mp4',
    byteSize: rendered.byteSize,
    widthPx: rendered.probe.widthPx,
    heightPx: rendered.probe.heightPx,
    durationSeconds: rendered.probe.durationSeconds,
    // DA DO tren byte cua chinh ban proxy — khong sao chep loi khai tu tep goc.
    hasAudio: rendered.probe.audio.present,
    createdAt: ctx.now().toISOString(),
  });
  return ok(viewOf(record));
}

export async function getVideoProxy(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<VideoProxy>> {
  const found = await loadAsset(ctx, actor, assetId);
  if (!found.ok) return fail(found.error);
  const record = await ctx.persistence.videoProxies.findByAsset(actor.workspace.id, assetId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'proxy' }));
  return ok(viewOf(record));
}

/** URL xem truoc, han ngan — giong duong tai ban ket qua cua P2-MCP-29. */
export async function createVideoProxyDownloadUrl(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<{ url: string; expiresAt: string; byteSize: number }>> {
  const found = await loadAsset(ctx, actor, assetId);
  if (!found.ok) return fail(found.error);
  const record = await ctx.persistence.videoProxies.findByAsset(actor.workspace.id, assetId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'proxy' }));

  const head = await ctx.storage.head({ bucket: ctx.bucket, key: record.storageKey });
  if (!head.exists) return fail(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));

  const signed = await ctx.storage.createDownloadUrl(
    { bucket: ctx.bucket, key: record.storageKey },
    ctx.config.downloadUrlTtlSeconds,
  );
  return ok({ url: signed.url, expiresAt: signed.expiresAt, byteSize: record.byteSize });
}
