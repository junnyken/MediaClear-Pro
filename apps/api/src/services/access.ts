/**
 * Cong truy cap duy nhat cua Phase 1 (MCP-10).
 *
 * Thu tu bat buoc: session -> workspace context -> authorize() cua Phase 0.
 * Khong route nao duoc tu kiem quyen theo cach rieng.
 */
import {
  ERROR_CODES,
  apiError,
  authorize,
  type Permission,
  type User,
  type Workspace,
  type WorkspaceRole,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { fail, ok, type ServiceResult } from './result.js';

export interface Actor {
  user: User;
  workspace: Workspace;
  role: WorkspaceRole;
}

export interface AuthenticatedUser {
  user: User;
}

/** Buoc 1: chi xac dinh NGUOI, chua gan workspace (dung cho GET /v1/me, /v1/workspaces). */
export async function resolveUser(ctx: AppContext, token: string | null): Promise<ServiceResult<AuthenticatedUser>> {
  if (!token) return fail(apiError(ERROR_CODES.MCP_AUTHZ_SESSION_REQUIRED));
  const session = await ctx.identity.resolveSession(token, ctx.now().getTime());
  if (!session) return fail(apiError(ERROR_CODES.MCP_AUTHZ_SESSION_REQUIRED));
  const user = await ctx.persistence.users.findById(session.userId);
  if (!user) return fail(apiError(ERROR_CODES.MCP_AUTHZ_SESSION_REQUIRED));
  return ok({ user });
}

/**
 * Buoc 2: gan workspace dang thao tac.
 * - Co workspaceId: phai la thanh vien, neu khong tra 404 (khong lo workspace co ton tai).
 * - Khong co: dung workspace duy nhat cua user; neu co nhieu thi bat client chon.
 */
export async function resolveActor(
  ctx: AppContext,
  token: string | null,
  workspaceId: string | null,
): Promise<ServiceResult<Actor>> {
  const authed = await resolveUser(ctx, token);
  if (!authed.ok) return fail(authed.error);
  const user = authed.data.user;
  const memberships = await ctx.persistence.workspaces.listForUser(user.id);

  if (workspaceId) {
    const found = memberships.find((m) => m.workspace.id === workspaceId);
    if (!found) return fail(apiError(ERROR_CODES.MCP_AUTHZ_WORKSPACE_ACCESS_DENIED));
    return ok({ user, workspace: found.workspace, role: found.membership.role });
  }
  const first = memberships[0];
  if (!first) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'workspace' }));
  if (memberships.length > 1) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { reason: 'workspace_id_required' }));
  }
  return ok({ user, workspace: first.workspace, role: first.membership.role });
}

export interface PermissionCheck {
  resourceWorkspaceId: string;
  resourceType: 'workspace' | 'project' | 'asset' | 'job' | 'usage' | 'audit';
  resourceId: string;
  permission: Permission;
}

/**
 * Buoc 3: goi authorize() cua Phase 0 va GHI AUDIT cho moi lan tu choi.
 * Khong tra ve thong tin cho phep suy ra tai nguyen co ton tai hay khong.
 */
export async function ensurePermission(
  ctx: AppContext,
  actor: Actor,
  check: PermissionCheck,
): Promise<ServiceResult<null>> {
  const decision = authorize({
    actorUserId: actor.user.id,
    actorWorkspaceId: actor.workspace.id,
    actorRole: actor.role,
    resourceWorkspaceId: check.resourceWorkspaceId,
    resourceType: check.resourceType,
    resourceId: check.resourceId,
    permission: check.permission,
  });

  if (decision.decision === 'deny') {
    await recordAudit(ctx.persistence, {
      workspaceId: actor.workspace.id,
      actorUserId: actor.user.id,
      eventType: AUDIT_EVENTS.PERMISSION_DENIED,
      subjectType: check.resourceType,
      subjectId: decision.revealsResourceExistence ? check.resourceId : 'redacted',
      detail: { ...decision.auditDetail },
    });
    return fail(decision.error ?? apiError(ERROR_CODES.MCP_AUTHZ_INSUFFICIENT_ROLE));
  }
  return ok(null);
}
