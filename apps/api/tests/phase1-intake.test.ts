/**
 * MCP-12 + MCP-15: upload byte THAT xuong dia, do so do THAT, validate theo config.
 * Khong fixture nao la so lieu dung tay - tat ca la file do ffmpeg/PIL sinh ra.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES } from '@mediaclear/contracts';
import {
  FIXTURES,
  auth,
  createProject,
  createWorkspace,
  makeApp,
  signIn,
  uploadFixture,
  validateAsset,
} from './helpers.js';

async function setup() {
  const { app, ctx } = await makeApp();
  const token = await signIn(app, 'owner@matbao.com');
  const workspaceId = await createWorkspace(app, token, 'Studio');
  const projectId = await createProject(app, token, workspaceId, 'Chien dich thang 9');
  return { app, ctx, token, workspaceId, projectId };
}

describe('MCP-15 upload storage adapter', () => {
  it('upload anh that: byte xuong dia, checksum khop file goc', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    expect(uploaded.uploadStatus).toBe(200);
    const original = await readFile(join(FIXTURES, 'sample.png'));
    const expected = createHash('sha256').update(original).digest('hex');
    expect((uploaded.uploadBody as { data: { checksumSha256: string } }).data.checksumSha256).toBe(expected);
    await app.close();
  });

  it('khoa object khong chua ten file nguoi dung va co tien to workspace', async () => {
    const { app, ctx, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
      filename: '../../../etc/passwd nguy hiem.png',
    });
    const record = await ctx.persistence.sourceFiles.findById(workspaceId, uploaded.sourceFileId);
    expect(record?.storageKey.startsWith(`workspaces/${workspaceId}/projects/${projectId}/assets/`)).toBe(true);
    expect(record?.storageKey).not.toContain('passwd');
    expect(record?.storageKey).not.toContain('..');
    // Ten goc van duoc giu lai lam ten hien thi.
    expect(record?.originalFilename).toContain('passwd');
    await app.close();
  });

  it('upload lan hai vao cung khoa source bi tu choi (I-1)', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const bytes = await readFile(join(FIXTURES, 'sample.png'));
    const intent = (
      await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/assets/upload-intent`,
        headers: auth(token, workspaceId),
        payload: {
          originalFilename: 'sample.png',
          mimeType: 'image/png',
          mediaType: 'image',
          byteSize: bytes.byteLength,
        },
      })
    ).json();
    const uploadPath = new URL(intent.data.uploadUrl).pathname;
    const first = await app.inject({ method: 'PUT', url: uploadPath, payload: bytes });
    const second = await app.inject({ method: 'PUT', url: uploadPath, payload: bytes });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(409);
    expect(second.json().error.code).toBe('MCP_STORAGE_WRITE_DENIED');
    await app.close();
  });

  it('upload ticket gia mao chu ky bi tu choi', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const bytes = await readFile(join(FIXTURES, 'sample.png'));
    const intent = (
      await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/assets/upload-intent`,
        headers: auth(token, workspaceId),
        payload: { originalFilename: 'a.png', mimeType: 'image/png', mediaType: 'image', byteSize: bytes.byteLength },
      })
    ).json();
    const path = new URL(intent.data.uploadUrl).pathname;
    const tampered = `${path.slice(0, -3)}xyz`;
    const res = await app.inject({ method: 'PUT', url: tampered, payload: bytes });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('MCP_STORAGE_UPLOAD_TICKET_INVALID');
    await app.close();
  });

  it('tai lai duoc dung byte da upload qua download URL co han', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.jpg', {
      mimeType: 'image/jpeg',
      mediaType: 'image',
    });
    const urlRes = await app.inject({
      method: 'GET',
      url: `/v1/assets/${uploaded.assetId}/download-url`,
      headers: auth(token, workspaceId),
    });
    expect(urlRes.statusCode).toBe(200);
    const downloadPath = new URL(urlRes.json().data.url).pathname;
    const download = await app.inject({ method: 'GET', url: downloadPath });
    expect(download.statusCode).toBe(200);
    const original = await readFile(join(FIXTURES, 'sample.jpg'));
    expect(Buffer.from(download.rawPayload).equals(original)).toBe(true);
    await app.close();
  });
});

describe('MCP-12 media intake validation', () => {
  it('anh PNG hop le: validate dat, so do lay tu byte that', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    const validated = await validateAsset(app, token, workspaceId, uploaded.assetId);
    expect(validated.body.data.valid).toBe(true);

    const view = (
      await app.inject({ method: 'GET', url: `/v1/assets/${uploaded.assetId}`, headers: auth(token, workspaceId) })
    ).json();
    expect(view.data.sourceFile.measured.widthPx).toBe(200);
    expect(view.data.sourceFile.measured.heightPx).toBe(120);
    expect(view.data.validation.state).toBe('passed');
    await app.close();
  });

  it('video 09:59 duoc nhan, 10:00 bi tu choi - do tren file that', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const ok = await uploadFixture(app, token, workspaceId, projectId, 'video-599s.mp4', {
      mimeType: 'video/mp4',
      mediaType: 'video',
    });
    const over = await uploadFixture(app, token, workspaceId, projectId, 'video-600s.mp4', {
      mimeType: 'video/mp4',
      mediaType: 'video',
    });
    const okResult = await validateAsset(app, token, workspaceId, ok.assetId);
    const overResult = await validateAsset(app, token, workspaceId, over.assetId);
    expect(okResult.body.data.valid).toBe(true);
    expect(overResult.body.data.valid).toBe(false);
    expect(overResult.body.data.errors.map((e: { code: string }) => e.code)).toContain('MCP_VAL_DURATION_EXCEEDED');
    await app.close();
  });

  it('video rong 3840 duoc nhan, 3842 bi tu choi - do tren file that', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const ok = await uploadFixture(app, token, workspaceId, projectId, 'video-3840w.mp4', {
      mimeType: 'video/mp4',
      mediaType: 'video',
    });
    const over = await uploadFixture(app, token, workspaceId, projectId, 'video-3842w.mp4', {
      mimeType: 'video/mp4',
      mediaType: 'video',
    });
    expect((await validateAsset(app, token, workspaceId, ok.assetId)).body.data.valid).toBe(true);
    const overResult = await validateAsset(app, token, workspaceId, over.assetId);
    expect(overResult.body.data.errors.map((e: { code: string }) => e.code)).toContain('MCP_VAL_VIDEO_WIDTH_EXCEEDED');
    await app.close();
  });

  it('khai image/jpeg nhung byte la PNG => MCP_VAL_MIME_MISMATCH', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'declared-jpeg-actually-png.jpg', {
      mimeType: 'image/jpeg',
      mediaType: 'image',
    });
    const result = await validateAsset(app, token, workspaceId, uploaded.assetId);
    expect(result.body.data.valid).toBe(false);
    expect(result.body.data.errors.map((e: { code: string }) => e.code)).toContain('MCP_VAL_MIME_MISMATCH');
    await app.close();
  });

  it('file hong => bao corrupt, khong tra kich thuoc bia', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'corrupt.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    const result = await validateAsset(app, token, workspaceId, uploaded.assetId);
    const codes = result.body.data.errors.map((e: { code: string }) => e.code);
    expect(result.body.data.valid).toBe(false);
    expect(codes).toContain('MCP_VAL_CORRUPT_MEDIA');
    await app.close();
  });

  it('dinh dang khong ho tro bi chan NGAY o upload-intent, khong ton bang thong', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/assets/upload-intent`,
      headers: auth(token, workspaceId),
      payload: { originalFilename: 'x.gif', mimeType: 'image/gif', mediaType: 'image', byteSize: 1024 },
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('MCP_VAL_UNSUPPORTED_FORMAT');
    await app.close();
  });

  it('khai dung lung hon gioi han 199 MB bi chan o intent (bien inclusive)', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const atLimit = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/assets/upload-intent`,
      headers: auth(token, workspaceId),
      payload: {
        originalFilename: 'big.mp4',
        mimeType: 'video/mp4',
        mediaType: 'video',
        byteSize: MAX_FILE_SIZE_BYTES,
      },
    });
    const overLimit = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/assets/upload-intent`,
      headers: auth(token, workspaceId),
      payload: {
        originalFilename: 'big.mp4',
        mimeType: 'video/mp4',
        mediaType: 'video',
        byteSize: MAX_FILE_SIZE_BYTES + 1,
      },
    });
    expect(atLimit.statusCode).toBe(200);
    expect(overLimit.statusCode).toBe(413);
    expect(overLimit.json().error.code).toBe('MCP_VAL_FILE_TOO_LARGE');
    await app.close();
  });

  it('chua upload byte nao thi khong validate "kho khong"', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const intent = (
      await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/assets/upload-intent`,
        headers: auth(token, workspaceId),
        payload: { originalFilename: 'a.png', mimeType: 'image/png', mediaType: 'image', byteSize: 10 },
      })
    ).json();
    const result = await validateAsset(app, token, workspaceId, intent.data.assetId);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('MCP_VAL_EMPTY_FILE');
    await app.close();
  });

  it('asset cua workspace khac khong doc duoc (R-2)', async () => {
    const { app, token, workspaceId, projectId } = await setup();
    const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    const intruder = await signIn(app, 'ke-la@matbao.com');
    const wsIntruder = await createWorkspace(app, intruder, 'Cua ke la');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/assets/${uploaded.assetId}`,
      headers: auth(intruder, wsIntruder),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
