/**
 * `P5-MCP-51` + `P5-MCP-54` — do metadata truoc/sau, va suy trang thai cong bo AI.
 *
 * Dat chung mot muc vi hai viec nay dung CHUNG mot cap byte: tep truoc khi xu ly va tep sau khi xu
 * ly. Tach ra hai duong doc se mo ra kha nang hai ket luan trong cung mot bien nhan lai noi ve hai
 * tep khac nhau — dung kieu loi `D-047` ton tai de chan.
 *
 * Luat nam o contract (`compareMetadata`, `disclosureStatusFor`). Muc nay chi lay du lieu, hoi luat,
 * roi luu — no KHONG tu quyet dinh gi.
 */
import {
  compareMetadata,
  disclosureStatusFor,
  type DisclosureResult,
  type EvidenceStatus,
  type MediaType,
  type MetadataComparison,
  type MetadataSnapshot,
  type Presence,
} from '@mediaclear/contracts';
import { ERROR_CODES, apiError } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';
import { snapshotMetadata } from '../media/metadata-snapshot.js';

export interface MetadataProvenanceOutcome {
  comparison: MetadataComparison;
  disclosure: DisclosureResult;
}

/**
 * Trang thai bang chung cua PROVIDER AI.
 *
 * Doc tu chinh provider dang duoc dang ky, KHONG hardcode. Mot ban gia tat dinh (`isProduction
 * Provider === false`) KHONG duoc coi la bang chung — de bai goi day la "provider tu bao capability".
 */
export function providerEvidenceStatus(ctx: AppContext): EvidenceStatus {
  const provider = ctx.trackingProvider;
  if (!provider) return 'unknown';
  return provider.isProductionProvider ? 'verified' : 'blocked';
}

/**
 * Do metadata o CA HAI phia roi doi chieu, va suy trang thai cong bo.
 *
 * `after` la `null` khi duong xu ly co y KHONG render (vi du cong chan tu choi tu truoc). Khi do
 * anh chup "sau" duoc ghi la KHONG DOC DUOC — va `compareMetadata` se tra `unknown` cho tat ca.
 * Day la cho de bi cam do nhat: dien mot anh chup rong vao se lam he thong bao "khong mat gi",
 * trong khi su that la chua he do.
 */
export async function recordMetadataAndDisclosure(
  ctx: AppContext,
  input: {
    workspaceId: string;
    jobId: string;
    mediaType: MediaType;
    beforeBytes: Uint8Array;
    afterBytes: Uint8Array | null;
    /** Ket qua bo do C2PA tren tep DAU VAO. */
    inputAiPresence: Presence;
    /** Luot nay co goi buoc AI nao khong. `null` = khong biet. */
    aiStepUsed: boolean | null;
  },
): Promise<MetadataProvenanceOutcome> {
  const now = ctx.now().toISOString();

  const before = await snapshotMetadata(input.beforeBytes, input.mediaType);
  const after: MetadataSnapshot = input.afterBytes
    ? await snapshotMetadata(input.afterBytes, input.mediaType)
    : { readable: false, fields: [], detectorId: before.detectorId };

  // Ghi CA HAI anh chup. APPEND-ONLY — tang du lieu tu choi ghi de.
  for (const [phase, snap] of [['before', before], ['after', after]] as const) {
    await ctx.persistence.metadataSnapshots.save({
      id: newId('mds'),
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      phase,
      readable: snap.readable,
      fields: snap.fields,
      detectorId: snap.detectorId,
      recordedAt: now,
    });
  }

  const comparison = compareMetadata(before, after);

  const disclosure = disclosureStatusFor({
    inputAiPresence: input.inputAiPresence,
    /*
     * LUON `false`. Bo do C2PA cua he thong (`D-069`) chi doc SU HIEN DIEN cua ban kha nang; no
     * khong kiem chu ky va khong xac thuc chuoi tin cay. Dat `true` o day se lam giao dien noi
     * "da xac minh" ve mot dieu chua he duoc xac minh.
     */
    detectorVerifiesSignature: false,
    providerStatus: providerEvidenceStatus(ctx),
    aiStepUsed: input.aiStepUsed,
  });

  return { comparison, disclosure };
}

/** Phan bien nhan do Phase 5 sinh ra. Gom lai de ba noi tao bien nhan khong tu che moi noi mot kieu. */
export function receiptPhase5Fields(outcome: MetadataProvenanceOutcome | null): {
  metadataVerdict: MetadataComparison['verdict'] | null;
  metadataEvidence: EvidenceStatus | null;
  metadataStrippedCategories: MetadataComparison['strippedCategories'];
  disclosureState: DisclosureResult['state'] | null;
  disclosureLimitationKey: string | null;
  brandKitId: string | null;
  brandKitVersion: number | null;
  schemaVersion: number;
} {
  return {
    metadataVerdict: outcome?.comparison.verdict ?? null,
    metadataEvidence: outcome?.comparison.evidenceStatus ?? null,
    metadataStrippedCategories: outcome?.comparison.strippedCategories ?? [],
    disclosureState: outcome?.disclosure.state ?? null,
    disclosureLimitationKey: outcome?.disclosure.limitationKey ?? null,
    /*
     * Bo nhan dien: `null` o day la MAC DINH va la cho an toan. Ban xuat chi mang lop phu khi
     * nguoi dung CHON — khong duong nao trong ma tu dien gia tri vao hai o nay.
     */
    brandKitId: null,
    brandKitVersion: null,
    schemaVersion: 2,
  };
}

/**
 * `P5-MCP-51` — doc lai ket qua doi chieu metadata cua mot job.
 *
 * Doi chieu duoc TINH LAI tu hai anh chup da luu, khong doc mot o ket qua da ghi san. Ly do: mot o
 * ket qua ghi san la mot khang dinh khong kiem chung duoc; tinh lai tu du lieu tho thi nguoi doc
 * co the doi chieu tung truong.
 */
export async function getJobMetadataComparison(
  ctx: AppContext, actor: Actor, jobId: string,
): Promise<ServiceResult<{
  verdict: MetadataComparison['verdict'];
  fields: Array<{ key: string; category: string; before: string | null; after: string | null; status: string }>;
  strippedCategories: string[];
  evidenceStatus: EvidenceStatus;
  bothReadable: boolean;
}>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id, resourceType: 'job', resourceId: jobId, permission: 'job.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const snaps = await ctx.persistence.metadataSnapshots.findByJob(actor.workspace.id, jobId);
  const before = snaps.find((s) => s.phase === 'before');
  const after = snaps.find((s) => s.phase === 'after');
  if (!before || !after) {
    return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'metadata_snapshot' }));
  }

  const comparison = compareMetadata(
    { readable: before.readable, fields: before.fields, detectorId: before.detectorId },
    { readable: after.readable, fields: after.fields, detectorId: after.detectorId },
  );

  return ok({
    verdict: comparison.verdict,
    /*
     * Gia tri duoc doi sang chuoi o bien gioi API. Hop dong khai `string | null` de giao dien khong
     * phai doan kieu — mot truong co the la so, chuoi hay boolean tuy dinh dang tep.
     */
    fields: comparison.fields.map((f) => ({
      key: f.key, category: f.category,
      before: f.before === null ? null : String(f.before),
      after: f.after === null ? null : String(f.after),
      status: f.status,
    })),
    strippedCategories: comparison.strippedCategories,
    evidenceStatus: comparison.evidenceStatus,
    bothReadable: before.readable && after.readable,
  });
}
