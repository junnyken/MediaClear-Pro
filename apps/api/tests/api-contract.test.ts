/**
 * Integration test cho API skeleton: chay Fastify that qua inject (HTTP that su,
 * khong mock route), kiem tra error mapping va translation key.
 */
import { describe, expect, it } from 'vitest';
import { API_ROUTES, ALL_ERROR_CODES, errorI18nKey, httpStatusFor } from '@mediaclear/contracts';
import { MESSAGES } from '@mediaclear/i18n';
import { buildServer } from '../src/server.js';

describe('API skeleton contract', () => {
  it('/healthz tra 200 va tu khai khong co xu ly AI production', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.productionAiProcessingEnabled).toBe(false);
    expect(body.routes).toBe(API_ROUTES.length);
    await app.close();
  });

  it('moi route nghiep vu tra 501 voi ma loi on dinh, KHONG gia vo thanh cong', async () => {
    const app = buildServer();
    const planned = API_ROUTES.filter((r) => r.status === 'planned');
    expect(planned.length).toBeGreaterThan(0);
    for (const route of planned) {
      const url = route.path.replace(/:([A-Za-z]+)/g, 'x-$1');
      const res = await app.inject({ method: route.method as 'GET' | 'POST', url });
      expect(res.statusCode, `${route.method} ${route.path}`).toBe(501);
      const body = res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('MCP_NOT_IMPLEMENTED');
      expect(body.error.messageKey).toBe('errors.mcp_not_implemented');
      // API khong bao gio tra text da dich.
      expect(JSON.stringify(body)).not.toContain('Chức năng');
    }
    await app.close();
  });

  it('HTTP status lay tu error catalogue, khong hard-code', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'POST', url: '/v1/jobs' });
    expect(res.statusCode).toBe(httpStatusFor('MCP_NOT_IMPLEMENTED'));
    await app.close();
  });

  it('moi ma loi co translation key ton tai o ca vi va en', () => {
    for (const code of ALL_ERROR_CODES) {
      const key = errorI18nKey(code);
      expect(MESSAGES.vi[key], `thieu vi: ${key}`).toBeTruthy();
      expect(MESSAGES.en[key], `thieu en: ${key}`).toBeTruthy();
    }
  });
});
