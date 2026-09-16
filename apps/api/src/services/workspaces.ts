/**
 * Workspace & membership service (MCP-10 Phase 1).
 *
 * Nguoi tao workspace la 'owner'. Role KHONG suy dien tu bat ky dau khac.
 */
import {
  ERROR_CODES,
  WORKSPACE_ROLES,
  apiError,
  type Workspace,
  type WorkspaceMembership,
  type WorkspaceRole,
} from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import type { PageQuery } from '../persistence/types.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

const MAX_NAME_LENGTH = 120;

function validName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) return null;
  return trimmed;
}

export async function createWorkspace(
  ctx: AppContext,
  userId: string,
  rawName: unknown,
): Promise<ServiceResult<{ workspace: Workspace; membership: WorkspaceMembership }>> {
  const name = validName(rawName);
  if (!name) return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'name' }));

  const workspace: Workspace = {
    id: newId('wsp'),
    name,
    ownerUserId: userId,
    createdAt: ctx.now().toISOString(),
  };
  await ctx.persistence.workspaces.create(workspace);
  const membership: WorkspaceMembership = {
    id: newId('mem'),
    workspaceId: workspace.id,
    userId,
    role: 'owner',
    createdAt: ctx.now().toISOString(),
  };
  await ctx.persistence.memberships.create(membership);
  await recordAudit(ctx.persistence, {
    workspaceId: workspace.id,
    actorUserId: userId,
    eventType: AUDIT_EVENTS.WORKSPACE_CREATED,
    subjectType: 'workspace',
    subjectId: workspace.id,
    detail: { name },
  });
  return ok({ workspace, membership });
}

export async function listWorkspacesForUser(
  ctx: AppContext,
  userId: string,
): Promise<Array<{ workspace: Workspace; membership: WorkspaceMembership }>> {
  return ctx.persistence.workspaces.listForUser(userId);
}

export async function listMembers(ctx: AppContext, actor: Actor): Promise<ServiceResult<WorkspaceMembership[]>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'workspace',
    resourceId: actor.workspace.id,
    permission: 'workspace.members.manage',
  });
  if (!allowed.ok) return fail(allowed.error);
  return ok(await ctx.persistence.memberships.listByWorkspace(actor.workspace.id));
}

export async function addMember(
  ctx: AppContext,
  actor: Actor,
  input: { email: unknown; role: unknown },
): Promise<ServiceResult<WorkspaceMembership>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'workspace',
    resourceId: actor.workspace.id,
    permission: 'workspace.members.manage',
  });
  if (!allowed.ok) return fail(allowed.error);

  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (email.length === 0 || !email.includes('@')) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'email' }));
  }
  const role = input.role as WorkspaceRole;
  if (!WORKSPACE_ROLES.includes(role)) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'role' }));
  }

  const user = await ctx.persistence.users.findByEmail(email);
  if (!user) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'user' }));

  const existing = await ctx.persistence.memberships.find(actor.workspace.id, user.id);
  if (existing) return ok(existing);

  const membership: WorkspaceMembership = {
    id: newId('mem'),
    workspaceId: actor.workspace.id,
    userId: user.id,
    role,
    createdAt: ctx.now().toISOString(),
  };
  await ctx.persistence.memberships.create(membership);
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.WORKSPACE_MEMBER_ADDED,
    subjectType: 'membership',
    subjectId: membership.id,
    detail: { role, memberUserId: user.id },
  });
  return ok(membership);
}

export async function listAuditEvents(ctx: AppContext, actor: Actor, query?: PageQuery) {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'audit',
    resourceId: actor.workspace.id,
    permission: 'audit.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  return ok(await ctx.persistence.audit.listByWorkspace(actor.workspace.id, query));
}
