/**
 * P2-MCP-35: tai len noi lai duoc.
 *
 * Phep thu quan trong nhat la MO PHONG DUT KET NOI: gui vai manh, bo do, hoi lai server xem no
 * co nhung manh nao, roi gui tiep DUNG nhung manh con thieu. Chi kiem "gui du manh thi ghep
 * duoc" se khong chung minh duoc gi ve kha nang noi lai - ma "noi lai duoc" chinh la ly do ton
 * tai cua ca muc nay.
 *
 * Doi chung bat buoc: tep ghep ra phai KHOP TUNG BYTE voi tep goc, khong chi khop kich thuoc.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { totalChunksFor } from '../src/services/resumable-upload.js';
import { auth, createProject, createWorkspace, makeApp, signIn } from './helpers.js';
import sharp from 'sharp';

/** Anh du to de chia duoc nhieu manh voi kich thuoc manh nho. */
async function bigPng(): Promise<Buffer> {
  const W = 900, H = 700, ch = 3;
  const buf = Buffer.alloc(W * H * ch);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = (x * 7 + y * 13) % 256;
    const i = (y * W + x) * ch;
    buf[i] = v; buf[i + 1] = (v + 80) % 256; buf[i + 2] = 255 - v;
  }
  return sharp(buf, { raw: { width: W, height: H, channels: ch } }).png({ compressionLevel: 0 }).toBuffer();
}

async function setup(chunkSizeBytes: number) {
  const png = await bigPng();
  const { app, ctx } = await makeApp();
  const token = await signIn(app, `owner-${Date.now()}-${Math.random()}@matbao.com`);
  const ws = await createWorkspace(app, token, 'Studio');
  const project = await createProject(app, token, ws, 'Du an');

  const intent = await app.inject({
    method: 'POST',
    url: `/v1/projects/${project}/assets/upload-intent`,
    headers: auth(token, ws),
    payload: { originalFilename: 'lon.png', mimeType: 'image/png', byteSize: png.byteLength, mediaType: 'image' },
  });
  const sourceFileId = intent.json().data.sourceFileId;

  const opened = await app.inject({
    method: 'POST',
    url: `/v1/source-files/${sourceFileId}/upload-session`,
    headers: auth(token, ws),
    payload: { chunkSizeBytes },
  });
  return { app, ctx, token, ws, png, session: opened.json().data, sourceFileId };
}

function chunkOf(png: Buffer, index: number, size: number): Buffer {
  return png.subarray(index * size, Math.min((index + 1) * size, png.byteLength));
}

async function putChunk(app: Awaited<ReturnType<typeof makeApp>>['app'], token: string, ws: string, sessionId: string, index: number, bytes: Buffer) {
  return app.inject({
    method: 'PUT',
    url: `/v1/upload-sessions/${sessionId}/chunks/${index}`,
    headers: { ...auth(token, ws), 'content-type': 'application/octet-stream' },
    payload: bytes,
  });
}

const CHUNK = 64 * 1024;

describe('P2-MCP-35 — tai len noi lai duoc', () => {
  it('chia manh dung: so manh suy ra tu kich thuoc va co manh', () => {
    expect(totalChunksFor(10, 4)).toBe(3);
    expect(totalChunksFor(8, 4)).toBe(2);
    expect(totalChunksFor(1, 4)).toBe(1);
  });

  it('mo phien tra ve so manh va danh sach da nhan (rong luc dau)', async () => {
    const { app, png, session } = await setup(CHUNK);
    expect(session.totalChunks).toBe(totalChunksFor(png.byteLength, CHUNK));
    expect(session.receivedChunks).toEqual([]);
    expect(session.state).toBe('open');
    await app.close();
  });

  it('CA CHINH: dut giua chung, hoi lai server, tai tiep DUNG phan con thieu', async () => {
    const { app, token, ws, png, session, sourceFileId } = await setup(CHUNK);
    const total = session.totalChunks as number;
    expect(total).toBeGreaterThan(3);

    // Gui duoc mot nua roi "mat ket noi".
    const half = Math.floor(total / 2);
    for (let i = 0; i < half; i++) {
      const res = await putChunk(app, token, ws, session.uploadSessionId, i, chunkOf(png, i, CHUNK));
      expect(res.statusCode).toBe(200);
    }

    // Client quay lai va HOI server: toi da gui duoc nhung gi?
    const resumed = (
      await app.inject({ method: 'GET', url: `/v1/upload-sessions/${session.uploadSessionId}`, headers: auth(token, ws) })
    ).json().data;
    expect(resumed.receivedChunks).toEqual([...Array(half).keys()]);

    // Chua du manh thi KHONG duoc ghep, va phai noi ro thieu gi.
    const early = await app.inject({
      method: 'POST',
      url: `/v1/upload-sessions/${session.uploadSessionId}/complete`,
      headers: auth(token, ws),
    });
    expect(early.statusCode).not.toBe(200);
    expect(early.json().error.params.reason).toBe('missing_chunks');

    // Gui tiep DUNG phan con thieu.
    for (let i = half; i < total; i++) {
      await putChunk(app, token, ws, session.uploadSessionId, i, chunkOf(png, i, CHUNK));
    }

    const done = await app.inject({
      method: 'POST',
      url: `/v1/upload-sessions/${session.uploadSessionId}/complete`,
      headers: auth(token, ws),
    });
    expect(done.statusCode).toBe(200);
    const result = done.json().data;

    // KHOP TUNG BYTE, khong chi khop kich thuoc.
    expect(result.byteSize).toBe(png.byteLength);
    expect(result.checksumSha256).toBe(createHash('sha256').update(png).digest('hex'));
    expect(result.sourceFileId).toBe(sourceFileId);
    await app.close();
  });

  it('tep ghep ra doc lai TU KHO phai khop tung byte voi ban goc', async () => {
    const { app, ctx, token, ws, png, session, sourceFileId } = await setup(CHUNK);
    for (let i = 0; i < session.totalChunks; i++) {
      await putChunk(app, token, ws, session.uploadSessionId, i, chunkOf(png, i, CHUNK));
    }
    await app.inject({ method: 'POST', url: `/v1/upload-sessions/${session.uploadSessionId}/complete`, headers: auth(token, ws) });

    const record = await ctx.persistence.sourceFiles.findById(ws, sourceFileId);
    expect(record?.uploadState).toBe('stored');
    const stored = Buffer.from(await ctx.storage.getObject({ bucket: ctx.bucket, key: record!.storageKey }));
    expect(stored.equals(png), 'tep ghep ra KHAC ban goc').toBe(true);
    await app.close();
  });

  it('gui LAI mot manh da gui khong sinh ban sao trong danh sach', async () => {
    const { app, token, ws, png, session } = await setup(CHUNK);
    await putChunk(app, token, ws, session.uploadSessionId, 0, chunkOf(png, 0, CHUNK));
    const again = await putChunk(app, token, ws, session.uploadSessionId, 0, chunkOf(png, 0, CHUNK));
    expect(again.json().data.receivedChunks).toEqual([0]);
    await app.close();
  });

  it('manh SAI KICH THUOC bi tu choi ngay, khong doi toi luc ghep moi phat hien', async () => {
    const { app, token, ws, png, session } = await setup(CHUNK);
    const truncated = chunkOf(png, 0, CHUNK).subarray(0, CHUNK - 10);
    const res = await putChunk(app, token, ws, session.uploadSessionId, 0, truncated);
    expect(res.statusCode).not.toBe(200);
    expect(res.json().error.params.field).toBe('chunkSize');
    await app.close();
  });

  it('chi so manh NGOAI KHOANG bi tu choi', async () => {
    const { app, token, ws, png, session } = await setup(CHUNK);
    const res = await putChunk(app, token, ws, session.uploadSessionId, session.totalChunks, chunkOf(png, 0, CHUNK));
    expect(res.statusCode).not.toBe(200);
    expect(res.json().error.params.field).toBe('chunkIndex');
    await app.close();
  });

  it('GHEP HAI LAN bi chan - I-1: tep goc da co byte thi khong ai ghi de', async () => {
    const { app, token, ws, png, session } = await setup(CHUNK);
    for (let i = 0; i < session.totalChunks; i++) {
      await putChunk(app, token, ws, session.uploadSessionId, i, chunkOf(png, i, CHUNK));
    }
    await app.inject({ method: 'POST', url: `/v1/upload-sessions/${session.uploadSessionId}/complete`, headers: auth(token, ws) });
    const twice = await app.inject({
      method: 'POST',
      url: `/v1/upload-sessions/${session.uploadSessionId}/complete`,
      headers: auth(token, ws),
    });
    expect(twice.statusCode).not.toBe(200);
    await app.close();
  });

  it('mo lai phien DA CO tra nguyen trang thai, khong xoa manh da gui', async () => {
    const { app, token, ws, png, session, sourceFileId } = await setup(CHUNK);
    await putChunk(app, token, ws, session.uploadSessionId, 0, chunkOf(png, 0, CHUNK));
    const reopened = await app.inject({
      method: 'POST',
      url: `/v1/source-files/${sourceFileId}/upload-session`,
      headers: auth(token, ws),
      payload: {},
    });
    expect(reopened.json().data.uploadSessionId).toBe(session.uploadSessionId);
    expect(reopened.json().data.receivedChunks).toEqual([0]);
    await app.close();
  });

  it('workspace KHAC khong dung duoc phien', async () => {
    const { app, session } = await setup(CHUNK);
    const other = await signIn(app, `nguoi-la-${Date.now()}@matbao.com`);
    const otherWs = await createWorkspace(app, other, 'Khac');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/upload-sessions/${session.uploadSessionId}`,
      headers: auth(other, otherWs),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('manh nam o lop `staging`, KHONG bao gio o lop `source`', async () => {
    const { app, ctx, token, ws, png, session, sourceFileId } = await setup(CHUNK);
    await putChunk(app, token, ws, session.uploadSessionId, 0, chunkOf(png, 0, CHUNK));
    const record = await ctx.persistence.sourceFiles.findById(ws, sourceFileId);
    // Tep goc VAN chua co byte nao sau khi da gui mot manh.
    expect(record?.uploadState).toBe('pending');
    expect((await ctx.storage.head({ bucket: ctx.bucket, key: record!.storageKey })).exists).toBe(false);
    await app.close();
  });
});
