/**
 * Rights Attestation service (MCP-13 Phase 1).
 *
 * Day la LOI KHAI cua nguoi dung, khong phai bang chung so huu (I-5).
 * Append-only: moi lan ky tao ban ghi moi de giu nguyen lich su ai ky, ky ban nao.
 */
import {
  ERROR_CODES,
  RIGHTS_STATEMENT,
  apiError,
  type RightsAttestation,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

export interface AttestationInput {
  statementId: unknown;
  statementVersion: unknown;
  localeShown: unknown;
  accepted: unknown;
}

export async function createAttestation(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
  input: AttestationInput,
): Promise<ServiceResult<RightsAttestation>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'rights.attest',
  });
  if (!allowed.ok) return fail(allowed.error);

  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  const record = await ctx.persistence.sourceFiles.findById(actor.workspace.id, asset.sourceFileId);
  if (!record) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'source_file' }));

  // Khong tick = khong co xac nhan. Khong suy dien tu viec goi API.
  if (input.accepted !== true) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'accepted' }));
  }
  // Phai ky dung ban cau chu dang hien hanh - ky ban cu thi bat ky lai.
  if (input.statementId !== RIGHTS_STATEMENT.id || input.statementVersion !== RIGHTS_STATEMENT.version) {
    return fail(
      apiError(ERROR_CODES.MCP_POLICY_RIGHTS_ATTESTATION_STALE, {
        expectedStatementId: RIGHTS_STATEMENT.id,
        expectedVersion: RIGHTS_STATEMENT.version,
      }),
    );
  }
  const localeShown = typeof input.localeShown === 'string' && input.localeShown.length > 0 ? input.localeShown : 'vi';

  const attestation: RightsAttestation = {
    id: newId('att'),
    workspaceId: actor.workspace.id,
    scope: 'asset',
    assetId,
    sourceFileId: record.id,
    status: 'active',
    attestedByUserId: actor.user.id,
    statementId: RIGHTS_STATEMENT.id,
    statementVersion: RIGHTS_STATEMENT.version,
    localeShown,
    attestationType: 'user_self_declared',
    attestedAt: ctx.now().toISOString(),
  };
  await ctx.persistence.attestations.create(attestation);
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.RIGHTS_ATTESTATION_CREATED,
    subjectType: 'attestation',
    subjectId: attestation.id,
    detail: {
      assetId,
      sourceFileId: record.id,
      statementVersion: attestation.statementVersion,
      localeShown,
      attestationType: attestation.attestationType,
    },
  });
  return ok(attestation);
}

export async function getAttestation(
  ctx: AppContext,
  actor: Actor,
  assetId: string,
): Promise<ServiceResult<RightsAttestation | null>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'asset',
    resourceId: assetId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const asset = await ctx.persistence.assets.findById(actor.workspace.id, assetId);
  if (!asset) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'asset' }));
  return ok(await ctx.persistence.attestations.findLatest(actor.workspace.id, assetId));
}
