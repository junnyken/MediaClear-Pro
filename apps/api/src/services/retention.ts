/**
 * Retention service (P1.1-MCP-18).
 *
 * AN TOAN DU LIEU: khong ham nao trong file nay xoa bat ky thu gi. Khong goi
 * deleteObject(), khong xoa ban ghi. Phase 1.1 chi co duong "thu khong xoa".
 * Luat nam o contract `retention.ts`; o day chi lay du lieu roi hoi luat.
 */
import {
  ERROR_CODES,
  RETENTION_POLICY_VERSION,
  apiError,
  retentionDecisionFor,
  retentionDryRun,
  type RetentionDataClass,
  type RetentionDecision,
  type RetentionDryRunReport,
  type RetentionSubject,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import type { SourceFileRecord } from '../persistence/types.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

/** Quy doi ban ghi file nguon thanh doi tuong ma luat luu giu hieu duoc. */
function toSubject(record: SourceFileRecord): RetentionSubject {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    dataClass: 'source_asset',
    createdAt: record.createdAt,
    lastAccessedAt: record.lastAccessedAt,
    deletedAt: record.deletedAt,
    retentionState: record.retentionState,
    legalHoldAt: record.legalHoldAt,
    byteSize: record.measured?.byteSize ?? null,
  };
}

export interface AssetRetentionView {
  assetId: string;
  sourceFileId: string;
  retentionState: RetentionSubject['retentionState'];
  policyVersion: number;
  lastAccessedAt: string | null;
  /** Giu toi khi nao neu khong ai dung nua. */
  retainUntil: string | null;
  /** true = theo luat hien tai, tep nay DA du dieu kien de bi don. */
  deletionCandidate: boolean;
  reason: string;
}

/** Nguoi dung xem tep cua chinh minh con duoc giu toi bao gio. */
export async function retentionForAsset(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<AssetRetentionView>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);

  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));

  const decision: RetentionDecision = retentionDecisionFor(toSubject(record), ctx.now());
  return ok({
    assetId,
    sourceFileId: record.id,
    retentionState: record.retentionState,
    policyVersion: record.retentionPolicyVersion || RETENTION_POLICY_VERSION,
    lastAccessedAt: record.lastAccessedAt,
    retainUntil: decision.retainUntil,
    deletionCandidate: decision.isCandidate,
    reason: decision.reason,
  });
}

export interface RetentionDryRunOptions {
  asOf: Date;
  workspaceId?: string | null;
  dataClass?: RetentionDataClass | null;
}

/**
 * Bao cao "neu don theo luat thi don nhung gi" - CHI DEM.
 * Khong tra ve du lieu nhay cam cua tung ban ghi, chi la con so tong hop.
 */
export async function retentionDryRunReport(
  ctx: AppContext,
  options: RetentionDryRunOptions,
): Promise<RetentionDryRunReport> {
  const records = await ctx.persistence.sourceFiles.listForRetention(options.workspaceId ?? null);
  const subjects = records.map(toSubject);
  return retentionDryRun(subjects, {
    asOf: options.asOf,
    workspaceId: options.workspaceId ?? null,
    dataClass: options.dataClass ?? null,
  });
}

/** Ghi nhan lan truy cap - moc de luat 30 ngay co y nghia. Khong bao gio nem loi ra ngoai. */
export async function touchAssetAccess(ctx: AppContext, workspaceId: string, sourceFileId: string): Promise<void> {
  await ctx.persistence.sourceFiles.touchAccess(workspaceId, sourceFileId, ctx.now().toISOString());
}
