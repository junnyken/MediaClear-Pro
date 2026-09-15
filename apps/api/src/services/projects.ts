/** Project service (MCP-11 Phase 1). Moi truy van deu bi rang buoc theo workspace. */
import { ERROR_CODES, apiError, type Project } from '@mediaclear/contracts';
import type { AppContext } from '../app-context.js';
import type { Page, PageQuery } from '../persistence/types.js';
import { newId } from '../ids.js';
import { AUDIT_EVENTS, recordAudit } from './audit.js';
import { ensurePermission, type Actor } from './access.js';
import { fail, ok, type ServiceResult } from './result.js';

const MAX_NAME_LENGTH = 120;

export async function createProject(ctx: AppContext, actor: Actor, rawName: unknown): Promise<ServiceResult<Project>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'project',
    resourceId: 'new',
    permission: 'project.manage',
  });
  if (!allowed.ok) return fail(allowed.error);

  const name = typeof rawName === 'string' ? rawName.trim() : '';
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return fail(apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'name' }));
  }

  const project: Project = {
    id: newId('prj'),
    workspaceId: actor.workspace.id,
    name,
    createdByUserId: actor.user.id,
    createdAt: ctx.now().toISOString(),
  };
  await ctx.persistence.projects.create(project);
  await recordAudit(ctx.persistence, {
    workspaceId: actor.workspace.id,
    actorUserId: actor.user.id,
    eventType: AUDIT_EVENTS.PROJECT_CREATED,
    subjectType: 'project',
    subjectId: project.id,
    detail: { name },
  });
  return ok(project);
}

export async function listProjects(ctx: AppContext, actor: Actor, query?: PageQuery): Promise<ServiceResult<Page<Project>>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'project',
    resourceId: 'list',
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  return ok(await ctx.persistence.projects.listByWorkspace(actor.workspace.id, query));
}

/**
 * Doc mot project. Khong tim thay TRONG workspace cua actor => 404
 * (giong het truong hop project cua workspace khac: nhin tu ngoai khong phan biet duoc).
 */
export async function getProject(ctx: AppContext, actor: Actor, projectId: string): Promise<ServiceResult<Project>> {
  const allowed = await ensurePermission(ctx, actor, {
    resourceWorkspaceId: actor.workspace.id,
    resourceType: 'project',
    resourceId: projectId,
    permission: 'asset.read',
  });
  if (!allowed.ok) return fail(allowed.error);
  const project = await ctx.persistence.projects.findById(actor.workspace.id, projectId);
  if (!project) return fail(apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'project' }));
  return ok(project);
}
