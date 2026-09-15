/**
 * Usage summary (MCP-14 / MCP-07).
 *
 * Phase 1 chua thu tien. Ledger chi do luong. Da reserve ma chua co output verified
 * thi hien o muc "dang giu", KHONG duoc gop vao "da tinh".
 */
import {
  ERROR_CODES,
  EXPIRY_RELEASE_REASON,
  apiError,
  expirableReservationJobIds,
  reservationViewOf,
  type UsageLedgerEntry,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

export interface UsageSummary {
  workspaceId: string;
  imageUnitsCommitted: number;
  videoMinuteUnitsCommitted: number;
  imageUnitsReserved: number;
  videoMinuteUnitsReserved: number;
  /** P1.1: da qua han giu nhung chua hoan tra - KHONG duoc dem nhu dang giu. */
  imageUnitsExpired: number;
  videoMinuteUnitsExpired: number;
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
    imageUnitsExpired: 0,
    videoMinuteUnitsExpired: 0,
    entries,
  };

  const now = ctx.now();
  for (const entry of entries) {
    if (entry.entryType === 'commit') {
      if (entry.unitType === 'image_unit') summary.imageUnitsCommitted += entry.quantity;
      else summary.videoMinuteUnitsCommitted += entry.quantity;
      continue;
    }
    if (entry.entryType !== 'reserve') continue;
    // Trang thai that su cua khoan giu do contract quyet dinh, khong dem tay o day.
    const view = reservationViewOf(entry.jobId, entries, now);
    if (view?.state === 'reserved') {
      if (entry.unitType === 'image_unit') summary.imageUnitsReserved += entry.quantity;
      else summary.videoMinuteUnitsReserved += entry.quantity;
    } else if (view?.state === 'expired') {
      if (entry.unitType === 'image_unit') summary.imageUnitsExpired += entry.quantity;
      else summary.videoMinuteUnitsExpired += entry.quantity;
    }
  }
  return ok(summary);
}

export interface ExpireReservationsResult {
  /** true = chi dem, khong ghi but toan nao. */
  dryRun: boolean;
  scannedEntries: number;
  expiredFound: number;
  releasedNow: number;
  jobIds: string[];
}

/**
 * Hoan tra cac reservation da qua han (P1.1-MCP-17).
 *
 * IDEMPOTENT: chay lai khong sinh them but toan nao - lan hai khong con gi "qua han
 * ma chua hoan tra". Khoa `<jobId>:release` con chan trung o tang du lieu.
 *
 * KHONG doi ProcessingJob.state: job van o nguyen trang thai cua no. Het han la
 * chuyen cua RESERVATION, khong phai cua job.
 */
export async function expireReservations(
  ctx: AppContext,
  options: { dryRun?: boolean } = {},
): Promise<ExpireReservationsResult> {
  const dryRun = options.dryRun ?? false;
  const now = ctx.now();
  const entries = await ctx.persistence.usage.listAll();
  const jobIds = expirableReservationJobIds(entries, now);

  let releasedNow = 0;
  if (!dryRun) {
    for (const jobId of jobIds) {
      const reserve = entries.find((e) => e.jobId === jobId && e.entryType === 'reserve');
      if (!reserve) continue;
      const release: UsageLedgerEntry = {
        id: newId('usg'),
        workspaceId: reserve.workspaceId,
        jobId,
        unitType: reserve.unitType,
        quantity: reserve.quantity,
        entryType: 'release',
        reasonCode: EXPIRY_RELEASE_REASON,
        idempotencyKey: `${jobId}:release`,
        recordedAt: now.toISOString(),
        expiresAt: null,
      };
      try {
        await ctx.persistence.usage.append(release);
      } catch {
        // Da co but toan hoan tra (chay song song) => khong lam gi them. Khong release hai lan.
        continue;
      }
      releasedNow += 1;
      await recordAudit(ctx.persistence, {
        workspaceId: reserve.workspaceId,
        actorUserId: null,
        eventType: AUDIT_EVENTS.USAGE_RESERVATION_EXPIRED,
        subjectType: 'usage',
        subjectId: release.id,
        detail: {
          jobId,
          unitType: release.unitType,
          quantity: release.quantity,
          reasonCode: EXPIRY_RELEASE_REASON,
          reservedExpiresAt: reserve.expiresAt,
        },
      });
      await recordAudit(ctx.persistence, {
        workspaceId: reserve.workspaceId,
        actorUserId: null,
        eventType: AUDIT_EVENTS.USAGE_RELEASED,
        subjectType: 'usage',
        subjectId: release.id,
        detail: { jobId, reasonCode: EXPIRY_RELEASE_REASON },
      });
    }
  }

  return {
    dryRun,
    scannedEntries: entries.length,
    expiredFound: jobIds.length,
    releasedNow,
    jobIds,
  };
}
