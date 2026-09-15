/**
 * P1.1-Q20-MCP-20 qua HTTP that: hanh vi phien ban cua noi dung xac nhan quyen.
 *
 * Q-20 chi doi CAU CHU NGU CANH, khong doi van ban duoc ky => hanh vi phien ban
 * phai y nguyen nhu sau Phase 1.1: ban cu la stale, ban hien hanh duoc chap nhan.
 */
import { describe, expect, it } from 'vitest';
import { RIGHTS_STATEMENT } from '@mediaclear/contracts';
import {
  auth,
  createJob,
  createProject,
  createWorkspace,
  makeApp,
  signIn,
  uploadFixture,
  validateAsset,
} from './helpers.js';

async function assetReadyToSign() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, 'owner@matbao.com');
  const workspaceId = await createWorkspace(app, token, 'Studio');
  const projectId = await createProject(app, token, workspaceId, 'Du an');
  const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  await validateAsset(app, token, workspaceId, uploaded.assetId);
  return { app, ctx, token, workspaceId, assetId: uploaded.assetId };
}

function sign(app: Awaited<ReturnType<typeof makeApp>>['app'], token: string, workspaceId: string, assetId: string, version: number) {
  return app.inject({
    method: 'POST',
    url: `/v1/assets/${assetId}/rights-attestation`,
    headers: auth(token, workspaceId),
    payload: { statementId: RIGHTS_STATEMENT.id, statementVersion: version, localeShown: 'vi', accepted: true },
  });
}

describe('Q-20 — phien ban cua noi dung xac nhan quyen', () => {
  it('API cong bo dung phien ban dang hieu luc va khoa dich cua no', async () => {
    const { app, token, workspaceId, assetId } = await assetReadyToSign();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/assets/${assetId}/rights-attestation`,
      headers: auth(token, workspaceId),
    });
    expect(res.statusCode).toBe(200);
    const statement = res.json().data.statement;
    expect(statement.version).toBe(RIGHTS_STATEMENT.version);
    expect(statement.id).toBe(RIGHTS_STATEMENT.id);
    expect(statement.i18nKey).toBe('rights.attestation.v2.statement');
    expect(statement.validityDays).toBe(365);
    await app.close();
  });

  it('ky bang phien ban CU => stale, khong duoc chap nhan', async () => {
    const { app, token, workspaceId, assetId } = await assetReadyToSign();
    const res = await sign(app, token, workspaceId, assetId, RIGHTS_STATEMENT.version - 1);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('MCP_POLICY_RIGHTS_ATTESTATION_STALE');
    await app.close();
  });

  it('ky bang phien ban hien hanh => duoc chap nhan va luu dung so phien ban', async () => {
    const { app, ctx, token, workspaceId, assetId } = await assetReadyToSign();
    const res = await sign(app, token, workspaceId, assetId, RIGHTS_STATEMENT.version);
    expect(res.statusCode).toBe(200);
    expect(res.json().data.statementVersion).toBe(RIGHTS_STATEMENT.version);

    // Ho so luu lai phai mang DU bang chung: van ban nao, ngon ngu nao, ai ky.
    const stored = await ctx.persistence.attestations.findLatest(workspaceId, assetId);
    expect(stored?.statementId).toBe(RIGHTS_STATEMENT.id);
    expect(stored?.statementVersion).toBe(RIGHTS_STATEMENT.version);
    expect(stored?.localeShown).toBe('vi');
    expect(stored?.attestationType).toBe('user_self_declared');
    await app.close();
  });

  it('loi khai ky ban cu khong cho tao job (Rights Guard khong bi bo qua)', async () => {
    const { app, token, workspaceId, assetId } = await assetReadyToSign();
    await sign(app, token, workspaceId, assetId, RIGHTS_STATEMENT.version - 1);
    const job = await createJob(app, token, workspaceId, assetId);
    expect(job.status).toBe(403);
    expect(job.body.error.code).toBe('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    await app.close();
  });

  it('ho so lich su KHONG bi tu dong cap nhat sang phien ban moi', async () => {
    const { app, ctx, token, workspaceId, assetId } = await assetReadyToSign();
    await sign(app, token, workspaceId, assetId, RIGHTS_STATEMENT.version);
    const before = await ctx.persistence.attestations.findLatest(workspaceId, assetId);

    // Doc lai nhieu lan, goi them route khac: ban ghi cu phai y nguyen.
    await app.inject({ method: 'GET', url: `/v1/assets/${assetId}`, headers: auth(token, workspaceId) });
    await app.inject({
      method: 'GET',
      url: `/v1/assets/${assetId}/rights-attestation`,
      headers: auth(token, workspaceId),
    });
    const after = await ctx.persistence.attestations.findLatest(workspaceId, assetId);
    expect(after).toEqual(before);
    await app.close();
  });

  it('ky lai bang ban hien hanh tao BAN GHI MOI, khong ghi de ban cu (append-only)', async () => {
    const { app, ctx, token, workspaceId, assetId } = await assetReadyToSign();
    const first = await sign(app, token, workspaceId, assetId, RIGHTS_STATEMENT.version);
    const second = await sign(app, token, workspaceId, assetId, RIGHTS_STATEMENT.version);
    expect(first.json().data.id).not.toBe(second.json().data.id);
    const latest = await ctx.persistence.attestations.findLatest(workspaceId, assetId);
    expect(latest?.id).toBe(second.json().data.id);
    await app.close();
  });
});
