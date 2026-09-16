/**
 * P3-MCP-30: ban proxy de xem truoc.
 *
 * Tinh chat quan trong nhat: proxy KHONG thay the tep goc. No la object rieng, o lop luu tru
 * rieng, va tep goc phai con nguyen tung byte sau khi sinh proxy.
 */
import { describe, expect, it } from 'vitest';
import { ffmpegAvailable, probeVideo } from '../src/media/ffmpeg.js';
import { auth, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

const hasFfmpeg = await ffmpegAvailable();

async function videoAsset(fixture = 'video-with-audio.mp4') {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an video');
  const uploaded = await uploadFixture(app, token, ws, project, fixture, {
    mimeType: 'video/mp4',
    mediaType: 'video',
  });
  await validateAsset(app, token, ws, uploaded.assetId);
  return { app, ctx, token, ws, assetId: uploaded.assetId };
}

describe.skipIf(!hasFfmpeg)('P3-MCP-30 — sinh ban proxy', () => {
  it('sinh duoc proxy, ghi dung quan he toi asset goc', async () => {
    const { app, token, ws, assetId } = await videoAsset();
    const res = await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    expect(res.statusCode, JSON.stringify(res.json())).toBe(200);
    const proxy = res.json().data;
    expect(proxy.originalAssetId).toBe(assetId);
    expect(proxy.proxyAssetId).toMatch(/^prx_/);
    expect(proxy.byteSize).toBeGreaterThan(0);
    await app.close();
  }, 180_000);

  it('TEP GOC con nguyen TUNG BYTE sau khi sinh proxy (I-1)', async () => {
    const { app, ctx, token, ws, assetId } = await videoAsset();
    const asset = await ctx.persistence.assets.findById(ws, assetId);
    const source = await ctx.persistence.sourceFiles.findById(ws, asset!.sourceFileId);
    const before = Buffer.from(await ctx.storage.getObject({ bucket: ctx.bucket, key: source!.storageKey }));

    await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });

    const after = Buffer.from(await ctx.storage.getObject({ bucket: ctx.bucket, key: source!.storageKey }));
    expect(after.equals(before), 'sinh proxy da dung vao tep goc').toBe(true);
    await app.close();
  }, 180_000);

  it('proxy nam o lop `preview`, KHONG phai `source`', async () => {
    const { app, ctx, token, ws, assetId } = await videoAsset();
    await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    const record = await ctx.persistence.videoProxies.findByAsset(ws, assetId);
    expect(record?.storageKey).toContain('/preview/');
    expect(record?.storageKey).not.toContain('/source/');
    await app.close();
  }, 180_000);

  it('proxy GIU audio - nguoi dung phai nghe duoc khi xem truoc', async () => {
    const { app, ctx, token, ws, assetId } = await videoAsset();
    const res = await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    expect(res.json().data.hasAudio).toBe(true);
    const record = await ctx.persistence.videoProxies.findByAsset(ws, assetId);
    const bytes = await ctx.storage.getObject({ bucket: ctx.bucket, key: record!.storageKey });
    // Do TREN BYTE that cua proxy, khong tin truong da ghi.
    expect((await probeVideo(bytes)).audio.present).toBe(true);
    await app.close();
  }, 180_000);

  it('video KHONG co audio: proxy khong co audio, va do KHONG phai loi', async () => {
    const { app, token, ws, assetId } = await videoAsset('video-no-audio.mp4');
    const res = await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.hasAudio).toBe(false);
    await app.close();
  }, 180_000);

  it('SINH LAI proxy an toan - khong sinh ban thu hai cho cung mot asset', async () => {
    const { app, ctx, token, ws, assetId } = await videoAsset();
    await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    const first = await ctx.persistence.videoProxies.findByAsset(ws, assetId);
    await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    const second = await ctx.persistence.videoProxies.findByAsset(ws, assetId);
    expect(second).not.toBeNull();
    expect(first!.assetId).toBe(second!.assetId);
    await app.close();
  }, 180_000);

  it('chua sinh proxy thi doc tra 404, KHONG tra ban rong', async () => {
    const { app, token, ws, assetId } = await videoAsset();
    const res = await app.inject({ method: 'GET', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    expect(res.statusCode).toBe(404);
    await app.close();
  }, 180_000);

  it('tai duoc ban proxy ve, byte khop kich thuoc da khai', async () => {
    const { app, token, ws, assetId } = await videoAsset();
    await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    const dl = (await app.inject({ method: 'GET', url: `/v1/assets/${assetId}/proxy/download-url`, headers: auth(token, ws) })).json().data;
    const file = await app.inject({ method: 'GET', url: new URL(dl.url).pathname });
    expect(file.statusCode).toBe(200);
    expect(file.rawPayload.byteLength).toBe(dl.byteSize);
    await app.close();
  }, 180_000);

  it('ASSET ANH khong sinh proxy video - noi ro thay vi chay roi hong', async () => {
    const { app, ctx } = await makeApp();
    const token = await signIn(app, `owner-${Date.now()}@matbao.com`);
    const ws = await createWorkspace(app, token, 'Studio');
    const project = await createProject(app, token, ws, 'Du an anh');
    const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', { mimeType: 'image/png', mediaType: 'image' });
    const res = await app.inject({ method: 'POST', url: `/v1/assets/${uploaded.assetId}/proxy`, headers: auth(token, ws) });
    expect(res.statusCode).not.toBe(200);
    expect(res.json().error.params.field).toBe('mediaType');
    expect(ctx).toBeDefined();
    await app.close();
  }, 180_000);

  it('workspace KHAC khong sinh va khong doc duoc proxy', async () => {
    const { app, token, ws, assetId } = await videoAsset();
    await app.inject({ method: 'POST', url: `/v1/assets/${assetId}/proxy`, headers: auth(token, ws) });
    const other = await signIn(app, `nguoi-la-${Date.now()}@matbao.com`);
    const otherWs = await createWorkspace(app, other, 'Khac');
    const res = await app.inject({ method: 'GET', url: `/v1/assets/${assetId}/proxy`, headers: auth(other, otherWs) });
    expect(res.statusCode).toBe(404);
    await app.close();
  }, 180_000);
});
