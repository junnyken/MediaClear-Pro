/**
 * Muc 13 prompt Phase 1: nhat ky + audit ghi du truong bat buoc va KHONG lo bi mat.
 */
import { describe, expect, it } from 'vitest';
import { redactAuditDetail } from '../src/services/audit.js';
import { auth, attest, createJob, createProject, createWorkspace, makeApp, signIn, uploadFixture, validateAsset } from './helpers.js';

describe('Nhat ky request', () => {
  it('ghi du truong bat buoc va khong chua session token', async () => {
    const { app } = await makeApp();
    const token = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, token, 'Studio');
    const project = await createProject(app, token, ws, 'Du an');
    const uploaded = await uploadFixture(app, token, ws, project, 'sample.png', {
      mimeType: 'image/png',
      mediaType: 'image',
    });
    await validateAsset(app, token, ws, uploaded.assetId);
    await attest(app, token, ws, uploaded.assetId);
    await createJob(app, token, ws, uploaded.assetId);

    const entries = app.mediaclearRequestLog.list();
    expect(entries.length).toBeGreaterThan(5);
    const jobEntry = entries.find((e) => e.operation === 'job.create');
    expect(jobEntry).toBeDefined();
    expect(jobEntry?.requestId).toBeTruthy();
    expect(jobEntry?.workspaceId).toBe(ws);
    expect(jobEntry?.userId).toBeTruthy();
    expect(jobEntry?.durationMs).toBeGreaterThanOrEqual(0);
    expect(jobEntry?.usageOperation).toBe('reserve');
    expect(jobEntry?.resultState).toBe('ok');

    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain(token);
    expect(serialized).not.toContain('Bearer');
    await app.close();
  });

  it('loi cung duoc ghi kem ma loi, khong kem noi dung nhay cam', async () => {
    const { app } = await makeApp();
    await app.inject({ method: 'GET', url: '/v1/me' });
    const entry = app.mediaclearRequestLog.list().at(-1);
    expect(entry?.resultState).toBe('error');
    expect(entry?.httpStatus).toBe(401);
    expect(entry?.errorCode).toBe('MCP_AUTHZ_SESSION_REQUIRED');
    await app.close();
  });
});

describe('Audit detail redaction', () => {
  it('xoa truong nhay cam theo TEN truong', () => {
    const out = redactAuditDetail({
      token: 'abc123',
      sessionToken: 'abc123',
      apiKey: 'sk-that',
      password: 'mat-khau',
      authorization: 'Bearer x',
      signature: 'zzz',
      assetId: 'ast_1',
    });
    expect(out.token).toBe('[redacted]');
    expect(out.sessionToken).toBe('[redacted]');
    expect(out.apiKey).toBe('[redacted]');
    expect(out.password).toBe('[redacted]');
    expect(out.authorization).toBe('[redacted]');
    expect(out.signature).toBe('[redacted]');
    expect(out.assetId).toBe('ast_1');
  });

  it('URL (co the mang chu ky) khong bao gio duoc ghi nguyen van', () => {
    const out = redactAuditDetail({ uploadUrl: 'https://api.test/v1/storage/upload/abc.def' });
    expect(out.uploadUrl).toBe('[url_redacted]');
  });

  it('object/binary khong duoc phep vao audit detail', () => {
    const out = redactAuditDetail({ body: { a: 1 }, bytes: Buffer.from('x'), list: [1, 2] });
    expect(out.body).toBe('[unsupported]');
    expect(out.bytes).toBe('[unsupported]');
    expect(out.list).toBe('[unsupported]');
  });

  it('chuoi dai bi cat ngan', () => {
    const out = redactAuditDetail({ note: 'x'.repeat(1000) });
    expect(String(out.note).length).toBeLessThanOrEqual(200);
  });

  it('audit that su ghi ra khong chua token cua phien', async () => {
    const { app } = await makeApp();
    const token = await signIn(app, 'owner@matbao.com');
    const ws = await createWorkspace(app, token, 'Studio');
    await createProject(app, token, ws, 'Du an');
    const audit = await app.inject({ method: 'GET', url: `/v1/workspaces/${ws}/audit-events`, headers: auth(token, ws) });
    expect(audit.body).not.toContain(token);
    await app.close();
  });
});
