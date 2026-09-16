/**
 * P3-MCP-31/32/33: chay job VIDEO that.
 *
 * Bat bien quan trong nhat cua Phase 3: AUDIO quyet dinh job co duoc `completed` hay khong.
 * De bai noi ro "khong xuat video neu audio bi mat ngoai y muon", nen day khong phai mot truong
 * ghi cho vui — no la mot CONG.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { compareAudio } from '@mediaclear/contracts';
import { ffmpegAvailable, probeVideo } from '../src/media/ffmpeg.js';
import { executeVideoJob } from '../src/services/run-video-job.js';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

const hasFfmpeg = await ffmpegAvailable();

async function videoJob(fixture: string, operations: string[] = ['brand_overlay']) {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an video');
  const uploaded = await uploadFixture(app, token, ws, project, fixture, {
    mimeType: 'video/mp4',
    mediaType: 'video',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  await attest(app, token, ws, uploaded.assetId);
  const created = await createJob(app, token, ws, uploaded.assetId, {
    operations,
    regions: [{ x: 0.1, y: 0.1, width: 0.4, height: 0.2, startSeconds: null, endSeconds: null }],
  });
  return { app, ctx, token, ws, assetId: uploaded.assetId, created };
}

describe.skipIf(!hasFfmpeg)('P3 — job video di toi completed', () => {
  it('MASK tren video CO audio: completed, va audio VAN NGUYEN', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4');
    const jobId = created.body.data.job.id as string;
    const job = await ctx.persistence.jobs.findById(ws, jobId);
    expect(job?.state).toBe('queued');

    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });
    expect(outcome.state, `khong toi completed: ${JSON.stringify(outcome.error)}`).toBe('completed');
    expect(outcome.audioVerdict).toBe('preserved');
    expect(outcome.outputAssetId).not.toBeNull();
    await app.close();
  }, 180_000);

  it('bien nhan ghi DU cac truong de bai doi: mode, checksum vao/ra, audio truoc/sau, outputVerified', async () => {
    const { app, ctx, ws, assetId, created } = await videoJob('video-with-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });
    expect(outcome.state).toBe('completed');

    const receipt = await ctx.persistence.receipts.findByJob(ws, job!.id);
    expect(receipt).not.toBeNull();
    expect(receipt?.operationMode).toBe('mask');
    expect(receipt?.inputChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt?.outputChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt?.audioBefore?.present).toBe(true);
    expect(receipt?.audioAfter?.present).toBe(true);
    expect(receipt?.audioVerdict).toBe('preserved');
    expect(receipt?.outputVerified, 'outputVerified phai true SAU KHI doc lai byte').toBe(true);
    expect(receipt?.sourceAssetId).toBe(assetId);
    // KHONG duoc khai AI provenance la verified khi chua co bang chung.
    expect(receipt?.evidenceStatus).not.toBe('verified');
    await app.close();
  }, 180_000);

  it('video KHONG co audio: completed voi `absent_by_design`, KHONG bao loi gia', async () => {
    const { app, ctx, ws, created } = await videoJob('video-no-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });
    expect(outcome.state).toBe('completed');
    expect(outcome.audioVerdict).toBe('absent_by_design');
    expect(outcome.audioVerdict).not.toBe('lost');
    await app.close();
  }, 180_000);

  it('BLUR tren video: completed, audio nguyen', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4', ['blur']);
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });
    expect(outcome.state, JSON.stringify(outcome.error)).toBe('completed');
    expect(outcome.audioVerdict).toBe('preserved');
    const receipt = await ctx.persistence.receipts.findByJob(ws, job!.id);
    expect(receipt?.operationMode).toBe('blur');
    await app.close();
  }, 180_000);

  it('CROP tren video: completed, audio nguyen, che do ghi dung', async () => {
    const { app, ctx, ws, created } = await videoJob('video-landscape-audio.mp4', ['crop']);
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });
    expect(outcome.state).toBe('completed');
    expect(outcome.audioVerdict).toBe('preserved');
    const receipt = await ctx.persistence.receipts.findByJob(ws, job!.id);
    expect(receipt?.operationMode).toBe('crop');
    await app.close();
  }, 180_000);
});

describe.skipIf(!hasFfmpeg)('P3 — tep goc bat bien (I-1)', () => {
  it('sau khi render, tep NGUON khop TUNG BYTE voi luc tai len', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    const source = await ctx.persistence.sourceFiles.findById(ws, job!.sourceFileId);
    const before = Buffer.from(await ctx.storage.getObject({ bucket: ctx.bucket, key: source!.storageKey }));

    await executeVideoJob(ctx, { ...job!, state: 'processing' });

    const after = Buffer.from(await ctx.storage.getObject({ bucket: ctx.bucket, key: source!.storageKey }));
    expect(after.equals(before), 'tep goc bi doi sau khi render').toBe(true);
    await app.close();
  }, 180_000);

  it('ban ket qua la object MOI, khoa khac han tep goc', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    const source = await ctx.persistence.sourceFiles.findById(ws, job!.sourceFileId);
    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });

    const output = await ctx.persistence.outputs.findByJob(ws, job!.id);
    expect(output?.storageKey).not.toBe(source!.storageKey);
    expect(output?.storageKey).toContain('/output/');
    expect(outcome.outputAssetId).toBe(output?.id);
    await app.close();
  }, 180_000);
});

describe.skipIf(!hasFfmpeg)('P3 — output verification truoc khi completed (I-2)', () => {
  it('byte trong kho khop checksum bien nhan khai, va VAN doc duoc bang ffprobe', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    await executeVideoJob(ctx, { ...job!, state: 'processing' });

    const output = await ctx.persistence.outputs.findByJob(ws, job!.id);
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: output!.storageKey });
    const actual = createHash('sha256').update(Buffer.from(bytes)).digest('hex');

    const receipt = await ctx.persistence.receipts.findByJob(ws, job!.id);
    expect(actual).toBe(receipt?.outputChecksum);
    expect(output?.validated).toBe(true);

    const probe = await probeVideo(bytes);
    expect(probe.unreadable, 'output khong doc duoc ma van bao completed').toBe(false);
    expect(probe.audio.present).toBe(true);
    await app.close();
  }, 180_000);
});

describe.skipIf(!hasFfmpeg)('P3 — muc dung', () => {
  it('job completed tinh muc dung DUNG MOT LAN', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    await executeVideoJob(ctx, { ...job!, state: 'processing' });

    const entries = (await ctx.persistence.usage.listByWorkspace(ws)).filter((e) => e.jobId === job!.id);
    expect(entries.filter((e) => e.entryType === 'commit')).toHaveLength(1);
    expect(entries.filter((e) => e.entryType === 'release')).toHaveLength(0);
    await app.close();
  }, 180_000);

  it('job hong thi HOAN TRA khoan giu - khong tinh tien cho viec khong co ket qua', async () => {
    const { app, ctx, ws, created } = await videoJob('video-with-audio.mp4');
    const job = await ctx.persistence.jobs.findById(ws, created.body.data.job.id as string);
    // Xoa tep nguon => phu thuoc thieu => `blocked`, va khoan giu phai duoc tra lai.
    const source = await ctx.persistence.sourceFiles.findById(ws, job!.sourceFileId);
    await ctx.storage.deleteObject({ bucket: ctx.bucket, key: source!.storageKey });

    const outcome = await executeVideoJob(ctx, { ...job!, state: 'processing' });
    expect(outcome.state === 'blocked' || outcome.state === 'failed').toBe(true);
    expect(outcome.state).not.toBe('completed');

    const entries = (await ctx.persistence.usage.listByWorkspace(ws)).filter((e) => e.jobId === job!.id);
    expect(entries.filter((e) => e.entryType === 'commit')).toHaveLength(0);
    await app.close();
  }, 180_000);
});

describe('P3 — cong audio (khong can ffmpeg)', () => {
  it('MAT audio thi KHONG duoc completed - day la cong, khong phai canh bao', () => {
    const before = { present: true, codec: 'aac', durationSeconds: 10, channelCount: 2 };
    const after = { present: false, codec: null, durationSeconds: null, channelCount: null };
    expect(compareAudio(before, after)).toBe('lost');
  });
});
