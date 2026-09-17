/**
 * P2-MCP-29: lay ban ket qua ve.
 *
 * Phep thu quan trong nhat: byte TAI VE PHAI khop checksum he thong khai. Neu chi kiem
 * "co tra ve mot URL" thi mot URL tro sai tep van lam test xanh - va do dung la loai loi
 * khien nguoi dung nhan ve tep cua nguoi khac.
 *
 * Doi chung am bat buoc: truoc muc nay KHONG duong nao dan toi ban ket qua. Test
 * "download-url cua asset tra tep NGUON chu khong phai ket qua" giu cho su that do khong
 * bi hieu nham lan nua.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { JobWorker } from '../src/worker/job-worker.js';
import { attest, auth, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

async function completedJob() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an');
  const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  await attest(app, token, ws, uploaded.assetId);
  const created = await createJob(app, token, ws, uploaded.assetId, { operations: ['blur'] });
  const jobId = created.body.data.job.id as string;

  const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 });
  await worker.start();
  return { app, ctx, token, ws, jobId, assetId: uploaded.assetId };
}

describe('P2-MCP-29 — lay ban ket qua ve', () => {
  it('job da xong thi doc duoc thong tin ban ket qua', async () => {
    const { app, token, ws, jobId } = await completedJob();
    const res = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.outputAssetId).toMatch(/^out_/);
    expect(body.byteSize).toBeGreaterThan(0);
    expect(body.checksumSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(body.validated).toBe(true);
    await app.close();
  });

  it('BYTE TAI VE khop checksum he thong khai - khong phai chi "co URL"', async () => {
    const { app, token, ws, jobId } = await completedJob();
    const meta = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output`, headers: auth(token, ws) })).json().data;

    const signed = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}/output/download-url`,
      headers: auth(token, ws),
    });
    expect(signed.statusCode).toBe(200);
    const download = signed.json().data;
    expect(download.checksumSha256).toBe(meta.checksumSha256);

    // Tai THAT qua duong dan da ky, roi bam lai byte nhan duoc.
    const path = new URL(download.url).pathname;
    const file = await app.inject({ method: 'GET', url: path });
    expect(file.statusCode).toBe(200);
    const bytes = file.rawPayload;
    expect(bytes.byteLength).toBe(meta.byteSize);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(meta.checksumSha256);
    await app.close();
  });

  it('DOI CHUNG AM: download-url cua ASSET van tra tep NGUON, khong phai ban ket qua', async () => {
    const { app, token, ws, jobId, assetId } = await completedJob();
    const out = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output`, headers: auth(token, ws) })).json().data;

    const assetUrl = (
      await app.inject({ method: 'GET', url: `/v1/assets/${assetId}/download-url`, headers: auth(token, ws) })
    ).json().data;
    const sourceBytes = (await app.inject({ method: 'GET', url: new URL(assetUrl.url).pathname })).rawPayload;

    // Hai tep KHAC nhau. Day la ly do ton tai cua route moi.
    expect(createHash('sha256').update(sourceBytes).digest('hex')).not.toBe(out.checksumSha256);
    await app.close();
  });

  it('job CHUA xong thi khong co ban ket qua - 404, khong tra tep nua vo', async () => {
    const { app, ctx } = await makeApp();
    const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
    const ws = await createWorkspace(app, token, 'Studio');
    const project = await createProject(app, token, ws, 'Du an');
    const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, token, ws, uploaded.assetId);
    await attest(app, token, ws, uploaded.assetId);
    const created = await createJob(app, token, ws, uploaded.assetId, { operations: ['blur'] });
    const jobId = created.body.data.job.id as string;
    expect((await ctx.persistence.jobs.findById(ws, jobId))?.state).toBe('queued');

    const res = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('CHUA do lai byte (validated = false) thi TU CHOI phat URL - bat bien I-2', async () => {
    /*
     * Dung mot job KHAC, chua chay, roi dat vao do mot ban ket qua chua kiem chung. Khong
     * sua ban ket qua cua job da xong: rang buoc UNIQUE (job_id) khong cho tao ban thu hai,
     * va do chinh la rang buoc dang duoc bao ve.
     */
    const { app, ctx, token, ws, jobId } = await completedJob();
    const done = await ctx.persistence.outputs.findByJob(ws, jobId);
    expect(done?.validated).toBe(true);

    const other = await ctx.persistence.jobs.findById(ws, jobId);
    const pendingJobId = `job_chua_kiem_chung_${Date.now()}`;
    await ctx.persistence.jobs.create({ ...other!, id: pendingJobId, state: 'queued', outputAssetId: null });
    await ctx.persistence.outputs.create({
      ...done!,
      id: `out_chua_kiem_chung_${Date.now()}`,
      jobId: pendingJobId,
      storageKey: `${done!.storageKey}.chua-kiem-chung`,
      validated: false,
    });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${pendingJobId}/output/download-url`,
      headers: auth(token, ws),
    });
    expect(res.json().error.code).toBe('MCP_STATE_OUTPUT_NOT_VERIFIED');
    await app.close();
  });

  it('workspace KHAC khong doc duoc ban ket qua, va khong lo ra la no co ton tai', async () => {
    const { app, ws, jobId } = await completedJob();
    const otherToken = await signIn(app, `nguoi-la-${Date.now()}@matbao.com`);
    const otherWs = await createWorkspace(app, otherToken, 'Khong gian khac');

    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}/output`,
      headers: auth(otherToken, otherWs),
    });
    expect(res.statusCode).toBe(404);

    // Cung ma loi voi job khong ton tai => khong do duoc su ton tai.
    const ghost = await app.inject({
      method: 'GET',
      url: '/v1/jobs/job_khong_co_that/output',
      headers: auth(otherToken, otherWs),
    });
    expect(ghost.json().error.code).toBe(res.json().error.code);
    expect(ws).not.toBe(otherWs);
    await app.close();
  });

  it('khong co phien dang nhap thi khong tai duoc', async () => {
    const { app, jobId } = await completedJob();
    const res = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output/download-url` });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it('phat URL tai ve co GHI DAU VET, va dau vet tro dung ban ket qua', async () => {
    const { app, ctx, token, ws, jobId } = await completedJob();
    await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output/download-url`, headers: auth(token, ws) });

    const events = await ctx.persistence.audit.listByWorkspace(ws, { limit: 50 });
    const issued = events.items.find((e) => e.eventType === 'output_download_url_issued');
    expect(issued, 'thieu dau vet phat URL tai ve').toBeDefined();
    expect(issued?.subjectType).toBe('output');
    expect(issued?.subjectId).toMatch(/^out_/);
    await app.close();
  });
});

describe('P2-MCP-33 — tai ve phai ra MOT TEP, khong phai mot tab', () => {
  it('co content-disposition attachment, ten tep hop ly chu khong phai chuoi ve', async () => {
    const { app, token, ws, jobId } = await completedJob();
    const dl = (
      await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output/download-url`, headers: auth(token, ws) })
    ).json().data;
    const file = await app.inject({ method: 'GET', url: new URL(dl.url).pathname });

    const disposition = file.headers['content-disposition'];
    expect(disposition, 'thieu content-disposition => trinh duyet mo tep trong tab').toBeDefined();
    expect(String(disposition)).toContain('attachment');
    // Ten tep phai la ten object, KHONG phai chuoi ve dai hang tram ky tu.
    expect(String(disposition)).toMatch(/filename="out_[0-9a-f]+\.png"/);
    await app.close();
  });
});

/**
 * `D-073` — cong chan chat luong (P4-MCP-44) phai song o MAY CHU.
 *
 * Lo nay tim thay bang bam tay tren Chrome, khong phai bang test: man hinh `/jobs/:id/frames`
 * khoa dung nut "Tai ve" khi cong noi `failed`, nhung goi thang `GET .../output/download-url`
 * van duoc 200 + URL da ky, va tai URL do ve duoc byte that. Toan bo test cua Phase 4 truoc do
 * deu xanh, vi khong test nao hoi cau "nguoi bo qua giao dien thi sao".
 *
 * Nen phep thu duoi day KHONG bam nut nao — no goi thang API, dung nhu ke muon lay tep se lam.
 */
describe('D-073 — job chua dat cong chat luong thi KHONG phat duoc URL tai ve', () => {
  async function jobVoiTrangThai(state: 'review_required' | 'failed' | 'completed') {
    const { app, ctx, token, ws, jobId } = await completedJob();
    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state, 'moc khoi dau phai la job da xong').toBe('completed');
    if (state !== 'completed') {
      await ctx.persistence.jobs.update({ ...job!, state, updatedAt: new Date().toISOString() });
    }
    return { app, ctx, token, ws, jobId };
  }

  it('DOI CHUNG DUONG: job `completed` van tai ve duoc — phep thu nay khong chan bua', async () => {
    const { app, token, ws, jobId } = await jobVoiTrangThai('completed');
    const res = await app.inject({
      method: 'GET', url: `/v1/jobs/${jobId}/output/download-url`, headers: auth(token, ws),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.url, 'doi chung duong hong => moi ket luan duoi deu vo nghia').toBeTruthy();
    await app.close();
  });

  for (const state of ['review_required', 'failed'] as const) {
    it(`job \`${state}\` (ban ket qua DA kiem byte) van bi tu choi phat URL`, async () => {
      const { app, ctx, token, ws, jobId } = await jobVoiTrangThai(state);

      // Ban ket qua that su ton tai va DA kiem chung — nen loi tra ve phai la ly do chat luong,
      // khong phai `MCP_STATE_OUTPUT_NOT_VERIFIED` hay 404.
      const output = await ctx.persistence.outputs.findByJob(ws, jobId);
      expect(output?.validated, 'moc thu sai: can mot ban ket qua DA kiem byte').toBe(true);

      const res = await app.inject({
        method: 'GET', url: `/v1/jobs/${jobId}/output/download-url`, headers: auth(token, ws),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('MCP_STATE_QUALITY_REVIEW_REQUIRED');
      expect(res.json().data, 'tu choi ma van kem URL thi cong chan vo dung').toBeUndefined();
      await app.close();
    });
  }

  it('bi tu choi thi KHONG duoc ghi dau vet "da phat URL tai ve"', async () => {
    const { app, ctx, token, ws, jobId } = await jobVoiTrangThai('failed');
    const truoc = (await ctx.persistence.audit.listByWorkspace(ws, { limit: 100 })).items
      .filter((e) => e.eventType === 'output_download_url_issued').length;

    await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/output/download-url`, headers: auth(token, ws) });

    const sau = (await ctx.persistence.audit.listByWorkspace(ws, { limit: 100 })).items
      .filter((e) => e.eventType === 'output_download_url_issued').length;
    expect(sau, 'ho so noi da phat URL trong khi thuc te tu choi').toBe(truoc);
    await app.close();
  });
});
