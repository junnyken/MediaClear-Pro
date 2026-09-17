/**
 * P2-MCP-30: do dau vet nguon goc va ghi bien nhan.
 *
 * Phep thu quan trong nhat KHONG phai "co bien nhan khong", ma la "bien nhan co noi dung SAI
 * khong". Cu the: he thong khong doc duoc C2PA, nen bien nhan PHAI noi 'unknown' ve dau vet AI
 * chu khong duoc dong dau 'verified' (D-044).
 *
 * Doi chung am bat buoc: mot anh CO EXIF that phai giu duoc EXIF qua duong xu ly. Neu dung anh
 * khong co metadata nao (fixture cu) thi phep kiem "co bao toan khong" hoan toan vo nghia.
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVISIBLE_WATERMARK_DISCLAIMER_KEY } from '@mediaclear/contracts';
import { JobWorker } from '../src/worker/job-worker.js';
import { probeProvenance, C2PA_LIMITATION_KEY, C2PA_PRESENCE_ONLY_KEY } from '../src/media/provenance-probe.js';
import { attest, auth, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset, FIXTURES } from './helpers.js';

async function runWith(fixture: string) {
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
  const jobId = created.body.data.job.id as string;
  const worker = new JobWorker(ctx, { maxCycles: 3, idleDelayMs: 1 });
  await worker.start();
  return { app, ctx, token, ws, jobId };
}

describe('P2-MCP-30 — bo do dau vet nguon goc', () => {
  it('DOC DUOC metadata that: anh co EXIF => present, anh khong co => absent', async () => {
    const withExif = readFileSync(join(FIXTURES, 'sample-with-exif.png'));
    const without = readFileSync(join(FIXTURES, 'sample.png'));
    expect((await probeProvenance(withExif, 'image')).originalMetadataPresence).toBe('present');
    expect((await probeProvenance(without, 'image')).originalMetadataPresence).toBe('absent');
  });

  /*
   * `Q-12` da dong (`D-069`): nay CO bo do that. Phep kiem nay doi lai theo su that moi, nhung
   * luat cu van nguyen ven — chi doi cho ap dung:
   *   - container duyet HET cho duoc  => duoc noi 'absent' ("da tim va khong thay");
   *   - container CHUA duyet het cho  => van phai la 'unknown' ("chua tim duoc het").
   */
  it('DO DUOC dau hieu AI: PNG khong co dau thi noi "absent", kem dung cau gioi han', async () => {
    const probe = await probeProvenance(readFileSync(join(FIXTURES, 'sample-with-exif.png')), 'image');
    expect(probe.aiProvenancePresence).toBe('absent');
    // Do duoc roi thi cau gioi han phai doi: "khong xac minh" chu khong con la "chua doc duoc".
    expect(probe.detectorLimitationNote).toBe(C2PA_PRESENCE_ONLY_KEY);
  });

  it('CHUA duyet het cho thi VAN phai la "unknown", khong duoc noi "absent" (D-044)', async () => {
    // WebM/Matroska: cau truc EBML, he thong chua duyet het cho dat dau hieu.
    const probe = await probeProvenance(readFileSync(join(FIXTURES, 'sample.webm')), 'video');
    expect(probe.aiProvenancePresence).toBe('unknown');
    expect(probe.detectorLimitationNote).toBe(C2PA_LIMITATION_KEY);
  });

  it('tep hong thi tra "unknown", khong ket luan la khong co metadata', async () => {
    const corrupt = readFileSync(join(FIXTURES, 'corrupt.png'));
    expect((await probeProvenance(corrupt, 'image')).originalMetadataPresence).toBe('unknown');
  });

  it('video: chua co duong doc metadata nao => "unknown", khong doan', async () => {
    const probe = await probeProvenance(readFileSync(join(FIXTURES, 'sample.mov')), 'video');
    expect(probe.originalMetadataPresence).toBe('unknown');
  });
});

describe('P2-MCP-30 — bien nhan', () => {
  it('job xong thi co bien nhan, kem CA HAI ban ghi do', async () => {
    const { app, token, ws, jobId } = await runWith('sample-with-exif.png');
    const res = await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/receipt`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.receipt.jobId).toBe(jobId);
    expect(body.receipt.operations).toEqual(['blur']);
    expect(body.receipt.invisibleWatermarkDisclaimerKey).toBe(INVISIBLE_WATERMARK_DISCLAIMER_KEY);
    // Ban ghi do phai tra cuu duoc THAT, khong chi la hai id tro vao hu khong.
    expect(body.provenanceBefore.id).toBe(body.receipt.provenanceBeforeId);
    expect(body.provenanceAfter.id).toBe(body.receipt.provenanceAfterId);
    await app.close();
  });

  /*
   * DAY LA THU `Q-12` MO RA.
   *
   * Truoc `D-069`, bien nhan LUON phai noi 'unknown' — vi phep do chua bao gio chay. Nay no chay
   * that, nen 'verified' tro thanh mot loi khai CO CO SO: he thong da tim dau hieu o truoc va sau,
   * va khong co gi bien mat.
   *
   * Nhung 'verified' o day chi noi ve MOT dieu: dau hieu khong bi mat. No KHONG noi dau hieu la
   * that (bo do khong kiem chu ky), va KHONG noi gi ve dau AN vo hinh — cau mien tru ve dau an
   * van phai di kem, va phep kiem duoi day doi dung dieu do.
   */
  it('do duoc that thi bien nhan DUOC khai "da kiem chung" — va van kem cau mien tru', async () => {
    const { app, token, ws, jobId } = await runWith('sample-with-exif.png');
    const body = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/receipt`, headers: auth(token, ws) })).json().data;

    expect(body.receipt.evidenceStatus).toBe('verified');
    expect(body.provenanceBefore.aiProvenancePresence).toBe('absent');
    expect(body.provenanceAfter.aiProvenancePresence).toBe('absent');
    // Gioi han phai duoc NOI RA, khong giau trong tai lieu.
    expect(body.provenanceBefore.limitationNote).toBe(C2PA_PRESENCE_ONLY_KEY);
    // Do duoc dau hieu C2PA KHONG co nghia la kiem soat duoc dau AN vo hinh.
    expect(body.receipt.invisibleWatermarkDisclaimerKey).toBe(INVISIBLE_WATERMARK_DISCLAIMER_KEY);
    await app.close();
  });

  it('EXIF THAT song sot qua duong xu ly - do tren byte da luu, khong phai tren bo nho', async () => {
    const { app, ctx, token, ws, jobId } = await runWith('sample-with-exif.png');
    const output = await ctx.persistence.outputs.findByJob(ws, jobId);
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: output!.storageKey });
    const meta = await sharp(Buffer.from(bytes)).metadata();
    expect(meta.exif, 'EXIF bi xoa mat khi xu ly').toBeDefined();
    expect((meta.exif?.length ?? 0)).toBeGreaterThan(0);

    const body = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/receipt`, headers: auth(token, ws) })).json().data;
    expect(body.provenanceBefore.originalMetadataPresence).toBe('present');
    expect(body.provenanceAfter.originalMetadataPresence).toBe('present');
    await app.close();
  });

  /*
   * HANH VI THAT, do duoc, khong phai loi test: `.withMetadata()` cua libvips THEM vao tep ket
   * qua mot ho so mau ICC (480 byte) va mot khoi EXIF (180 byte) ma tep goc KHONG HE CO.
   *
   * Nghia la voi mot anh khong co metadata nao, bien nhan se ghi truoc='absent', sau='present'.
   * Ca hai con so deu DUNG ve mat su that cua tung tep - va chenh lech giua chung chinh la
   * thong tin nguoi dung can biet: cong cu da them thu vao tep cua ho.
   *
   * Quan trong: `evidenceStatus` VAN la 'unknown', KHONG phai 'preserved' - he thong khong
   * nhan vo rang da bao toan mot thu von khong ton tai.
   */
  it('anh KHONG co metadata: cong cu TU THEM ho so mau vao ket qua - ghi dung ca hai dau', async () => {
    const { app, ctx, token, ws, jobId } = await runWith('sample.png');
    const body = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}/receipt`, headers: auth(token, ws) })).json().data;
    expect(body.provenanceBefore.originalMetadataPresence).toBe('absent');
    expect(body.provenanceAfter.originalMetadataPresence).toBe('present');
    /*
     * Tu `D-069`: dau hieu AI DO DUOC (khong co, truoc va sau), nen `evidenceStatus` nay la
     * 'verified' — co co so. Truoc do no la 'unknown' vi phep do chua tung chay.
     * Luu y: 'verified' noi ve DAU HIEU AI, khong noi rang metadata duoc bao toan — chinh test
     * nay vua ghi nhan cong cu TU THEM ho so mau vao ket qua.
     */
    expect(body.receipt.evidenceStatus).toBe('verified');

    // Ghim lai CHINH XAC thu duoc them vao, de lan sau no doi thi test do.
    const output = await ctx.persistence.outputs.findByJob(ws, jobId);
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: output!.storageKey });
    const meta = await sharp(Buffer.from(bytes)).metadata();
    expect((meta.icc?.length ?? 0), 'ho so mau ICC do cong cu them vao').toBeGreaterThan(0);
    await app.close();
  });

  it('job chua chay thi CHUA co bien nhan - 404, khong tra bien nhan rong', async () => {
    const { app } = await makeApp();
    const token = await signIn(app, `owner-${Date.now()}@matbao.com`);
    const ws = await createWorkspace(app, token, 'Studio');
    const project = await createProject(app, token, ws, 'Du an');
    const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', { mimeType: 'image/png', mediaType: 'image' });
    await validateAsset(app, token, ws, uploaded.assetId);
    await attest(app, token, ws, uploaded.assetId);
    const created = await createJob(app, token, ws, uploaded.assetId, { operations: ['blur'] });

    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${created.body.data.job.id}/receipt`,
      headers: auth(token, ws),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('workspace KHAC khong doc duoc bien nhan', async () => {
    const { app, jobId } = await runWith('sample.png');
    const otherToken = await signIn(app, `nguoi-la-${Date.now()}@matbao.com`);
    const otherWs = await createWorkspace(app, otherToken, 'Khong gian khac');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/jobs/${jobId}/receipt`,
      headers: auth(otherToken, otherWs),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
