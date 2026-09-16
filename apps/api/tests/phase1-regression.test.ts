/**
 * Hoi quy Phase 1 (prompt muc 12): 12 invariant moi, moi cai mot test goi ten ro.
 * 12 invariant cua Phase 0 van duoc bao ve boi packages/contracts/tests/invariants.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { NoopContractProvider, roleHasPermission } from '@mediaclear/contracts';
import {
  attest,
  auth,
  createJob,
  createProject,
  createWorkspace,
  makeApp,
  signIn,
  uploadFixture,
  validateAsset,
} from './helpers.js';

describe('Hoi quy Phase 1', () => {
  it('R-1 + R-2: nguoi ngoai workspace khong doc duoc project lan asset', async () => {
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const outsider = await signIn(app, 'outsider@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const wsOutsider = await createWorkspace(app, outsider, 'Ngoai');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });

    const p = await app.inject({ method: 'GET', url: `/v1/projects/${project}`, headers: auth(outsider, wsOutsider) });
    const a = await app.inject({
      method: 'GET',
      url: `/v1/assets/${uploaded.assetId}`,
      headers: auth(outsider, wsOutsider),
    });
    expect([p.statusCode, a.statusCode]).toEqual([404, 404]);
    await app.close();
  });

  it('R-3: viewer khong tao duoc job (kiem ca o ma tran quyen lan o HTTP)', async () => {
    expect(roleHasPermission('viewer', 'job.create')).toBe(false);
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const viewer = await signIn(app, 'viewer@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, owner, ws, uploaded.assetId);
    await attest(app, owner, ws, uploaded.assetId);
    await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${ws}/members`,
      headers: auth(owner, ws),
      payload: { email: 'viewer@matbao.com', role: 'viewer' },
    });
    const res = await createJob(app, viewer, ws, uploaded.assetId);
    expect(res.status).toBe(403);
    await app.close();
  });

  it('R-4: member khong quan ly billing hay quyen so huu workspace', () => {
    expect(roleHasPermission('member', 'billing.manage')).toBe(false);
    expect(roleHasPermission('member', 'workspace.manage')).toBe(false);
    expect(roleHasPermission('member', 'workspace.members.manage')).toBe(false);
    expect(roleHasPermission('owner', 'billing.manage')).toBe(true);
  });

  it('R-5: asset khong hop le khong tao duoc job', async () => {
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'video-600s.mp4', {
      mimeType: 'video/mp4',
      mediaType: 'video',
    });
    await validateAsset(app, owner, ws, uploaded.assetId);
    await attest(app, owner, ws, uploaded.assetId);
    const res = await createJob(app, owner, ws, uploaded.assetId);
    expect(res.status).toBeGreaterThanOrEqual(400);
    await app.close();
  });

  it('R-6: xac nhan quyen khong hop le khong tao duoc job', async () => {
    const { app } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, owner, ws, uploaded.assetId);
    // Ky sai phien ban cau chu => coi nhu chua ky.
    const stale = await app.inject({
      method: 'POST',
      url: `/v1/assets/${uploaded.assetId}/rights-attestation`,
      headers: auth(owner, ws),
      payload: { statementId: 'rights_attestation', statementVersion: 0, localeShown: 'vi', accepted: true },
    });
    expect(stale.statusCode).toBe(403);
    const res = await createJob(app, owner, ws, uploaded.assetId);
    expect(res.body.error.code).toBe('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    await app.close();
  });

  it('R-7: job blocked khong quay lai processing bang bat ky route nao', async () => {
    const { app, ctx } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    const blocked = await createJob(app, owner, ws, uploaded.assetId);
    const jobId = blocked.body.error.params.jobId as string;

    // Thu moi route co the dong toi job: khong cai nao doi duoc state.
    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/cancel`, headers: auth(owner, ws) });
    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/estimate`, headers: auth(owner, ws) });
    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(owner, ws) });
    const after = await ctx.persistence.jobs.findById(ws, jobId);
    expect(after?.state).toBe('blocked');
    await app.close();
  });

  it('R-8: provider no-op khong bao gio sinh output verified gia', async () => {
    const provider = new NoopContractProvider();
    expect(provider.isProductionProvider).toBe(false);
    const result = await provider.getResult();
    expect(result.outputUrl).toBeNull();
    expect(result.evidenceStatus).toBe('unknown');

    const { app, ctx } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, owner, ws, uploaded.assetId);
    await attest(app, owner, ws, uploaded.assetId);
    const job = await createJob(app, owner, ws, uploaded.assetId);
    expect(job.body.data.job.state).not.toBe('completed');
    expect(job.body.data.job.outputAssetId).toBeNull();
    // P2-MCP-27: nay DA co provider production (ban tat dinh), nhung KHONG co provider AI nao.
    // Y dinh cua R-8 van nguyen: khong duoc sinh ra output "verified" gia.
    expect(ctx.providers.listProductionAi()).toHaveLength(0);
    expect(ctx.providers.listProduction().every((p) => p.usesAiModel === false)).toBe(true);
    await app.close();
  });

  it('R-9: byte cua file goc khong bao gio bi ghi de', async () => {
    const { app, ctx } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    const record = await ctx.persistence.sourceFiles.findById(ws, uploaded.sourceFileId);
    const before = await ctx.storage.head({ bucket: ctx.bucket, key: record?.storageKey ?? '' });

    await expect(
      ctx.storage.putObject({ bucket: ctx.bucket, key: record?.storageKey ?? '' }, Buffer.from('doi noi dung'), 'image/png'),
    ).rejects.toThrow();

    const after = await ctx.storage.head({ bucket: ctx.bucket, key: record?.storageKey ?? '' });
    expect(after.checksumSha256).toBe(before.checksumSha256);
    await app.close();
  });

  it('R-10: gui lai upload/job khong tao reservation trung', async () => {
    const { app, ctx } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');
    const uploaded = await uploadFixture(app, owner, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, owner, ws, uploaded.assetId);
    await attest(app, owner, ws, uploaded.assetId);
    await createJob(app, owner, ws, uploaded.assetId, { idempotencyKey: 'k' });
    await createJob(app, owner, ws, uploaded.assetId, { idempotencyKey: 'k' });
    await createJob(app, owner, ws, uploaded.assetId, { idempotencyKey: 'k' });
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'reserve')).toHaveLength(1);
    await app.close();
  });

  it('R-11: preview chua duoc hien thuc nen khong the tinh tien (van tra 501)', async () => {
    const { app, ctx } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const res = await app.inject({ method: 'POST', url: '/v1/jobs/job_bat-ky/preview', headers: auth(owner, ws) });
    expect(res.statusCode).toBe(501);
    expect(res.json().error.code).toBe('MCP_NOT_IMPLEMENTED');
    expect(await ctx.persistence.usage.listByWorkspace(ws)).toHaveLength(0);
    await app.close();
  });

  it('R-12: phan hoi loi khong lo secret, duong dan he thong hay chi tiet noi bo', async () => {
    const { app, ctx } = await makeApp();
    const owner = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, owner, 'Studio');
    const project = await createProject(app, owner, ws, 'Du an');

    const responses = [
      await app.inject({ method: 'GET', url: '/v1/me' }),
      await app.inject({ method: 'GET', url: '/v1/projects/prj_khong-co', headers: auth(owner, ws) }),
      await app.inject({ method: 'PUT', url: '/v1/storage/upload/token-gia.chu-ky-gia', payload: Buffer.from('x') }),
      await app.inject({
        method: 'POST',
        url: `/v1/projects/${project}/assets/upload-intent`,
        headers: auth(owner, ws),
        payload: { originalFilename: '', mimeType: 'image/png', mediaType: 'image', byteSize: 1 },
      }),
      // Loi tang FRAMEWORK cung phai ra ApiError, khong duoc lo FST_ERR_* ra ngoai.
      await app.inject({
        method: 'POST',
        url: '/v1/assets/ast_x/validate',
        headers: { ...auth(owner, ws), 'content-type': 'application/json' },
        payload: '',
      }),
      await app.inject({
        method: 'POST',
        url: '/v1/workspaces',
        headers: { ...auth(owner), 'content-type': 'application/json' },
        payload: '{ khong phai json',
      }),
      await app.inject({ method: 'GET', url: '/duong-dan-khong-ton-tai', headers: auth(owner, ws) }),
    ];
    for (const res of responses) {
      const text = res.body;
      expect(text).not.toContain(ctx.config.uploadSecret);
      expect(text).not.toContain(ctx.config.dataDir);
      expect(text).not.toContain('Error:');
      expect(text, 'lo ma loi noi bo cua framework').not.toContain('FST_ERR');
      expect(text).not.toMatch(/at [A-Za-z]+ \(/); // khong co stack trace
      // Moi phan hoi loi deu phai la envelope cua he thong, co translation key.
      const body = res.json();
      expect(body.ok).toBe(false);
      expect(body.error.messageKey).toMatch(/^errors\./);
    }
    await app.close();
  });
});
