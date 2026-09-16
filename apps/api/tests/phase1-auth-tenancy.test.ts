/**
 * MCP-10: auth boundary + workspace isolation. Chay HTTP that qua Fastify inject.
 */
import { describe, expect, it } from 'vitest';
import { auth, createProject, createWorkspace, makeApp, signIn } from './helpers.js';

describe('MCP-10 auth & workspace boundary', () => {
  it('/healthz tu khai dung ha tang dang chay va KHONG bat xu ly AI production', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.productionAiProcessingEnabled).toBe(false);
    expect(body.identityProvider.production).toBe(false);
    expect(body.storage.production).toBe(false);
    expect(body.persistence.durability).toBe('ephemeral');
    // P2-MCP-27: co 1 provider production (ban tat dinh bang libvips), nhung KHONG phai AI.
    // Dieu can giu nguyen la dong duoi: he thong khong duoc tu nhan la da bat xu ly AI.
    expect(body.productionProviders).toBe(1);
    expect(body.limits.maxVideoDurationSeconds).toBe(599);
    await app.close();
  });

  it('khong co session => 401 voi ma loi on dinh, khong lo chi tiet noi bo', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me' });
    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('MCP_AUTHZ_SESSION_REQUIRED');
    expect(body.error.messageKey).toBe('errors.mcp_authz_session_required');
    await app.close();
  });

  it('session rac => 401, khong phai 500', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/v1/me', headers: auth('khong-phai-token-that') });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('nguoi tao workspace la owner va thay workspace do trong /v1/me', async () => {
    const { app } = await makeApp();
    const token = await signIn(app, 'owner@matbao.com');
    const workspaceId = await createWorkspace(app, token, 'Studio A');
    const me = await app.inject({ method: 'GET', url: '/v1/me', headers: auth(token) });
    const body = me.json();
    expect(body.data.workspaces).toHaveLength(1);
    expect(body.data.workspaces[0]).toMatchObject({ id: workspaceId, role: 'owner' });
    await app.close();
  });

  it('user chi thay workspace minh la thanh vien', async () => {
    const { app } = await makeApp();
    const a = await signIn(app, 'a@matbao.com');
    const b = await signIn(app, 'b@matbao.com');
    await createWorkspace(app, a, 'Cua A');
    await createWorkspace(app, b, 'Cua B');
    const listA = (await app.inject({ method: 'GET', url: '/v1/workspaces', headers: auth(a) })).json();
    expect(listA.data.items).toHaveLength(1);
    expect(listA.data.items[0].name).toBe('Cua A');
    await app.close();
  });

  it('doc workspace cua nguoi khac => 404, khong lo su ton tai (I-10)', async () => {
    const { app } = await makeApp();
    const a = await signIn(app, 'a@matbao.com');
    const b = await signIn(app, 'b@matbao.com');
    const wsA = await createWorkspace(app, a, 'Cua A');
    await createWorkspace(app, b, 'Cua B');
    const res = await app.inject({ method: 'GET', url: `/v1/workspaces/${wsA}`, headers: auth(b) });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('MCP_AUTHZ_WORKSPACE_ACCESS_DENIED');
    await app.close();
  });

  it('project cua workspace khac: 404 giong het truong hop khong ton tai (R-1)', async () => {
    const { app } = await makeApp();
    const a = await signIn(app, 'a@matbao.com');
    const b = await signIn(app, 'b@matbao.com');
    const wsA = await createWorkspace(app, a, 'Cua A');
    const wsB = await createWorkspace(app, b, 'Cua B');
    const projectA = await createProject(app, a, wsA, 'Du an A');

    const stolen = await app.inject({ method: 'GET', url: `/v1/projects/${projectA}`, headers: auth(b, wsB) });
    const missing = await app.inject({ method: 'GET', url: '/v1/projects/prj_khongcothat', headers: auth(b, wsB) });
    expect(stolen.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    // Hai truong hop phai khong phan biet duoc tu ben ngoai ngoai ma loi noi bo.
    expect(stolen.json().ok).toBe(missing.json().ok);
    await app.close();
  });

  it('muon workspace cua nguoi khac bang header X-Workspace-Id cung khong duoc', async () => {
    const { app } = await makeApp();
    const a = await signIn(app, 'a@matbao.com');
    const b = await signIn(app, 'b@matbao.com');
    const wsA = await createWorkspace(app, a, 'Cua A');
    await createWorkspace(app, b, 'Cua B');
    const projectA = await createProject(app, a, wsA, 'Du an A');
    const res = await app.inject({ method: 'GET', url: `/v1/projects/${projectA}`, headers: auth(b, wsA) });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('viewer khong tao duoc project; owner thi duoc (ma tran quyen that su co hieu luc)', async () => {
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const viewer = await signIn(app, 'viewer@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const added = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/members`,
      headers: auth(owner, ws),
      payload: { email: 'viewer@matbao.com', role: 'viewer' },
    });
    expect(added.statusCode).toBe(200);

    const denied = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/projects`,
      headers: auth(viewer, ws),
      payload: { name: 'Viewer thu tao' },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('MCP_AUTHZ_INSUFFICIENT_ROLE');
    await app.close();
  });

  it('member khong quan ly duoc thanh vien (R-4)', async () => {
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const member = await signIn(app, 'member@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/members`,
      headers: auth(owner, ws),
      payload: { email: 'member@matbao.com', role: 'member' },
    });
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/members`,
      headers: auth(member, ws),
      payload: { email: 'nguoikhac@matbao.com', role: 'admin' },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('moi lan tu choi quyen deu duoc ghi audit', async () => {
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const viewer = await signIn(app, 'viewer@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/members`,
      headers: auth(owner, ws),
      payload: { email: 'viewer@matbao.com', role: 'viewer' },
    });
    await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/projects`,
      headers: auth(viewer, ws),
      payload: { name: 'x' },
    });
    const audit = await app.inject({ method: 'GET', url: `/v1/workspaces/${ws}/audit-events`, headers: auth(owner, ws) });
    const types = audit.json().data.items.map((e: { eventType: string }) => e.eventType);
    expect(types).toContain('permission_denied');
    expect(types).toContain('workspace_created');
    expect(types).toContain('workspace_member_added');
    await app.close();
  });
  /*
   * Chot chan cho mot bug THAT tim duoc o Phase 1.1: DevIdentityProvider truoc day
   * dung Date.now() thay vi dong ho cua ung dung, nen phien vua tao da bi coi la het
   * han khi dong ho duoc tua. Hai nguon thoi gian trong mot tien trinh = loi im lang.
   */
  it('phien dang nhap tinh han theo DONG HO CUA UNG DUNG, khong phai gio he thong', async () => {
    let current = new Date('2027-01-01T00:00:00.000Z').getTime();
    const { app, ctx } = await makeApp({ now: () => new Date(current) });
    const token = await signIn(app, 'owner@matbao.com');

    // Ngay sau khi dang nhap: phien phai con hieu luc du gio he thong khac xa.
    expect((await app.inject({ method: 'GET', url: '/v1/me', headers: auth(token) })).statusCode).toBe(200);

    // Vua truoc han: con hieu luc.
    current += (ctx.config.sessionTtlSeconds - 1) * 1000;
    expect((await app.inject({ method: 'GET', url: '/v1/me', headers: auth(token) })).statusCode).toBe(200);

    // Qua han: het hieu luc.
    current += 2000;
    expect((await app.inject({ method: 'GET', url: '/v1/me', headers: auth(token) })).statusCode).toBe(401);
    await app.close();
  });
});
