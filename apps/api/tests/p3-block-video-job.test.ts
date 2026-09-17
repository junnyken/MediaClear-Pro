/**
 * P3 (D-066): chan mot job video phai GHI DUOC vao co so du lieu.
 *
 * Loi that da xay ra: `blockJob` chi dat `reasonCode`, quen `blockReasonKind`. Rang buoc
 * `processing_jobs_blocked_requires_reason` (migration `0001`) doi CA HAI, nen tren PostgreSQL moi
 * lan chan job deu nem loi va job KET o `processing` VINH VIEN — nguoi dung thay "dang xu ly" mai
 * mai. Bo test cu khong bat duoc vi hai ly do cong lai:
 *   1. adapter in-memory KHONG ep rang buoc do (nay da ep);
 *   2. toan bo test video `skipIf(!hasFfmpeg)` — ma nhanh hong lai CHINH LA nhanh "thieu ffmpeg".
 *
 * Vi vay bo test nay KHONG phu thuoc ffmpeg that: no ep `provider.ready()` tra `false`, tuc la
 * dung canh "phu thuoc chua san sang" ma no can kiem.
 */
import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@mediaclear/contracts';
import { executeVideoJob } from '../src/services/run-video-job.js';
import { DeterministicVideoProvider } from '../src/providers/deterministic-video.js';
import { attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

async function videoJobQueued() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an video');
  const uploaded = await uploadFixture(app, token, ws, project, 'video-with-audio.mp4', {
    mimeType: 'video/mp4',
    mediaType: 'video',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  await attest(app, token, ws, uploaded.assetId);
  const created = await createJob(app, token, ws, uploaded.assetId, {
    operations: ['brand_overlay'],
    regions: [{ x: 0.1, y: 0.1, width: 0.4, height: 0.2, startSeconds: null, endSeconds: null }],
  });
  return { app, ctx, ws, jobId: created.body.data.job.id as string };
}

describe('P3 (D-066) — chan job video ghi duoc xuong du lieu', () => {
  it('thieu ffmpeg: job toi `blocked` voi DU ca hai truong ly do, khong ket o `processing`', async () => {
    const { app, ctx, ws, jobId } = await videoJobQueued();

    // Dung canh phu thuoc chua san sang, khong can go ffmpeg that khoi may.
    const provider = ctx.providers.get('deterministic-video');
    if (provider instanceof DeterministicVideoProvider) {
      provider.ready = async () => false;
    }

    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    expect(claimed?.id).toBe(jobId);

    const outcome = await executeVideoJob(ctx, claimed!);
    expect(outcome.state).toBe('blocked');
    expect(outcome.error?.code).toBe(ERROR_CODES.MCP_PROVIDER_UNAVAILABLE);

    const saved = await ctx.persistence.jobs.findById(ws, jobId);
    expect(saved?.state, 'job ket o `processing` => nguoi dung thay "dang xu ly" mai mai').toBe('blocked');
    expect(saved?.reasonCode).toBe(ERROR_CODES.MCP_PROVIDER_UNAVAILABLE);
    expect(saved?.blockReasonKind, 'thieu truong nay thi PostgreSQL tu choi ghi').toBe('provider_block');

    // Khong chay thi khong duoc giu tien.
    const ledger = await ctx.persistence.usage.listByWorkspace(ws);
    expect(ledger.filter((e) => e.entryType === 'release')).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(0);
    await app.close();
  });

  it('ly do KHONG phan loai duoc thanh `blocked` thi phai la `failed`, khong nhet bua', async () => {
    const { app, ctx, ws, jobId } = await videoJobQueued();

    /*
     * `MCP_STORAGE_OBJECT_NOT_FOUND` thuoc nhom `storage`, ma `blockReasonKindFor` tra `null` cho
     * nhom do. Truoc `D-066`, duong nay co nhet vao `blocked` va vi pham rang buoc. Nay no phai ra
     * `failed` — trung thuc hon: tep nguon bien mat khong phai "phu thuoc chua san sang".
     */
    /*
     * Phai cho qua cong ffmpeg TRUOC: may chay test nay khong co ffmpeg, neu khong job se dung o
     * `blocked` vi thieu ffmpeg va khong bao gio toi duoc buoc doc tep nguon can kiem.
     */
    const provider = ctx.providers.get('deterministic-video');
    if (provider instanceof DeterministicVideoProvider) {
      provider.ready = async () => true;
    }
    const thatSu = ctx.persistence.sourceFiles.findById.bind(ctx.persistence.sourceFiles);
    ctx.persistence.sourceFiles.findById = async () => null;

    const claimed = await ctx.persistence.jobs.claimQueued(ctx.now().toISOString());
    const outcome = await executeVideoJob(ctx, claimed!);
    ctx.persistence.sourceFiles.findById = thatSu;

    expect(outcome.state).toBe('failed');
    const saved = await ctx.persistence.jobs.findById(ws, jobId);
    expect(saved?.state).toBe('failed');
    expect(saved?.reasonCode).toBe(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND);
    await app.close();
  });
});
