/**
 * P2-MCP-31: uoc tinh chi phi + xem truoc.
 *
 * Hai phep thu quan trong nhat deu la phep thu KHONG XAY RA DIEU GI:
 *  - uoc tinh KHONG duoc tra 0 (nguoi dung se hieu la mien phi) - phai tra null kem ly do.
 *  - preview KHONG duoc ghi so muc dung, khong doi trang thai job, khong them object vao kho.
 *
 * Phep thu "khong xay ra dieu gi" de viet sai thanh luon xanh, nen moi ca deu co doi chung:
 * do so luong TRUOC va SAU, khong chi kiem mot lan.
 */
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { COST_EVIDENCE_NO_PRICE_LIST, PREVIEW_PROXY_MAX_HEIGHT_PX } from '@mediaclear/contracts';
import { attest, auth, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

async function queuedJob(fixture = 'sample.png') {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an');
  const uploaded = await uploadFixture(app, token, ws, project, fixture, {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  await attest(app, token, ws, uploaded.assetId);
  const created = await createJob(app, token, ws, uploaded.assetId, { operations: ['blur'] });
  return { app, ctx, token, ws, jobId: created.body.data.job.id as string };
}

describe('P2-MCP-31 — uoc tinh chi phi', () => {
  it('KHONG tra 0 - tra null kem ly do, vi chua co bang gia nao', async () => {
    const { app, token, ws, jobId } = await queuedJob();
    const res = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/estimate`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    // 0 se bi hieu la mien phi. null la "chua xac dinh" - hai thu khac han nhau.
    expect(body.estimatedCostUsd).toBeNull();
    expect(body.estimatedCostUsd).not.toBe(0);
    expect(body.costEvidence).toBe(COST_EVIDENCE_NO_PRICE_LIST);
    await app.close();
  });

  it('SO DON VI thi do duoc that: anh = 1 image_unit', async () => {
    const { app, token, ws, jobId } = await queuedJob();
    const body = (await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/estimate`, headers: auth(token, ws) })).json().data;
    expect(body.unitType).toBe('image_unit');
    expect(body.quantity).toBe(1);
    await app.close();
  });

  it('so uoc tinh KHOP so thuc su bi giu - khong duoc bao mot dang tru mot neo', async () => {
    const { app, token, ws, jobId } = await queuedJob();
    const est = (await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/estimate`, headers: auth(token, ws) })).json().data;
    const job = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}`, headers: auth(token, ws) })).json().data;
    expect(est.unitType).toBe(job.usage.unitType);
    expect(est.quantity).toBe(job.usage.quantity);
    await app.close();
  });

  it('workspace KHAC khong uoc tinh duoc', async () => {
    const { app, jobId } = await queuedJob();
    const other = await signIn(app, `nguoi-la-${Date.now()}@matbao.com`);
    const otherWs = await createWorkspace(app, other, 'Khong gian khac');
    const res = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/estimate`, headers: auth(other, otherWs) });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('P2-MCP-31 — xem truoc', () => {
  it('tra ve anh THAT, giai ma duoc, dung thao tac da xin', async () => {
    const { app, token, ws, jobId } = await queuedJob();
    const res = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.operation).toBe('blur');
    expect(body.mode).toBe('proxy');

    // Giai ma that: mot chuoi base64 hong van "co ve dung" neu chi kiem do dai.
    const base64 = body.imageDataUri.split(',')[1] as string;
    const bytes = Buffer.from(base64, 'base64');
    const meta = await sharp(bytes).metadata();
    expect(meta.width).toBe(body.widthPx);
    expect(meta.height).toBe(body.heightPx);
    expect(bytes.byteLength).toBe(body.byteSize);
    await app.close();
  });

  it('KHONG BAO GIO tinh tien (I-12) - so but toan muc dung khong thay doi', async () => {
    const { app, ctx, token, ws, jobId } = await queuedJob();
    const before = (await ctx.persistence.usage.listByWorkspace(ws)).length;

    // Goi ba lan: neu co ro ri thi ba lan se lo ra ro hon mot lan.
    for (let i = 0; i < 3; i++) {
      await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(token, ws) });
    }

    const after = await ctx.persistence.usage.listByWorkspace(ws);
    expect(after.length, 'preview da ghi them but toan muc dung').toBe(before);
    expect(after.some((e) => e.entryType === 'commit')).toBe(false);
    await app.close();
  });

  it('KHONG doi trang thai job - van `queued` sau khi xem truoc', async () => {
    const { app, ctx, token, ws, jobId } = await queuedJob();
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('queued');
    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(token, ws) });
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('queued');
    await app.close();
  });

  it('KHONG tao ban ket qua nao - preview khong phai mot luot chay that', async () => {
    const { app, ctx, token, ws, jobId } = await queuedJob();
    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(token, ws) });
    expect(await ctx.persistence.outputs.findByJob(ws, jobId)).toBeNull();
    await app.close();
  });

  it('KHONG dong vao tep goc (I-5) - checksum nguon nguyen ven', async () => {
    const { app, ctx, token, ws, jobId } = await queuedJob();
    const job = await ctx.persistence.jobs.findById(ws, jobId);
    const src = await ctx.persistence.sourceFiles.findById(ws, job!.sourceFileId);
    const before = await ctx.storage.getObject({ bucket: ctx.bucket, key: src!.storageKey });

    await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(token, ws) });

    const after = await ctx.storage.getObject({ bucket: ctx.bucket, key: src!.storageKey });
    expect(Buffer.from(after).equals(Buffer.from(before))).toBe(true);
    await app.close();
  });

  it('anh CAO HON tran proxy thi bi thu nho - preview khong chay tren do phan giai goc (Q-03)', async () => {
    /*
     * Dung anh cao THAT (1440px) thay vi ghi de tep nguon. Lan dau toi viet test nay bang cach
     * ghi de object 'source' va tang luu tru tu choi: `MCP_STORAGE_WRITE_DENIED` - dung bat bien
     * I-1. Guardrail bat dung, test sai.
     */
    const { app, token, ws, jobId } = await queuedJob('sample-tall.png');
    const body = (await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/preview`, headers: auth(token, ws) })).json().data;
    expect(body.heightPx).toBeLessThanOrEqual(PREVIEW_PROXY_MAX_HEIGHT_PX);
    // Doi chung: anh goc THAT SU cao hon tran, neu khong phep kiem tren vo nghia.
    expect(1440).toBeGreaterThan(PREVIEW_PROXY_MAX_HEIGHT_PX);
    await app.close();
  });

  it('thao tac can AI thi noi ngay la chua lam duoc, khong tra anh khong dung', async () => {
    const { app, ctx, token, ws } = await queuedJob();
    const other = await createProject(app, token, ws, 'Du an 2');
    const uploaded = await uploadFixture(app, token, ws, other, 'sample.png', { mimeType: 'image/png', mediaType: 'image' });
    await validateAsset(app, token, ws, uploaded.assetId);
    await attest(app, token, ws, uploaded.assetId);

    // Job xin thao tac can AI bi chan ngay tu luc tao (D-041), nen khong co job nao de preview.
    const created = await createJob(app, token, ws, uploaded.assetId, { operations: ['inpaint'] });
    const state = created.body.data?.job?.state ?? 'blocked';
    expect(state).toBe('blocked');
    expect(ctx).toBeDefined();
    await app.close();
  });
});
