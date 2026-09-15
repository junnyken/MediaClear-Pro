/**
 * MCP-14: ranh gioi tao job + usage ledger. Chay HTTP that.
 * Phase 1 khong co provider production => khong job nao duoc 'completed'.
 */
import { describe, expect, it } from 'vitest';
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

async function readyAsset(fixture = 'sample.png', mimeType = 'image/png', mediaType: 'image' | 'video' = 'image') {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, 'owner@matbao.com');
  const workspaceId = await createWorkspace(app, token, 'Studio');
  const projectId = await createProject(app, token, workspaceId, 'Chien dich');
  const uploaded = await uploadFixture(app, token, workspaceId, projectId, fixture, { mimeType, mediaType });
  return { app, ctx, token, workspaceId, projectId, assetId: uploaded.assetId };
}

describe('MCP-14 cong tao job', () => {
  it('chua validate => job bi chan, ghi ban ghi blocked, KHONG reserve usage', async () => {
    const { app, ctx, token, workspaceId, assetId } = await readyAsset();
    const result = await createJob(app, token, workspaceId, assetId);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('MCP_VAL_NOT_VALIDATED');

    const jobId = result.body.error.params.jobId as string;
    const job = await ctx.persistence.jobs.findById(workspaceId, jobId);
    expect(job?.state).toBe('blocked');
    expect(job?.blockReasonKind).toBe('validation_block');
    expect(await ctx.persistence.usage.listByWorkspace(workspaceId)).toHaveLength(0);
    await app.close();
  });

  it('validate that bai => job bi chan bang dung ma loi cua validation', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset('video-600s.mp4', 'video/mp4', 'video');
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    const result = await createJob(app, token, workspaceId, assetId);
    expect(result.body.error.code).toBe('MCP_VAL_DURATION_EXCEEDED');
    await app.close();
  });

  it('thieu xac nhan quyen => bi chan, khong co job nao chay (R-6)', async () => {
    const { app, ctx, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    const result = await createJob(app, token, workspaceId, assetId);
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    const job = await ctx.persistence.jobs.findById(workspaceId, result.body.error.params.jobId as string);
    expect(job?.state).toBe('blocked');
    expect(job?.blockReasonKind).toBe('policy_block');
    expect(await ctx.persistence.usage.listByWorkspace(workspaceId)).toHaveLength(0);
    await app.close();
  });

  it('xac nhan quyen cua asset khac KHONG cuu duoc asset nay (I-5)', async () => {
    const { app, token, workspaceId, projectId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    const other = await uploadFixture(app, token, workspaceId, projectId, 'sample.jpg', {
      mimeType: 'image/jpeg',
      mediaType: 'image',
    });
    await validateAsset(app, token, workspaceId, other.assetId);
    await attest(app, token, workspaceId, other.assetId);

    const result = await createJob(app, token, workspaceId, assetId);
    expect(result.body.error.code).toBe('MCP_POLICY_RIGHTS_ATTESTATION_MISSING');
    await app.close();
  });

  it('du dieu kien => job o trang thai queued, usage duoc giu, KHONG bao thanh cong', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    const result = await createJob(app, token, workspaceId, assetId);

    expect(result.status).toBe(200);
    expect(result.body.data.job.state).toBe('queued');
    expect(result.body.data.productionProcessingEnabled).toBe(false);
    expect(result.body.data.providerCapability).toBe('unknown');
    expect(result.body.data.usage).toMatchObject({ unitType: 'image_unit', quantity: 1, state: 'reserved' });
    expect(JSON.stringify(result.body)).not.toContain('completed');
    await app.close();
  });

  it('video 599s: usage lam tron LEN theo phut = 10 don vi', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset('video-599s.mp4', 'video/mp4', 'video');
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    const result = await createJob(app, token, workspaceId, assetId, { operations: ['blur'] });
    expect(result.body.data.usage).toMatchObject({ unitType: 'video_minute_unit', quantity: 10 });
    await app.close();
  });

  it('gui lai cung idempotencyKey => cung jobId, ledger khong tang (I-8)', async () => {
    const { app, ctx, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);

    const first = await createJob(app, token, workspaceId, assetId, { idempotencyKey: 'khoa-lap-lai' });
    const second = await createJob(app, token, workspaceId, assetId, { idempotencyKey: 'khoa-lap-lai' });
    expect(second.status).toBe(200);
    expect(second.body.data.job.id).toBe(first.body.data.job.id);
    expect(await ctx.persistence.usage.listByWorkspace(workspaceId)).toHaveLength(1);
    await app.close();
  });

  it('cung khoa nhung noi dung khac => bao conflict ro rang', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    await createJob(app, token, workspaceId, assetId, { idempotencyKey: 'k1', operations: ['blur'] });
    const clash = await createJob(app, token, workspaceId, assetId, {
      idempotencyKey: 'k1',
      operations: ['visible_logo_cleanup'],
    });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('MCP_JOB_IDEMPOTENCY_CONFLICT');
    await app.close();
  });

  it('viewer khong tao duoc job va khong sinh ban ghi job nao (I-6)', async () => {
    const { app, ctx, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    const viewerToken = await signIn(app, 'viewer@matbao.com');
    await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/members`,
      headers: auth(token, workspaceId),
      payload: { email: 'viewer@matbao.com', role: 'viewer' },
    });

    const result = await createJob(app, viewerToken, workspaceId, assetId);
    expect(result.status).toBe(403);
    expect(result.body.error.code).toBe('MCP_AUTHZ_INSUFFICIENT_ROLE');
    expect(result.body.error.params?.jobId).toBeUndefined();
    expect(await ctx.persistence.usage.listByWorkspace(workspaceId)).toHaveLength(0);
    await app.close();
  });

  it('job blocked la terminal: khong huy, khong chay lai, chi tao job MOI (I-4)', async () => {
    const { app, ctx, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    const blockedAttempt = await createJob(app, token, workspaceId, assetId, { idempotencyKey: 'lan-1' });
    const blockedJobId = blockedAttempt.body.error.params.jobId as string;

    // Khong co duong nao dua job blocked ve processing: huy cung bi tu choi.
    const cancel = await app.inject({
      method: 'POST',
      url: `/v1/jobs/${blockedJobId}/cancel`,
      headers: auth(token, workspaceId),
    });
    expect(cancel.statusCode).toBe(409);
    expect(cancel.json().error.code).toBe('MCP_STATE_TERMINAL');

    // Go nguyen nhan chan roi gui lai => job MOI, job cu giu nguyen blocked.
    await attest(app, token, workspaceId, assetId);
    const retry = await createJob(app, token, workspaceId, assetId, { idempotencyKey: 'lan-2' });
    expect(retry.status).toBe(200);
    expect(retry.body.data.job.id).not.toBe(blockedJobId);
    const oldJob = await ctx.persistence.jobs.findById(workspaceId, blockedJobId);
    expect(oldJob?.state).toBe('blocked');
    await app.close();
  });

  it('huy job queued => giai phong reservation, usage con 0 dang giu', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    const job = await createJob(app, token, workspaceId, assetId);
    const jobId = job.body.data.job.id as string;

    const cancel = await app.inject({
      method: 'POST',
      url: `/v1/jobs/${jobId}/cancel`,
      headers: auth(token, workspaceId),
    });
    expect(cancel.statusCode).toBe(200);
    expect(cancel.json().data.job.state).toBe('cancelled');
    expect(cancel.json().data.usage.state).toBe('released');

    const usage = (await app.inject({ method: 'GET', url: '/v1/usage', headers: auth(token, workspaceId) })).json();
    expect(usage.data.imageUnitsReserved).toBe(0);
    expect(usage.data.imageUnitsCommitted).toBe(0);
    await app.close();
  });

  it('usage summary: da giu KHONG duoc gop vao da tinh (chua co output verified)', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    await createJob(app, token, workspaceId, assetId);
    const usage = (await app.inject({ method: 'GET', url: '/v1/usage', headers: auth(token, workspaceId) })).json();
    expect(usage.data.imageUnitsReserved).toBe(1);
    expect(usage.data.imageUnitsCommitted).toBe(0);
    await app.close();
  });

  it('job cua workspace khac khong doc duoc', async () => {
    const { app, token, workspaceId, assetId } = await readyAsset();
    await validateAsset(app, token, workspaceId, assetId);
    await attest(app, token, workspaceId, assetId);
    const job = await createJob(app, token, workspaceId, assetId);
    const intruder = await signIn(app, 'ke-la@matbao.com');
    const wsIntruder = await createWorkspace(app, intruder, 'Cua ke la');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${job.body.data.job.id}`,
      headers: auth(intruder, wsIntruder),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
