import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  WORKSPACE_ROLES,
  authorize,
  permissionsForRole,
  roleHasPermission,
  type AccessRequest,
  type Permission,
  type WorkspaceRole,
} from '../src/tenancy.js';

const req = (over: Partial<AccessRequest> = {}): AccessRequest => ({
  actorUserId: 'u1',
  actorWorkspaceId: 'ws1',
  actorRole: 'member',
  resourceWorkspaceId: 'ws1',
  resourceType: 'asset',
  resourceId: 'a1',
  permission: 'job.create',
  ...over,
});

/** Ma tran ky vong, viet doc lap voi implementation de test co gia tri doi chieu. */
const EXPECTED: Record<WorkspaceRole, Permission[]> = {
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

describe('MCP-09 tenancy & role permissions (owner decision Q-04)', () => {
  it('dung 4 role MVP', () => {
    expect([...WORKSPACE_ROLES]).toEqual(['owner', 'admin', 'member', 'viewer']);
  });

  it('ma tran quyen khop chinh xac tung role', () => {
    for (const role of WORKSPACE_ROLES) {
      expect([...permissionsForRole(role)].sort()).toEqual([...EXPECTED[role]].sort());
    }
  });

  it('viewer khong tao duoc job (I-6)', () => {
    expect(roleHasPermission('viewer', 'job.create')).toBe(false);
    const d = authorize(req({ actorRole: 'viewer' }));
    expect(d.decision).toBe('deny');
    expect(d.error?.code).toBe('MCP_AUTHZ_INSUFFICIENT_ROLE');
  });

  it('member khong quan ly billing hay quyen so huu workspace', () => {
    expect(roleHasPermission('member', 'billing.manage')).toBe(false);
    expect(roleHasPermission('member', 'workspace.manage')).toBe(false);
    expect(roleHasPermission('member', 'workspace.members.manage')).toBe(false);
  });

  it('admin khong duoc billing/workspace ownership, nhung quan ly duoc project', () => {
    expect(roleHasPermission('admin', 'billing.manage')).toBe(false);
    expect(roleHasPermission('admin', 'workspace.manage')).toBe(false);
    expect(roleHasPermission('admin', 'project.manage')).toBe(true);
  });

  it('khong co quyen suy dien: quyen ghi asset KHONG keo theo billing/admin', () => {
    for (const role of WORKSPACE_ROLES) {
      if (roleHasPermission(role, 'asset.upload') && role !== 'owner') {
        expect(roleHasPermission(role, 'billing.manage')).toBe(false);
        expect(roleHasPermission(role, 'workspace.manage')).toBe(false);
      }
    }
  });

  it('cross-workspace bi tu choi TRUOC khi xet role va khong lo existence (I-10)', () => {
    // Ngay ca owner cung khong nhin thay tai nguyen cua workspace khac.
    const d = authorize(req({ actorRole: 'owner', resourceWorkspaceId: 'ws2' }));
    expect(d.decision).toBe('deny');
    expect(d.error?.code).toBe('MCP_AUTHZ_WORKSPACE_ACCESS_DENIED');
    expect(d.revealsResourceExistence).toBe(false);
    expect(d.auditDetail.resourceId).toBeNull();
  });

  it('moi quyet dinh authorization deu sinh audit event', () => {
    expect(authorize(req()).auditEventType).toBe('authz.allowed');
    expect(authorize(req({ actorRole: 'viewer' })).auditEventType).toBe('authz.denied');
  });

  it('moi permission trong danh sach deu duoc it nhat mot role su dung', () => {
    for (const permission of PERMISSIONS) {
      expect(
        WORKSPACE_ROLES.some((r) => roleHasPermission(r, permission)),
        `permission mo coi: ${permission}`,
      ).toBe(true);
    }
  });
});
