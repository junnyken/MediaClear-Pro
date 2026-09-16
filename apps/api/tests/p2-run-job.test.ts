/**
 * P2-MCP-27: job di toi `completed`.
 *
 * Day la phep thu quan trong nhat cua muc nay: tu Phase 1 toi truoc luc nay, KHONG job nao
 * toi duoc `completed` - khong provider, khong cho luu ket qua, khong duong chay.
 */
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';
import { runJob } from '../src/services/run-job.js';

async function readyJob(operations: string[] = ['blur']) {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, 'owner@matbao.com');
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an');
  const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  await attest(app, token, ws, uploaded.assetId);
  const created = await createJob(app, token, ws, uploaded.assetId, { operations });
  return { app, ctx, token, ws, uploaded, created };
}

describe('P2-MCP-27 — job di toi completed', () => {
  it('LAN DAU TIEN: job chay xong that su va co ket qua', async () => {
    const { app, ctx, ws, created } = await readyJob();
    expect(created.body.data.job.state).toBe('queued');

    const outcome = await runJob(ctx, ws, created.body.data.job.id);
    expect(outcome.error).toBeNull();
    expect(outcome.state).toBe('completed');
    expect(outcome.outputAssetId).not.toBeNull();

    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id);
    expect(job?.state).toBe('completed');
    expect(job?.outputAssetId).toBe(outcome.outputAssetId);
    await app.close();
  });

  it('ket qua DA duoc do lai va danh dau verified (bat bien I-2)', async () => {
    const { app, ctx, ws, created } = await readyJob();
    const outcome = await runJob(ctx, ws, created.body.data.job.id);
    const output = await ctx.persistence.outputs.findByJob(ws, created.body.data.job.id);
    expect(output?.id).toBe(outcome.outputAssetId);
    expect(output?.validated, 'chua do lai ma da bao xong').toBe(true);

    // Byte tren kho phai KHOP checksum da ghi - do lai o day, khong tin ban ghi.
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: output!.storageKey });
    expect(createHash('sha256').update(Buffer.from(bytes)).digest('hex')).toBe(output!.checksumSha256);
    expect(bytes.byteLength).toBe(output!.byteSize);
    await app.close();
  });

  it('TEP GOC con nguyen ven sau khi xu ly (bat bien I-1)', async () => {
    const { app, ctx, ws, uploaded, created } = await readyJob();
    const source = await ctx.persistence.sourceFiles.findById(ws, uploaded.sourceFileId);
    const before = await ctx.storage.getObject({ bucket: ctx.bucket, key: source!.storageKey });
    const beforeHash = createHash('sha256').update(Buffer.from(before)).digest('hex');

    await runJob(ctx, ws, created.body.data.job.id);

    const after = await ctx.storage.getObject({ bucket: ctx.bucket, key: source!.storageKey });
    expect(createHash('sha256').update(Buffer.from(after)).digest('hex')).toBe(beforeHash);
    await app.close();
  });

  it('ket qua la object KHAC tep goc, khoa nam o lop `output`', async () => {
    const { app, ctx, ws, uploaded, created } = await readyJob();
    await runJob(ctx, ws, created.body.data.job.id);
    const output = await ctx.persistence.outputs.findByJob(ws, created.body.data.job.id);
    const source = await ctx.persistence.sourceFiles.findById(ws, uploaded.sourceFileId);
    expect(output!.storageKey).not.toBe(source!.storageKey);
    expect(output!.storageKey).toContain('/output/');
    expect(output!.sourceAssetId).toBe(uploaded.assetId);
    await app.close();
  });

  it('muc dung duoc TINH dung MOT lan sau khi xong', async () => {
    const { app, ctx, ws, created } = await readyJob();
    await runJob(ctx, ws, created.body.data.job.id);
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'reserve')).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(1);
    await app.close();
  });

  it('chay LAI job da xong khong tinh tien lan hai', async () => {
    const { app, ctx, ws, created } = await readyJob();
    await runJob(ctx, ws, created.body.data.job.id);
    const again = await runJob(ctx, ws, created.body.data.job.id);
    // `completed` la terminal: khong chay lai duoc.
    expect(again.error?.code).toBe('MCP_STATE_INVALID_TRANSITION');
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(1);
    await app.close();
  });

  it('job xin thao tac CAN AI bi chan ngay luc tao, khong nam queued vinh vien', async () => {
    const { app, ctx } = await makeApp();
    const token = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, token, 'Studio');
    const project = await createProject(app, token, ws, 'Du an');
    const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, token, ws, uploaded.assetId);
    await attest(app, token, ws, uploaded.assetId);
    const res = await createJob(app, token, ws, uploaded.assetId, { operations: ['visible_logo_cleanup'] });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('MCP_PROVIDER_CAPABILITY_UNSUPPORTED');
    // Bi chan thi KHONG giu muc dung cua nguoi ta.
    expect(await ctx.persistence.usage.listByWorkspace(ws)).toHaveLength(0);
    await app.close();
  });

  it('/healthz VAN khai khong bat xu ly AI - provider tat dinh khong phai AI', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    const body = JSON.parse(res.body) as { productionAiProcessingEnabled: boolean; productionProviders: number };
    expect(body.productionProviders).toBeGreaterThan(0);
    expect(body.productionAiProcessingEnabled, 'khong co AI nao ma lai bao da bat').toBe(false);
    await app.close();
  });
});
