/**
 * `P5-MCP-50` — dong thoi gian nguon goc cua mot asset.
 *
 * **KHONG co bang su kien thu hai.** Muc nay DOC tu cac nguon da co: tep goc, ban proxy, job,
 * bien nhan, lich su sua khung hinh, anh chup metadata, va nhat ky. Tao mot bang "provenance
 * events" rieng se lap tuc sinh ra nguon su that thu hai, va hai nguon se lech nhau — dung dieu
 * `D-047` ton tai de chan.
 *
 * Doi lai: muc nay phai TU dung quan he cha-con. Quan he do duoc kiem bang `buildProvenanceTimeline`,
 * va muc nao tro toi mot cha khong ton tai se LO RA o `orphanIds` chu khong bi giau di.
 */
import {
  buildProvenanceTimeline,
  ERROR_CODES,
  apiError,
  type ProvenanceNode,
  type ProvenanceTimeline,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

/**
 * Dung dong thoi gian cho MOT asset.
 *
 * Cac khoa `labelKey` deu la KHOA DICH. Viet cau chu thang o day se dua tieng Viet khong dau ra
 * man hinh nguoi dung — da tung xay ra that o `provenance-probe.ts`.
 */

/**
 * Doi mot gia tri sang chuoi cho dong thoi gian.
 *
 * `null` GIU NGUYEN `null` — khong doi thanh chuoi rong hay dau gach. Giao dien phai phan biet duoc
 * "khong co gia tri" voi "gia tri la chuoi rong"; gop lai la lap lai loi `D-044`.
 */
function str(v: string | number | boolean | null | undefined): string | null {
  return v === null || v === undefined ? null : String(v);
}

export async function getAssetProvenance(
  ctx: AppContext, actor: Actor, assetId: string,
): Promise<ServiceResult<ProvenanceTimeline>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'asset', resourceId: assetId, permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const workspaceId = actor.workspace.id;
  const asset = await ctx.persistence.assets.findById(workspaceId, assetId);
  // Cung mot ma loi cho "khong ton tai" va "cua workspace khac" (`I-10`).
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));

  const nodes: ProvenanceNode[] = [];
  const limitationKeys = new Set<string>();

  const source = await ctx.persistence.sourceFiles.findById(workspaceId, asset.sourceFileId);
  nodes.push({
    kind: 'original_asset',
    id: asset.id,
    occurredAt: asset.createdAt,
    parentId: null,
    labelKey: 'provenance.node.original_asset',
    detail: [
      { key: 'mediaType', value: str(asset.mediaType), valueKey: `media_type.${asset.mediaType}` },
      { key: 'byteSize', value: str(source?.measured?.byteSize ?? null), valueKey: null },
      // Bat bien I-1: tep goc khong bao gio bi ghi de. Hien ra de nguoi dung thay dieu do.
      { key: 'checksumSha256', value: str(source?.measured?.checksumSha256 ?? null), valueKey: null },
    ],
    evidenceStatus: source?.measured ? 'verified' : 'unknown',
  });

  const proxy = await ctx.persistence.videoProxies.findByAsset(workspaceId, assetId);
  if (proxy) {
    nodes.push({
      kind: 'proxy_asset', id: proxy.id, occurredAt: proxy.createdAt, parentId: asset.id,
      labelKey: 'provenance.node.proxy_asset',
      detail: [{ key: 'byteSize', value: str(proxy.byteSize), valueKey: null }, { key: 'heightPx', value: str(proxy.heightPx), valueKey: null }, { key: 'hasAudio', value: str(proxy.hasAudio), valueKey: null }],
      evidenceStatus: 'verified',
    });
  }

  const jobs = await ctx.persistence.jobs.listByAsset(workspaceId, assetId);
  for (const job of jobs) {
    nodes.push({
      kind: 'job', id: job.id, occurredAt: job.createdAt, parentId: asset.id,
      labelKey: 'provenance.node.job',
      detail: [{ key: 'state', value: str(job.state), valueKey: `job_state.${job.state}` }, { key: 'operations', value: str(job.request.operations.join(',')), valueKey: null }, { key: 'reasonCode', value: str(job.reasonCode), valueKey: null }],
      evidenceStatus: 'verified',
    });

    // Job `review_required` la mot QUYET DINH cua cong chan — phai hien ra, khong chi la mot trang thai.
    if (job.state === 'review_required' || job.state === 'failed') {
      nodes.push({
        kind: 'review_decision', id: `${job.id}:review`, occurredAt: job.updatedAt, parentId: job.id,
        labelKey: 'provenance.node.review_decision',
        detail: [{ key: 'state', value: str(job.state), valueKey: `job_state.${job.state}` }, { key: 'reasonCode', value: str(job.reasonCode), valueKey: null }],
        evidenceStatus: 'verified',
      });
    }

    const corrections = await ctx.persistence.jobFrames.listCorrections(workspaceId, job.id);
    for (const c of corrections) {
      nodes.push({
        kind: 'correction', id: c.id, occurredAt: c.correctedAt, parentId: job.id,
        labelKey: 'provenance.node.correction',
        detail: [
          { key: 'frameIndex', value: str(c.frameIndex), valueKey: null },
          { key: 'reinterpolated', value: str(c.reinterpolated.length), valueKey: null },
          // Nguoi THAT da sua — nguon goc cua thay doi phai truy duoc.
          { key: 'actorUserId', value: str(c.actorUserId), valueKey: null },
        ],
        evidenceStatus: 'verified',
      });
    }

    const output = await ctx.persistence.outputs.findByJob(workspaceId, job.id);
    if (output) {
      nodes.push({
        kind: 'output_asset', id: output.id, occurredAt: output.createdAt, parentId: job.id,
        labelKey: 'provenance.node.output_asset',
        detail: [{ key: 'byteSize', value: str(output.byteSize), valueKey: null }, { key: 'checksumSha256', value: str(output.checksumSha256), valueKey: null }, { key: 'validated', value: str(output.validated), valueKey: null }],
        // `I-2`: chua doc lai byte thi chua duoc noi la da kiem.
        evidenceStatus: output.validated ? 'verified' : 'unknown',
      });
    }

    const receipt = await ctx.persistence.receipts.findByJob(workspaceId, job.id);
    if (receipt) {
      nodes.push({
        kind: 'receipt', id: receipt.id, occurredAt: receipt.createdAt,
        // Bien nhan treo duoi BAN KET QUA khi co; khong co thi treo duoi job.
        parentId: output?.id ?? job.id,
        labelKey: 'provenance.node.receipt',
        detail: [{ key: 'metadataVerdict', value: str(receipt.metadataVerdict), valueKey: receipt.metadataVerdict === null ? null : `metadata.verdict.${receipt.metadataVerdict}` }, { key: 'strippedCategories', value: str(receipt.metadataStrippedCategories.join(',')), valueKey: null }, { key: 'brandKitId', value: str(receipt.brandKitId), valueKey: null }, { key: 'brandKitVersion', value: str(receipt.brandKitVersion), valueKey: null }, { key: 'schemaVersion', value: str(receipt.schemaVersion), valueKey: null }],
        evidenceStatus: receipt.metadataEvidence ?? 'unknown',
      });

      /*
       * Cong bo AI la mot MUC RIENG, khong gop vao bien nhan. Do la thu nguoi dung di tim, va no
       * co gioi han rieng phai noi ro — gop vao se lam gioi han do bien mat.
       */
      nodes.push({
        kind: 'disclosure', id: `${receipt.id}:disclosure`, occurredAt: receipt.createdAt, parentId: receipt.id,
        labelKey: 'provenance.node.disclosure',
        detail: [{ key: 'state', value: str(receipt.disclosureState), valueKey: receipt.disclosureState === null ? null : `disclosure.state.${receipt.disclosureState}` }, { key: 'limitationKey', value: str(receipt.disclosureLimitationKey), valueKey: receipt.disclosureLimitationKey }],
        evidenceStatus: receipt.disclosureState === 'ai_detection_only' ? 'partially_verified'
          : receipt.disclosureState === 'ai_used' || receipt.disclosureState === 'ai_not_used' ? 'verified'
            : receipt.disclosureState === 'provider_blocked' ? 'blocked' : 'unknown',
      });
      if (receipt.disclosureLimitationKey) limitationKeys.add(receipt.disclosureLimitationKey);
    }

    const snapshots = await ctx.persistence.metadataSnapshots.findByJob(workspaceId, job.id);
    for (const snap of snapshots) {
      nodes.push({
        kind: 'operation', id: snap.id, occurredAt: snap.recordedAt, parentId: job.id,
        labelKey: snap.phase === 'before'
          ? 'provenance.node.metadata_before' : 'provenance.node.metadata_after',
        detail: [{ key: 'readable', value: str(snap.readable), valueKey: null }, { key: 'fieldCount', value: str(snap.fields.length), valueKey: null }, { key: 'detectorId', value: str(snap.detectorId), valueKey: null }],
        // Khong doc duoc anh chup thi day KHONG phai bang chung — no la mot phep do that bai.
        evidenceStatus: snap.readable ? 'verified' : 'unknown',
      });
      if (!snap.readable) limitationKeys.add('provenance.limitation.metadata_unreadable');
    }
  }

  return ok(buildProvenanceTimeline(assetId, nodes, [...limitationKeys].sort()));
}
