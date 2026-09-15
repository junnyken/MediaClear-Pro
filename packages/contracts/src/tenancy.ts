/**
 * MediaClear Pro - Tenancy & role permission contract (MCP-09).
 *
 * Owner decision Q-04 (2026-09-15): User -> Workspace -> Project -> Asset.
 * Roles MVP: owner, admin, member, viewer.
 *
 * Nguyen tac cung:
 *  - KHONG co quyen suy dien. Quyen ghi trong workspace KHONG tu dong keo theo
 *    quyen billing / quan tri workspace / publish.
 *  - Kiem tra workspace TRUOC kiem tra role, va tu choi cross-workspace bang
 *    MCP_AUTHZ_WORKSPACE_ACCESS_DENIED (HTTP 404) de khong lo su ton tai cua asset.
 *  - Moi quyet dinh authorization deu sinh audit event.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';

export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const PERMISSIONS = [
  'workspace.manage',
  'workspace.members.manage',
  'billing.manage',
  'project.manage',
  'asset.upload',
  'asset.read',
  'rights.attest',
  'job.create',
  'job.read',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Ma tran quyen - liet ke TUONG MINH, khong suy dien tu thu tu role.
 * Doc theo owner decision Q-04:
 *  - Viewer KHONG duoc tao processing job.
 *  - Member KHONG duoc quan ly billing hay quyen so huu workspace.
 *  - Owner quan ly workspace va thanh vien.
 *  - Admin quan ly project, asset va processing workflow.
 */
const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly Permission[]>> = {
  owner: [
    'workspace.manage',
    'workspace.members.manage',
    'billing.manage',
    'project.manage',
    'asset.upload',
    'asset.read',
    'rights.attest',
    'job.create',
    'job.read',
    'audit.read',
  ],
  admin: ['project.manage', 'asset.upload', 'asset.read', 'rights.attest', 'job.create', 'job.read', 'audit.read'],
  member: ['asset.upload', 'asset.read', 'rights.attest', 'job.create', 'job.read'],
  viewer: ['asset.read', 'job.read'],
};

export function roleHasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function permissionsForRole(role: WorkspaceRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export interface AccessRequest {
  actorUserId: string;
  /** Workspace ma actor dang thao tac trong do. */
  actorWorkspaceId: string;
  actorRole: WorkspaceRole;
  /** Workspace so huu tai nguyen duoc yeu cau. */
  resourceWorkspaceId: string;
  resourceType: 'workspace' | 'project' | 'asset' | 'job' | 'usage' | 'audit';
  resourceId: string;
  permission: Permission;
}

export interface AccessDecision {
  decision: 'allow' | 'deny';
  error: ApiError | null;
  auditEventType: 'authz.allowed' | 'authz.denied';
  auditDetail: Record<string, string | number | boolean | null>;
  /**
   * true khi phan hoi cho phep suy ra tai nguyen CO TON TAI.
   * Voi tu choi cross-workspace, gia tri nay phai la false.
   */
  revealsResourceExistence: boolean;
}

export function authorize(request: AccessRequest): AccessDecision {
  const baseDetail = {
    actorUserId: request.actorUserId,
    actorRole: request.actorRole,
    permission: request.permission,
    resourceType: request.resourceType,
  };

  // 1) Ranh gioi tenant truoc tien - khong bao gio xac nhan tai nguyen ton tai.
  if (request.actorWorkspaceId !== request.resourceWorkspaceId) {
    return {
      decision: 'deny',
      error: apiError(ERROR_CODES.MCP_AUTHZ_WORKSPACE_ACCESS_DENIED),
      auditEventType: 'authz.denied',
      auditDetail: { ...baseDetail, reason: 'workspace_boundary', resourceId: null },
      revealsResourceExistence: false,
    };
  }

  // 2) Quyen theo role - tuong minh, khong suy dien.
  if (!roleHasPermission(request.actorRole, request.permission)) {
    return {
      decision: 'deny',
      error: apiError(ERROR_CODES.MCP_AUTHZ_INSUFFICIENT_ROLE, { permission: request.permission }),
      auditEventType: 'authz.denied',
      auditDetail: { ...baseDetail, reason: 'insufficient_role', resourceId: request.resourceId },
      revealsResourceExistence: true,
    };
  }

  return {
    decision: 'allow',
    error: null,
    auditEventType: 'authz.allowed',
    auditDetail: { ...baseDetail, reason: null, resourceId: request.resourceId },
    revealsResourceExistence: true,
  };
}
