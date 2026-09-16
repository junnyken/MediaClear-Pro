/**
 * Xem truoc ket qua (P2-MCP-31).
 *
 * Ba rang buoc cua owner, deu la bat bien chu khong phai tuy chon:
 *  - I-5: preview la ban render PHAI SINH, KHONG bao gio dong vao SourceFile.
 *  - I-12: preview KHONG BAO GIO bi tinh vao muc dung.
 *  - Q-03: preview luon chay tren ban PROXY do phan giai thap, khong tren anh goc.
 *
 * Vi sao KHONG luu ban xem truoc vao kho: mot object trong kho ma khong co luat luu giu nao ap
 * len no thi se nam do mai mai. Preview la thu dung mot lan - tra thang byte ve cho nguoi goi
 * la cach duy nhat khong de lai rac.
 *
 * `regions` la toa do CHUAN HOA 0..1, nen ap len ban proxy nho hon cho ra dung cung mot vung.
 * Day chinh la ly do he thong chuan hoa toa do ngay tu Phase 0.
 */
import sharp from 'sharp';
import {
  ERROR_CODES,
  PREVIEW_PROXY_MAX_HEIGHT_PX,
  apiError,
  planPreview,
  type JobPreviewResponse,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { DeterministicImageProvider } from '../providers/deterministic-image.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

/** Toan bo anh - dung khi nguoi dung khong chon vung nao. */
const WHOLE_IMAGE = { x: 0, y: 0, width: 1, height: 1, startSeconds: null, endSeconds: null };

export async function previewJob(
  ctx: AppContext,
  actor: Actor,
  jobId: string,
): Promise<ServiceResult<JobPreviewResponse>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'job',
    resourceId: jobId,
    permission: 'job.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const job = await ctx.persistence.jobs.findById(actor.workspace.id, jobId);
  if (!job) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'job' }));

  const provider = ctx.providers.get('deterministic-image');
  if (!(provider instanceof DeterministicImageProvider)) {
    return fail(apiError(ERROR_CODES.MCP_PROVIDER_NOT_PRODUCTION));
  }
  const operation = job.request.operations.find((op) => provider.supports(op, job.mediaType));
  if (!operation) {
    // Khong lam duoc thi noi ngay, khong tra mot anh khong phan anh dung thao tac da xin.
    return fail(apiError(ERROR_CODES.MCP_PROVIDER_CAPABILITY_UNSUPPORTED, {
      operations: job.request.operations.join(','),
      mediaType: job.mediaType,
    }));
  }

  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, job.sourceFileId);
  if (!record || record.uploadState !== 'stored') {
    return fail(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
  }

  const plan = planPreview({ jobId, sourceFileId: record.id, operations: [operation] });

  const source = await ctx.storage.getObject({ bucket: ctx.bucket, key: record.storageKey });

  /*
   * Thu nho TRUOC khi xu ly. Thu tu nay quan trong: xu ly anh goc roi moi thu nho se ton dung
   * bang cong suat cua mot luot that, tuc la preview "mien phi" van doi CPU y het - dung y
   * dinh cua Q-03.
   */
  const meta = await sharp(Buffer.from(source)).metadata();
  const proxy =
    (meta.height ?? 0) > PREVIEW_PROXY_MAX_HEIGHT_PX
      ? await sharp(Buffer.from(source)).resize({ height: PREVIEW_PROXY_MAX_HEIGHT_PX }).withMetadata().toBuffer()
      : Buffer.from(source);

  const regions = job.request.regions.length > 0 ? job.request.regions : [WHOLE_IMAGE];
  const rendered = await provider.process(proxy, operation, regions);

  /*
   * KHONG ghi vao kho, KHONG ghi so muc dung, KHONG doi trang thai job. Ba dieu "khong" nay la
   * noi dung that su cua muc nay - co test rieng cho tung dieu.
   */
  return ok({
    mode: plan.mode,
    billable: plan.billable,
    providerJobBudget: plan.providerJobBudget,
    operation,
    widthPx: rendered.widthPx,
    heightPx: rendered.heightPx,
    byteSize: rendered.byteSize,
    imageDataUri: `data:${rendered.mimeType};base64,${Buffer.from(rendered.bytes).toString('base64')}`,
  });
}
