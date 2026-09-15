/**
 * P1.1-MCP-18 qua HTTP that: luat luu giu, bao cao thu-khong-xoa, va chan duong xoa.
 */
import { describe, expect, it } from 'vitest';
import { API_ROUTES, SOURCE_OUTPUT_RETENTION_DAYS } from '@mediaclear/contracts';
import {
  INTERNAL_TOKEN,
  auth,
  createProject,
  createWorkspace,
  makeApp,
  signIn,
  uploadFixture,
} from './helpers.js';

const T0 = new Date('2026-09-15T10:00:00.000Z');
const DAY_MS = 86_400_000;

function clock(start: Date) {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advanceDays(days: number) {
      current += days * DAY_MS;
    },
  };
}

async function workspaceWithAsset() {
  const time = clock(T0);
  const { app, ctx } = await makeApp({ now: time.now, internalApiToken: INTERNAL_TOKEN });
  const token = await signIn(app, 'owner@matbao.com');
  const workspaceId = await createWorkspace(app, token, 'Studio');
  const projectId = await createProject(app, token, workspaceId, 'Du an');
  const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  return { app, ctx, token, workspaceId, assetId: uploaded.assetId, sourceFileId: uploaded.sourceFileId, time };
}

describe('Xem han luu giu cua mot tep', () => {
  it('tra ve moc giu toi va khang dinh chua phai ung vien xoa', async () => {
    const { app, token, workspaceId, assetId } = await workspaceWithAsset();
    const res = await app.inject({
      method: 'GET',
      url: `/v1/assets/${assetId}/retention`,
      headers: auth(token, workspaceId),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.retentionState).toBe('active');
    expect(data.deletionCandidate).toBe(false);
    expect(data.policyVersion).toBe(1);
    expect(new Date(data.retainUntil).getTime()).toBeGreaterThan(T0.getTime());
    await app.close();
  });

  it('doc tep la mot lan truy cap => moc 30 ngay tinh lai tu day', async () => {
    const { app, token, workspaceId, assetId, time } = await workspaceWithAsset();
    time.advanceDays(20);

    // Sau 20 ngay thi phien dang nhap cu DA HET HAN (TTL 12 gio) - dung nhu thiet ke.
    const stale = await app.inject({ method: 'GET', url: `/v1/assets/${assetId}`, headers: auth(token, workspaceId) });
    expect(stale.statusCode).toBe(401);

    // Nguoi dung quay lai va dang nhap lai; lan doc nay moi la mot lan truy cap that.
    const freshToken = await signIn(app, 'owner@matbao.com');
    await app.inject({ method: 'GET', url: `/v1/assets/${assetId}`, headers: auth(freshToken, workspaceId) });
    const res = await app.inject({
      method: 'GET',
      url: `/v1/assets/${assetId}/retention`,
      headers: auth(freshToken, workspaceId),
    });
    const data = res.json().data;
    const expected = new Date(T0.getTime() + 20 * DAY_MS + SOURCE_OUTPUT_RETENTION_DAYS * DAY_MS);
    expect(new Date(data.retainUntil).getTime()).toBe(expected.getTime());
    await app.close();
  });

  it('tep cua workspace khac khong xem duoc han luu giu', async () => {
    const { app, assetId } = await workspaceWithAsset();
    const intruder = await signIn(app, 'ke-la@matbao.com');
    const wsIntruder = await createWorkspace(app, intruder, 'Cua ke la');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/assets/${assetId}/retention`,
      headers: auth(intruder, wsIntruder),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe('Bao cao thu-khong-xoa', () => {
  it('khong cau hinh khoa noi bo => route coi nhu khong ton tai', async () => {
    const time = clock(T0);
    const { app } = await makeApp({ now: time.now, internalApiToken: null });
    const res = await app.inject({ method: 'POST', url: '/v1/internal/retention/dry-run' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('hom nay chua co ung vien nao', async () => {
    const { app } = await workspaceWithAsset();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/retention/dry-run',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.dryRun).toBe(true);
    expect(res.json().data.candidateCount).toBe(0);
    expect(res.json().data.scannedCount).toBe(1);
    await app.close();
  });

  it('nhin toi tuong lai 31 ngay: tep khong ai dung tro thanh ung vien, co ly do ro rang', async () => {
    const { app } = await workspaceWithAsset();
    const asOf = new Date(T0.getTime() + 31 * DAY_MS).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/retention/dry-run',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      payload: { asOf },
    });
    const data = res.json().data;
    expect(data.candidateCount).toBe(1);
    expect(data.byReason.source_inactive_30d).toBe(1);
    expect(data.byDataClass.source_asset).toBe(1);
    expect(data.oldestCandidateAt).toBeTruthy();
    await app.close();
  });

  it('bao cao KHONG xoa gi: tep va byte van con nguyen sau khi chay', async () => {
    const { app, ctx, token, workspaceId, assetId, sourceFileId } = await workspaceWithAsset();
    const record = await ctx.persistence.sourceFiles.findById(workspaceId, sourceFileId);
    const headBefore = await ctx.storage.head({ bucket: ctx.bucket, key: record?.storageKey ?? '' });

    await app.inject({
      method: 'POST',
      url: '/v1/internal/retention/dry-run',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      payload: { asOf: new Date(T0.getTime() + 9999 * DAY_MS).toISOString() },
    });

    const stillThere = await app.inject({ method: 'GET', url: `/v1/assets/${assetId}`, headers: auth(token, workspaceId) });
    expect(stillThere.statusCode).toBe(200);
    const headAfter = await ctx.storage.head({ bucket: ctx.bucket, key: record?.storageKey ?? '' });
    expect(headAfter.exists).toBe(true);
    expect(headAfter.checksumSha256).toBe(headBefore.checksumSha256);
    await app.close();
  });

  it('asOf khong hop le => loi co translation key, khong phai loi noi bo', async () => {
    const { app } = await workspaceWithAsset();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/retention/dry-run',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      payload: { asOf: 'khong-phai-ngay' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.messageKey).toMatch(/^errors\./);
    await app.close();
  });
});

describe('Khong co duong xoa nao trong Phase 1.1', () => {
  it('bang route khong co method DELETE nao', () => {
    const destructive = API_ROUTES.filter((r) => (r.method as string) === 'DELETE');
    expect(destructive).toEqual([]);
  });

  it('khong route nao co tu "delete"/"purge" trong duong dan', () => {
    const suspicious = API_ROUTES.filter((r) => /delete|purge|destroy/i.test(r.path));
    expect(suspicious).toEqual([]);
  });

  it('route noi bo deu duoc danh dau la internal va bi tat mac dinh', async () => {
    const internal = API_ROUTES.filter((r) => r.status === 'internal');
    expect(internal.length).toBeGreaterThan(0);
    const { app } = await makeApp({ internalApiToken: null });
    for (const route of internal) {
      const res = await app.inject({ method: route.method as 'POST', url: route.path });
      expect(res.statusCode, route.path).toBe(404);
    }
    await app.close();
  });
});
