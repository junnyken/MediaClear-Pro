/**
 * Usage summary (MCP-14 / MCP-07).
 *
 * Phase 1 chua thu tien. Ledger chi do luong. Da reserve ma chua co output verified
 * thi hien o muc "dang giu", KHONG duoc gop vao "da tinh".
 */
import { ERROR_CODES, apiError, type UsageLedgerEntry } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

export interface UsageSummary {
  workspaceId: string;
  imageUnitsCommitted: number;
  videoMinuteUnitsCommitted: number;
  imageUnitsReserved: number;
  videoMinuteUnitsReserved: number;
  entries: UsageLedgerEntry[];
}

export async function getUsageSummary(ctx: AppContext, actor: Actor): Promise<ServiceResult<UsageSummary>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'usage',
    resourceId: actor.workspace.id,
    permission: 'job.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  if (!actor.workspace.id) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'workspace' }));

  const entries = await ctx.persistence.usage.listByWorkspace(actor.workspace.id);
  const summary: UsageSummary = {
    workspaceId: actor.workspace.id,
    imageUnitsCommitted: 0,
    videoMinuteUnitsCommitted: 0,
    imageUnitsReserved: 0,
    videoMinuteUnitsReserved: 0,
    entries,
  };

  const settledJobs = new Set(
    entries.filter((e) => e.entryType === 'release' || e.entryType === 'commit').map((e) => e.jobId),
  );
  for (const entry of entries) {
    if (entry.entryType === 'commit') {
      if (entry.unitType === 'image_unit') summary.imageUnitsCommitted += entry.quantity;
      else summary.videoMinuteUnitsCommitted += entry.quantity;
    }
    if (entry.entryType === 'reserve' && !settledJobs.has(entry.jobId)) {
      if (entry.unitType === 'image_unit') summary.imageUnitsReserved += entry.quantity;
      else summary.videoMinuteUnitsReserved += entry.quantity;
    }
  }
  return ok(summary);
}
