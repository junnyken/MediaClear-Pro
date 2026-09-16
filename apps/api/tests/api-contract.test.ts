/**
 * Doi chieu bang route voi server THAT (Phase 1).
 *
 * Luat: bang API_ROUTES la loi khai; test nay bat loi khai do phai dung:
 *  - route 'implemented' phai duoc dang ky that VA khong duoc tra 501,
 *  - route 'planned' phai tra dung 501 MCP_NOT_IMPLEMENTED,
 *  - route 'dev_only' chi song khi bat dev auth.
 */
import { describe, expect, it } from 'vitest';
import { API_ROUTES, ALL_ERROR_CODES, errorI18nKey, httpStatusFor, type ApiRouteStatus } from '@mediaclear/contracts';
import { MESSAGES } from '@mediaclear/i18n';
import { buildServer } from '../src/server.js';
import { createAppContext } from '../src/app-context.js';

const NOT_IMPLEMENTED_STATUS = httpStatusFor('MCP_NOT_IMPLEMENTED');

describe('Bang route khop server that', () => {
  it('/healthz tra 200 va dem route khop bang', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.productionAiProcessingEnabled).toBe(false);
    expect(body.routes).toBe(API_ROUTES.length);
    expect(body.implementedRoutes).toBe(API_ROUTES.filter((r) => r.status === 'implemented').length);
    expect(body.plannedRoutes).toBe(API_ROUTES.filter((r) => r.status === 'planned').length);
    await app.close();
  });

  it('moi route khai la implemented deu duoc dang ky that su', async () => {
    const app = buildServer();
    await app.ready();
    const missing: string[] = [];
    for (const route of API_ROUTES) {
      if (route.status !== 'implemented') continue;
      const url = route.path.replace(/:([A-Za-z]+)/g, ':$1');
      if (!app.hasRoute({ method: route.method as 'GET' | 'POST' | 'PUT', url })) {
        missing.push(`${route.method} ${route.path}`);
      }
    }
    expect(missing, 'route khai implemented nhung khong co handler').toEqual([]);
    await app.close();
  });

  it('khong route implemented nao tra 501 (khong khai khong tra loi bang 501)', async () => {
    const app = buildServer();
    const lying: string[] = [];
    for (const route of API_ROUTES) {
      if (route.status !== 'implemented' || route.path === '/healthz') continue;
      const url = route.path.replace(/:([A-Za-z]+)/g, 'x-$1');
      const res = await app.inject({ method: route.method as 'GET' | 'POST' | 'PUT', url });
      // Chua dang nhap nen se la 401/404..., mien la KHONG phai 501.
      if (res.statusCode === NOT_IMPLEMENTED_STATUS) lying.push(`${route.method} ${route.path}`);
    }
    expect(lying, 'route khai implemented nhung van tra 501').toEqual([]);
    await app.close();
  });

  it('route chua hien thuc van tra 501 voi ma loi on dinh, khong gia vo thanh cong', async () => {
    const app = buildServer();
    /*
     * P2-MCP-31: bang route hien KHONG con muc 'planned' nao - moi route deu da hien thuc.
     * Vong lap duoi day vi the khong chay lan nao, va do la dieu DUNG.
     *
     * Giu test lai chu khong xoa: khoanh khac co mot route 'planned' moi duoc them vao, no phai
     * tra 501 dung cach ngay lap tuc. Bo `toBeGreaterThan(0)` vi so 0 nay la thanh tuu, khong
     * phai loi.
     */
    const planned = API_ROUTES.filter((r) => (r.status as ApiRouteStatus) === 'planned');
    for (const route of planned) {
      const url = route.path.replace(/:([A-Za-z]+)/g, 'x-$1');
      const res = await app.inject({ method: route.method as 'GET' | 'POST', url });
      expect(res.statusCode, `${route.method} ${route.path}`).toBe(NOT_IMPLEMENTED_STATUS);
      const body = res.json();
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('MCP_NOT_IMPLEMENTED');
      // API khong bao gio tra text da dich.
      expect(JSON.stringify(body)).not.toContain('Chức năng');
    }
    await app.close();
  });

  it('route dev_only bi tat khi khong bat dev auth', async () => {
    const context = createAppContext({ config: { devAuthEnabled: false } });
    const app = buildServer({ context });
    const res = await app.inject({ method: 'POST', url: '/v1/auth/dev-session', payload: { email: 'x@matbao.com' } });
    expect(res.statusCode).toBe(NOT_IMPLEMENTED_STATUS);
    expect(res.json().error.params.reason).toBe('dev_auth_disabled');
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
