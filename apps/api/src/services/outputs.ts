/**
 * Lay ban ket qua ve (P2-MCP-29).
 *
 * Vi sao can mot muc rieng: P2-MCP-27 lam job toi `completed` va ghi ban ket qua vao kho,
 * P2-MCP-28 lam no tu chay - nhung KHONG duong nao dan toi tep do. `/v1/assets/:assetId/
 * download-url` luon tra tep NGUON (no tra theo `asset.sourceFileId`), nen ban da xu ly xong
 * van vo hinh voi nguoi dung. Lay duoc tep da lam sach chinh la san pham.
 */
import { ERROR_CODES, apiError } from '@mediaclear/contracts';
import type { JobOutputDownloadResponse, JobOutputResponse } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { ensurePermission, type Actor } from './access.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { fail, ok, type ServiceResult } from './result.js';
import type { OutputAssetRecord } from '../persistence/types.js';

/**
 * Tim ban ket qua sau khi da kiem quyen. Tra cung mot ma loi cho "job khong ton tai" va
 * "job cua workspace khac": khong xac nhan su ton tai cua tai nguyen nguoi khac.
 */
async function resolveOutput(
  ctx: AppContext,
  actor: Actor,
  jobId: string,
): Promise<ServiceResult<OutputAssetRecord>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'job',
    resourceId: jobId,
    permission: 'job.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const job = await ctx.persistence.jobs.findById(actor.workspace.id, jobId);
  if (!job) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job' }));

  const output = await ctx.persistence.outputs.findByJob(actor.workspace.id, jobId);
  if (!output) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'output' }));
  return ok(output);
}

export async function getJobOutput(
  ctx: AppContext,
  actor: Actor,
  jobId: string,
): Promise<ServiceResult<JobOutputResponse>> {
  const found = await resolveOutput(ctx, actor, jobId);
  if (!found.ok) return fail(found.error);
  const output = found.data;
  return ok({
    outputAssetId: output.id,
    mimeType: output.mimeType,
    byteSize: output.byteSize,
    checksumSha256: output.checksumSha256,
    validated: output.validated,
    createdAt: output.createdAt,
  });
}

export async function createJobOutputDownloadUrl(
  ctx: AppContext,
  actor: Actor,
  jobId: string,
): Promise<ServiceResult<JobOutputDownloadResponse>> {
  const found = await resolveOutput(ctx, actor, jobId);
  if (!found.ok) return fail(found.error);
  const output = found.data;

  /*
   * Bat bien I-2. `validated` chi true sau khi he thong DOC LAI byte da ghi va do lai. Chua
   * true thi tu choi, khong phat URL: dua ra mot tep chua kiem chung chinh la "noi da xong ve
   * thu chua do". Ve ly thuyet job khong the `completed` neu chua validated, nhung cong nay
   * khong duoc dua vao gia dinh do - no la cho CUOI CUNG truoc khi tep den tay nguoi dung.
   */
  if (!output.validated) {
    return fail(apiError(ERROR_CODES.MCP_STATE_OUTPUT_NOT_VERIFIED, { outputAssetId: output.id }));
  }

  /* Kho co the mat tep ma co so du lieu khong biet. Hoi kho truoc khi hua. */
  const head = await ctx.storage.head({ bucket: ctx.bucket, key: output.storageKey });
  if (!head.exists) return fail(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));

  const signed = await ctx.storage.createDownloadUrl(
    { bucket: ctx.bucket, key: output.storageKey },
    ctx.config.downloadUrlTtlSeconds,
  );
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.OUTPUT_DOWNLOAD_URL_ISSUED,
    subjectType: 'output',
    subjectId: output.id,
    detail: { jobId, byteSize: output.byteSize },
  });

  return ok({
    url: signed.url,
    expiresAt: signed.expiresAt,
    checksumSha256: output.checksumSha256,
    byteSize: output.byteSize,
  });
}
