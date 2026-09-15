/**
 * MediaClear Pro - API skeleton (Phase 0).
 *
 * TRANG THAI THAT: chi /healthz chay that. MOI route nghiep vu tra 501
 * MCP_NOT_IMPLEMENTED. Day la contract surface de Phase 1 hien thuc,
 * KHONG phai bang chung rang pipeline da hoat dong.
 *
 * Client-agnostic: khong co route rieng cho web hay Chrome Extension (guardrail 12).
 */
import Fastify from 'fastify';
import {
  API_ROUTES,
  ERROR_CODES,
  PHASE,
  PRODUCTION_AI_PROCESSING_ENABLED,
  apiError,
  httpStatusFor,
} from '@mediaclear/contracts';

export function buildServer() {
  const app = Fastify({ logger: false });

  app.get('/healthz', async () => ({
    ok: true,
    phase: PHASE,
    productionAiProcessingEnabled: PRODUCTION_AI_PROCESSING_ENABLED,
    routes: API_ROUTES.length,
  }));

  // Dang ky moi route nghiep vu o trang thai 'planned' -> 501, co ma loi ro rang.
  for (const route of API_ROUTES) {
    if (route.status !== 'planned') continue;
    const path = route.path.replace(/:([A-Za-z]+)/g, ':$1');
    // Status lay tu ERROR_CATALOGUE, khong hard-code so 501 o day.
    const notImplementedStatus = httpStatusFor(ERROR_CODES.MCP_NOT_IMPLEMENTED);
    const handler = async (_req: unknown, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) =>
      reply
        .code(notImplementedStatus)
        .send({ ok: false, error: apiError(ERROR_CODES.MCP_NOT_IMPLEMENTED, { route: route.path }) });
    if (route.method === 'GET') app.get(path, handler);
    else app.post(path, handler);
  }

  return app;
}

const isEntrypoint = process.argv[1]?.endsWith('server.js') ?? false;
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 3001);
  buildServer()
    .listen({ port, host: '0.0.0.0' })
    .then(() => console.log(`[mediaclear-api] phase0 skeleton on :${port}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
