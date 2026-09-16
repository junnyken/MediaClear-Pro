/**
 * P2-MCP-34: tai lieu OpenAPI.
 *
 * Phep thu quan trong nhat KHONG phai "tai lieu co ton tai khong", ma la "tai lieu co mo ta
 * DUNG cai server that lam khong". Mot tai lieu mo ta mot API khac voi API that con TE HON
 * khong co tai lieu - nguoi doc tin no.
 *
 * Nen bo test nay doi chieu tai lieu voi FASTIFY THAT theo ca hai chieu: khong duong nao trong
 * tai lieu ma server khong co, va khong duong nao server co ma tai lieu bo sot.
 */
import { describe, expect, it } from 'vitest';
import { API_ROUTES, ALL_ERROR_CODES, buildOpenApiDocument, pathParamsOf, toOpenApiPath } from '@mediaclear/contracts';
import { buildServer } from '../src/server.js';

describe('P2-MCP-34 — tai lieu OpenAPI', () => {
  it('doi cu phap tham so duong dan sang dang OpenAPI', () => {
    expect(toOpenApiPath('/v1/jobs/:jobId/output/download-url')).toBe('/v1/jobs/{jobId}/output/download-url');
    expect(toOpenApiPath('/healthz')).toBe('/healthz');
    expect(pathParamsOf('/v1/projects/:projectId/assets/upload-intent')).toEqual(['projectId']);
  });

  it('MOI route trong bang deu co trong tai lieu, dung phuong thuc', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };
    const missing: string[] = [];
    for (const route of API_ROUTES) {
      const entry = doc.paths[toOpenApiPath(route.path)];
      if (!entry || !entry[route.method.toLowerCase()]) missing.push(`${route.method} ${route.path}`);
    }
    expect(missing, 'tai lieu bo sot route').toEqual([]);
  });

  it('CHIEU NGUOC LAI: khong duong nao trong tai lieu ma server that khong co', async () => {
    const app = buildServer();
    await app.ready();
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };
    const ghosts: string[] = [];
    for (const [oaPath, methods] of Object.entries(doc.paths)) {
      // Doi nguoc ve cu phap Fastify de hoi server.
      const fastifyPath = oaPath.replace(/\{([A-Za-z0-9_]+)\}/g, ':$1');
      for (const method of Object.keys(methods)) {
        const upper = method.toUpperCase() as 'GET' | 'POST' | 'PUT';
        if (!app.hasRoute({ method: upper, url: fastifyPath })) ghosts.push(`${upper} ${oaPath}`);
      }
    }
    expect(ghosts, 'tai lieu mo ta duong khong ton tai tren server').toEqual([]);
    await app.close();
  });

  it('route TU MO TA trang thai that - khong giau route chua hien thuc', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { summary: string }>> };
    for (const route of API_ROUTES) {
      const op = doc.paths[toOpenApiPath(route.path)]?.[route.method.toLowerCase()];
      expect(op?.summary, `${route.path} thieu tom tat`).toBeTruthy();
      // Tom tat phai mang chinh MINI-SPEC cua route, de truy nguoc duoc.
      expect(op?.summary).toContain(route.mcp);
    }
  });

  it('route can dang nhap thi khai bearerAuth; route cong khai thi KHONG', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, Record<string, { security?: unknown }>> };
    const healthz = doc.paths['/healthz']?.['get'];
    expect(healthz?.security, '/healthz khong duoc doi dang nhap').toBeUndefined();
    const job = doc.paths['/v1/jobs/{jobId}']?.['get'];
    expect(job?.security, 'route du lieu phai doi dang nhap').toBeDefined();
  });

  it('khai DU danh muc ma loi - client biet truoc moi ma co the gap', () => {
    const doc = buildOpenApiDocument() as { 'x-mediaclear-error-catalogue': Array<{ code: string }> };
    const codes = doc['x-mediaclear-error-catalogue'].map((e) => e.code);
    expect(codes.sort()).toEqual([...ALL_ERROR_CODES].sort());
  });

  it('server tra tai lieu THAT, JSON hop le, khong boc trong {ok,data}', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.openapi).toBe('3.1.0');
    // Cong cu doc OpenAPI mong doi tai lieu o MUC GOC, khong nam trong `data`.
    expect(body.ok).toBeUndefined();
    expect(Object.keys(body.paths).length).toBe(new Set(API_ROUTES.map((r) => toOpenApiPath(r.path))).size);
    await app.close();
  });

  it('doc duoc khi CHUA dang nhap - tai lieu la thu cong khai', async () => {
    const app = buildServer();
    const res = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(res.statusCode).toBe(200);
    await app.close();
  });
});
