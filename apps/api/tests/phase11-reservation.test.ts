/**
 * P1.1-MCP-17 qua HTTP that: han 30 phut, hoan tra idempotent, job KHONG doi trang thai.
 */
import { describe, expect, it } from 'vitest';
import { USAGE_RESERVATION_TTL_SECONDS } from '@mediaclear/contracts';
import {
  INTERNAL_TOKEN,
  attest,
  auth,
  createJob,
  createProject,
  createWorkspace,
  makeApp,
  signIn,
  uploadFixture,
  validateAsset,
} from './helpers.js';

const T0 = new Date('2026-09-15T10:00:00.000Z');

/** Dong ho dieu khien duoc: test khong phai cho 30 phut that. */
function clock(start: Date) {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advanceSeconds(seconds: number) {
      current += seconds * 1000;
    },
  };
}

async function jobWithReservation(internalToken: string | null = INTERNAL_TOKEN) {
  const time = clock(T0);
  const { app, ctx } = await makeApp({ now: time.now, internalApiToken: internalToken });
  const token = await signIn(app, 'owner@matbao.com');
  const workspaceId = await createWorkspace(app, token, 'Studio');
  const projectId = await createProject(app, token, workspaceId, 'Du an');
  const uploaded = await uploadFixture(app, token, workspaceId, projectId, 'sample.png', {
    mimeType: 'image/png',
    mediaType: 'image',
  });
  await validateAsset(app, token, workspaceId, uploaded.assetId);
  await attest(app, token, workspaceId, uploaded.assetId);
  const job = await createJob(app, token, workspaceId, uploaded.assetId, { idempotencyKey: 'k1' });
  return { app, ctx, token, workspaceId, assetId: uploaded.assetId, job, time };
}

describe('Han cua khoan giu muc dung', () => {
  it('tao job => co han = luc tao + 1800 giay', async () => {
    const { app, job } = await jobWithReservation();
    expect(job.status).toBe(200);
    expect(job.body.data.usage.state).toBe('reserved');
    const expected = new Date(T0.getTime() + USAGE_RESERVATION_TTL_SECONDS * 1000).toISOString();
    expect(job.body.data.usage.expiresAt).toBe(expected);
    await app.close();
  });

  it('truoc han: van la "dang giu"; sau han: thanh "het han" nhung JOB KHONG doi trang thai', async () => {
    const { app, token, workspaceId, job, time } = await jobWithReservation();
    const jobId = job.body.data.job.id as string;

    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS - 1);
    let view = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}`, headers: auth(token, workspaceId) })).json();
    expect(view.data.usage.state).toBe('reserved');

    time.advanceSeconds(2);
    view = (await app.inject({ method: 'GET', url: `/v1/jobs/${jobId}`, headers: auth(token, workspaceId) })).json();
    expect(view.data.usage.state).toBe('expired');
    // Quan trong: het han la chuyen cua RESERVATION, khong phai cua job.
    expect(view.data.job.state).toBe('queued');
    await app.close();
  });

  it('muc dung: khoan het han KHONG duoc dem nhu dang giu', async () => {
    const { app, token, workspaceId, time } = await jobWithReservation();
    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS + 1);
    const usage = (await app.inject({ method: 'GET', url: '/v1/usage', headers: auth(token, workspaceId) })).json();
    expect(usage.data.imageUnitsReserved).toBe(0);
    expect(usage.data.imageUnitsExpired).toBe(1);
    expect(usage.data.imageUnitsCommitted).toBe(0);
    await app.close();
  });

  it('route noi bo bi TAT khi khong cau hinh khoa => 404 nhu duong dan la', async () => {
    const { app } = await jobWithReservation(null);
    const res = await app.inject({ method: 'POST', url: '/v1/internal/usage-reservations/expire' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('MCP_RESOURCE_NOT_FOUND');
    await app.close();
  });

  it('sai khoa noi bo => 404, khong lo route co ton tai', async () => {
    const { app } = await jobWithReservation();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': 'khoa-sai' },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('chay lenh het han: hoan tra dung MOT lan, chay lai khong sinh them gi (idempotent)', async () => {
    const { app, ctx, workspaceId, time } = await jobWithReservation();
    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS + 1);

    const first = await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.expiredFound).toBe(1);
    expect(first.json().data.releasedNow).toBe(1);

    const ledgerAfterFirst = await ctx.persistence.usage.listByWorkspace(workspaceId);
    expect(ledgerAfterFirst.filter((e) => e.entryType === 'release')).toHaveLength(1);
    expect(ledgerAfterFirst.find((e) => e.entryType === 'release')?.reasonCode).toBe('expired');

    const second = await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });
    expect(second.json().data.expiredFound).toBe(0);
    expect(second.json().data.releasedNow).toBe(0);
    const ledgerAfterSecond = await ctx.persistence.usage.listByWorkspace(workspaceId);
    expect(ledgerAfterSecond).toHaveLength(ledgerAfterFirst.length);
    await app.close();
  });

  it('che do chi-dem khong ghi but toan nao', async () => {
    const { app, ctx, workspaceId, time } = await jobWithReservation();
    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS + 1);
    const before = (await ctx.persistence.usage.listByWorkspace(workspaceId)).length;
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      payload: { dryRun: true },
    });
    expect(res.json().data.dryRun).toBe(true);
    expect(res.json().data.expiredFound).toBe(1);
    expect(res.json().data.releasedNow).toBe(0);
    expect(await ctx.persistence.usage.listByWorkspace(workspaceId)).toHaveLength(before);
    await app.close();
  });

  it('khoan chua den han thi lenh khong dung toi', async () => {
    const { app, ctx, workspaceId } = await jobWithReservation();
    const res = await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });
    expect(res.json().data.expiredFound).toBe(0);
    expect((await ctx.persistence.usage.listByWorkspace(workspaceId)).filter((e) => e.entryType === 'release')).toHaveLength(0);
    await app.close();
  });

  it('het han roi thu lai => job MOI va khoan giu MOI, khong double-charge', async () => {
    const { app, ctx, token, workspaceId, assetId, job, time } = await jobWithReservation();
    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS + 1);
    await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });

    const retry = await createJob(app, token, workspaceId, assetId, { idempotencyKey: 'k2' });
    expect(retry.status).toBe(200);
    expect(retry.body.data.job.id).not.toBe(job.body.data.job.id);
    expect(retry.body.data.usage.state).toBe('reserved');

    const ledger = await ctx.persistence.usage.listByWorkspace(workspaceId);
    // Dung 2 reserve (2 job khac nhau) + 1 release cua khoan het han. Khong co commit nao.
    expect(ledger.filter((e) => e.entryType === 'reserve')).toHaveLength(2);
    expect(ledger.filter((e) => e.entryType === 'release')).toHaveLength(1);
    expect(ledger.filter((e) => e.entryType === 'commit')).toHaveLength(0);
    await app.close();
  });

  it('ghi audit cho lan het han', async () => {
    const { app, token, workspaceId, time } = await jobWithReservation();
    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS + 1);
    await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });
    const audit = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/audit-events`,
      headers: auth(token, workspaceId),
    });
    const types = audit.json().data.items.map((e: { eventType: string }) => e.eventType);
    expect(types).toContain('usage_reservation_expired');
    expect(types).toContain('usage_released');
    await app.close();
  });

  it('huy job da het han: khoan giu khong bi hoan tra hai lan', async () => {
    const { app, ctx, token, workspaceId, job, time } = await jobWithReservation();
    const jobId = job.body.data.job.id as string;
    time.advanceSeconds(USAGE_RESERVATION_TTL_SECONDS + 1);
    await app.inject({
      method: 'POST',
      url: '/v1/internal/usage-reservations/expire',
      headers: { 'x-internal-token': INTERNAL_TOKEN },
    });
    const cancel = await app.inject({ method: 'POST', url: `/v1/jobs/${jobId}/cancel`, headers: auth(token, workspaceId) });
    expect(cancel.statusCode).toBe(200);
    const ledger = await ctx.persistence.usage.listByWorkspace(workspaceId);
    expect(ledger.filter((e) => e.entryType === 'release')).toHaveLength(1);
    await app.close();
  });
});
