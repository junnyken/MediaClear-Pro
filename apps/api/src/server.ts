/**
 * MediaClear Pro - API (Phase 1 SaaS Shell, mo rong o Phase 2).
 *
 * SU THAT HIEN TAI:
 *  - Auth/workspace/project/asset/upload/validate/attestation/job boundary CHAY THAT.
 *  - Xu ly TAT DINH bang libvips chay that (crop/blur/brand_overlay tren anh): job dat
 *    'completed', co ban ket qua, va nguoi dung tai ve duoc (P2-MCP-27/28/29).
 *  - KHONG co xu ly bang mo hinh AI. `/healthz` khai rieng dieu nay o
 *    `productionAiProcessingEnabled`, khong suy ra tu viec co provider production.
 *  - Route chua hien thuc van tra 501 MCP_NOT_IMPLEMENTED, khong gia vo thanh cong.
 *
 * Client-agnostic: khong co route rieng cho web hay Chrome Extension.
 */
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import {
  API_ROUTES,
  buildOpenApiDocument,
  type ApiRouteStatus,
  ERROR_CODES,
  MAX_FILE_SIZE_BYTES,
  MEDIA_LIMITS,
  PRODUCTION_AI_PROCESSING_ENABLED,
  RETENTION_POLICY_VERSION,
  RIGHTS_STATEMENT,
  USAGE_RESERVATION_TTL_SECONDS,
  apiError,
  httpStatusFor,
  type ApiError,
} from '@mediaclear/contracts';
import { join } from 'node:path';
import { runMigrations } from './db/migrate.js';
import { S3CompatibleStorageAdapter } from './storage/s3-adapter.js';
import { createAppContext, type AppContext } from './app-context.js';
import { RequestLog } from './observability/request-log.js';
import { resolveActor, resolveUser, type Actor } from './services/access.js';
import { addMember, createWorkspace, listAuditEvents, listMembers, listWorkspacesForUser } from './services/workspaces.js';
import { createProject, getProject, listProjects } from './services/projects.js';
import {
  completeUpload,
  createAssetDownloadUrl,
  createUploadIntent,
  getAssetView,
  listAssets,
  validateAsset,
} from './services/assets.js';
import { createAttestation, getAttestation } from './services/attestations.js';
import { runJob } from './services/run-job.js';
import { cancelJob, createJob, getJob } from './services/jobs.js';
import { createJobOutputDownloadUrl, estimateJob, getJobOutput, getJobReceipt } from './services/outputs.js';
import { getAssetProvenance } from './services/provenance-inspector.js';
import { getJobMetadataComparison } from './services/metadata-provenance.js';
import {
  addBrandKitVersion, createBrandKit, getBrandKit, listBrandKits, setBrandKitState,
} from './services/brand-kits.js';
import { previewJob } from './services/preview.js';
import { createVideoProxy, createVideoProxyDownloadUrl, getVideoProxy } from './services/video-proxy.js';
import { EXPORT_PRESETS } from '@mediaclear/contracts';
import {
  completeUploadSession,
  getUploadSession,
  openUploadSession,
  putUploadChunk,
} from './services/resumable-upload.js';
import { expireReservations, getUsageSummary } from './services/usage.js';
import { correctJobFrame, getJobFrames } from './services/frame-review.js';
import { retentionDryRunReport, retentionForAsset } from './services/retention.js';
import type { ServiceResult } from './services/result.js';

const PHASE = 'phase-1-saas-shell' as const;

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

function workspaceHeader(request: FastifyRequest): string | null {
  const value = request.headers['x-workspace-id'];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function param(request: FastifyRequest, name: string): string {
  const params = request.params as Record<string, string | undefined>;
  return params[name] ?? '';
}

function body(request: FastifyRequest): Record<string, unknown> {
  return typeof request.body === 'object' && request.body !== null && !Buffer.isBuffer(request.body)
    ? (request.body as Record<string, unknown>)
    : {};
}

export interface BuildServerOptions {
  context?: AppContext;
}

export function buildServer(options: BuildServerOptions = {}) {
  const ctx = options.context ?? createAppContext();
  const requestLog = new RequestLog(process.env.MEDIACLEAR_LOG === '1');

  const app = Fastify({
    logger: false,
    // Tran body = tran file cua contract + cho header. Ticket con chan rieng tung lan upload.
    bodyLimit: MAX_FILE_SIZE_BYTES + 64 * 1024,
    /*
     * Upload/download ticket nam trong path param va dai hon 100 ky tu (mac dinh cua
     * Fastify) => neu khong nang gioi han nay thi moi upload deu tra 414 URI Too Long.
     */
    routerOptions: { maxParamLength: 4096 },
  });

  // Nhan byte tho cho upload (khong them phu thuoc multipart).
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, payload, done) => done(null, payload));

  /*
   * Body JSON rong la HOP LE voi cac POST khong can tham so (vd validate, cancel).
   * Parser mac dinh cua Fastify nem FST_ERR_CTP_EMPTY_JSON_BODY va tra loi THO ra ngoai.
   */
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, payload, done) => {
    const text = typeof payload === 'string' ? payload.trim() : '';
    if (text.length === 0) return done(null, {});
    try {
      done(null, JSON.parse(text) as unknown);
    } catch {
      done(new SyntaxError('invalid_json'), undefined);
    }
  });

  // CORS toi thieu: chi Bearer token, khong dung cookie => khong bat credentials.
  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', ctx.config.corsAllowOrigin);
    reply.header('access-control-allow-headers', 'authorization,content-type,x-workspace-id');
    reply.header('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
    reply.header('access-control-max-age', '600');
    if (request.method === 'OPTIONS') {
      await reply.code(204).send();
    }
  });

  const started = new WeakMap<FastifyRequest, number>();
  app.addHook('onRequest', async (request) => {
    started.set(request, Date.now());
  });

  /** Ghi nhat ky: khong bao gio ghi token/URL ky/byte media. */
  function log(request: FastifyRequest, reply: FastifyReply, meta: {
    operation: string;
    workspaceId?: string | null;
    userId?: string | null;
    subjectId?: string | null;
    errorCode?: string | null;
    usageOperation?: string | null;
  }): void {
    requestLog.append({
      requestId: request.id,
      method: request.method,
      route: request.routeOptions?.url ?? request.url.split('?')[0] ?? '',
      workspaceId: meta.workspaceId ?? null,
      userId: meta.userId ?? null,
      subjectId: meta.subjectId ?? null,
      operation: meta.operation,
      resultState: reply.statusCode >= 400 ? 'error' : 'ok',
      httpStatus: reply.statusCode,
      errorCode: meta.errorCode ?? null,
      durationMs: Date.now() - (started.get(request) ?? Date.now()),
      usageOperation: meta.usageOperation ?? null,
    });
  }

  function sendError(request: FastifyRequest, reply: FastifyReply, error: ApiError, operation: string, actor?: Actor) {
    reply.code(httpStatusFor(error.code));
    log(request, reply, {
      operation,
      workspaceId: actor?.workspace.id ?? null,
      userId: actor?.user.id ?? null,
      errorCode: error.code,
    });
    return reply.send({ ok: false, error });
  }

  function sendOk<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    data: T,
    operation: string,
    meta: { actor?: Actor; subjectId?: string | null; usageOperation?: string | null } = {},
  ) {
    log(request, reply, {
      operation,
      workspaceId: meta.actor?.workspace.id ?? null,
      userId: meta.actor?.user.id ?? null,
      subjectId: meta.subjectId ?? null,
      usageOperation: meta.usageOperation ?? null,
    });
    return reply.send({ ok: true, data });
  }

  /** Lay actor hoac tra loi. Dung cho moi route can workspace context. */
  async function withActor(
    request: FastifyRequest,
    reply: FastifyReply,
    operation: string,
    workspaceId: string | null,
  ): Promise<Actor | null> {
    const result = await resolveActor(ctx, bearerToken(request), workspaceId);
    if (!result.ok) {
      await sendError(request, reply, result.error, operation);
      return null;
    }
    return result.data;
  }

  async function respond<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    operation: string,
    actor: Actor,
    result: ServiceResult<T>,
    subjectId?: string | null,
  ) {
    if (!result.ok) return sendError(request, reply, result.error, operation, actor);
    return sendOk(request, reply, result.data, operation, { actor, subjectId: subjectId ?? null });
  }

  /*
   * Bat MOI loi cua framework va bien thanh ApiError cua he thong.
   * Neu khong co lop nay, Fastify tra thang { statusCode, code: 'FST_ERR_...', message }
   * - do la loi NOI BO ro ri ra ngoai va khong co translation key cho nguoi dung.
   */
  app.setErrorHandler((error, request, reply) => {
    const frameworkCode = typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : '';
    const mapped: ApiError =
      frameworkCode === 'FST_ERR_CTP_BODY_TOO_LARGE'
        ? apiError(ERROR_CODES.MCP_VAL_FILE_TOO_LARGE, { limitBytes: MAX_FILE_SIZE_BYTES })
        : frameworkCode.startsWith('FST_ERR_CTP') || frameworkCode === 'FST_ERR_VALIDATION' || error instanceof SyntaxError
          ? apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { reason: 'body' })
          : frameworkCode === 'FST_ERR_MAX_PARAM_LENGTH'
            ? apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_TICKET_INVALID)
            : apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { reason: 'unhandled' });
    return sendError(request, reply, mapped, 'framework_error');
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(request, reply, apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'route' }), 'not_found'),
  );

  /* ------------------------------------------------------------- health --- */

  /**
   * P2-MCP-26: duong goc.
   *
   * Nen tang trien khai kiem suc khoe container bang cach goi `/`. Truoc day duong nay tra 404
   * nen ban trien khai bi coi la hong va bi huy - du dich vu da len binh thuong.
   *
   * CO Y giu that mong: khong lo cau hinh, khong lo phien ban, khong lo gi de nguoi la dung duoc.
   * Muon biet trang thai that thi goi `/healthz`.
   */
  app.get('/', async (request, reply) => {
    return sendOk(request, reply, { ok: true, service: 'mediaclear-api' }, 'root');
  });

  app.get('/healthz', async (request, reply) => {
    const data = {
      ok: true,
      phase: PHASE,
      /*
       * P2-MCP-27: SUY RA tu registry, khong doc hang so cung nua.
       * Tu khi co provider TAT DINH, "co provider production" khong con dong nghia voi
       * "da bat xu ly AI". Dong nay phai noi dung mot dieu: co mo hinh AI nao dang chay khong.
       */
      productionAiProcessingEnabled:
        PRODUCTION_AI_PROCESSING_ENABLED || ctx.providers.listProductionAi().length > 0,
      routes: API_ROUTES.length,
      implementedRoutes: API_ROUTES.filter((r) => r.status === 'implemented').length,
      /*
       * P2-MCP-31: hien tai con SO KHONG - khong route nao con tra 501. Van phai dem chu khong
       * ghi cung 0: dem la loi tu khai kiem tra duoc, con hang so 0 se noi doi ngay lan dau co
       * mot route 'planned' moi duoc them vao bang.
       */
      plannedRoutes: API_ROUTES.filter((r) => (r.status as ApiRouteStatus) === 'planned').length,
      // Tu khai ha tang that su dang dung - khong giau la dang chay do tam.
      identityProvider: { id: ctx.identity.id, production: ctx.identity.isProductionProvider },
      persistence: { id: ctx.persistence.id, durability: ctx.persistence.durability },
      storage: { id: ctx.storage.id, production: ctx.storage.isProductionAdapter },
      mediaProbe: ctx.probe.id,
      productionProviders: ctx.providers.listProduction().length,
      uploadSecretProvided: ctx.config.uploadSecretProvided,
      internalApiEnabled: ctx.config.internalApiToken !== null,
      internalRoutes: API_ROUTES.filter((r) => r.status === 'internal').length,
      limits: {
        maxFileBytes: MEDIA_LIMITS.maxFileBytesInclusive,
        maxVideoDurationSeconds: MEDIA_LIMITS.video.maxDurationSecondsInclusive,
        maxVideoWidthPx: MEDIA_LIMITS.video.maxWidthPxInclusive,
        maxVideoHeightPx: MEDIA_LIMITS.video.maxHeightPxInclusive,
        imageMimeTypes: MEDIA_LIMITS.image.allowedMimeTypes,
        videoMimeTypes: MEDIA_LIMITS.video.allowedMimeTypes,
        rightsAttestationValidityDays: RIGHTS_STATEMENT.validityDays,
        rightsStatementVersion: RIGHTS_STATEMENT.version,
        usageReservationTtlSeconds: USAGE_RESERVATION_TTL_SECONDS,
        retentionPolicyVersion: RETENTION_POLICY_VERSION,
      },
    };
    log(request, reply, { operation: 'healthz' });
    return reply.send(data);
  });

  /* --------------------------------------------------------------- auth --- */

  app.post('/v1/auth/dev-session', async (request, reply) => {
    if (!ctx.config.devAuthEnabled) {
      return sendError(
        request,
        reply,
        apiError(ERROR_CODES.MCP_NOT_IMPLEMENTED, { reason: 'dev_auth_disabled' }),
        'auth.dev_session',
      );
    }
    const payload = body(request);
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    if (email.length === 0 || !email.includes('@')) {
      return sendError(request, reply, apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'email' }), 'auth.dev_session');
    }
    const displayName = typeof payload.displayName === 'string' ? payload.displayName : undefined;
    const { session, user } = await ctx.identity.signIn(
      displayName === undefined ? { email } : { email, displayName },
    );
    return sendOk(
      request,
      reply,
      {
        token: session.token,
        userId: user.id,
        expiresAt: session.expiresAt,
        productionAuthProvider: ctx.identity.isProductionProvider,
      },
      'auth.dev_session',
      { subjectId: user.id },
    );
  });

  /* ------------------------------------------------- P2-MCP-25: xac thuc that --- */

  /**
   * Doc email + mat khau tu body. Tra null neu thieu hoac sai kieu - khong tu "sua" gium,
   * vi doan y dinh o duong dang nhap la cho de sinh lo hong.
   */
  const credentials = (request: FastifyRequest): { email: string; password: string } | null => {
    const payload = body(request);
    const email = typeof payload.email === 'string' ? payload.email.trim() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';
    if (email.length === 0 || password.length === 0) return null;
    return { email, password };
  };

  app.post('/v1/auth/register', async (request, reply) => {
    const input = credentials(request);
    if (!input) {
      return sendError(request, reply, apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'email' }), 'auth.register');
    }
    const payload = body(request);
    const displayName = typeof payload.displayName === 'string' ? payload.displayName : undefined;
    const result = await ctx.passwordAuth.register(
      displayName === undefined ? input : { ...input, displayName },
    );
    if (!result.ok) return sendError(request, reply, result.error, 'auth.register');
    return sendOk(
      request,
      reply,
      {
        token: result.session.token,
        userId: result.user.id,
        expiresAt: result.session.expiresAt,
        productionAuthProvider: ctx.passwordAuth.isProductionProvider,
      },
      'auth.register',
      { subjectId: result.user.id },
    );
  });

  app.post('/v1/auth/sign-in', async (request, reply) => {
    const input = credentials(request);
    if (!input) {
      // Thieu truong cung tra ma loi thong tin dang nhap sai: khong noi thieu truong nao.
      return sendError(request, reply, apiError(ERROR_CODES.MCP_AUTH_INVALID_CREDENTIALS), 'auth.sign_in');
    }
    const result = await ctx.passwordAuth.signInWithPassword(input);
    if (!result.ok) return sendError(request, reply, result.error, 'auth.sign_in');
    return sendOk(
      request,
      reply,
      {
        token: result.session.token,
        userId: result.user.id,
        expiresAt: result.session.expiresAt,
        productionAuthProvider: ctx.passwordAuth.isProductionProvider,
      },
      'auth.sign_in',
      { subjectId: result.user.id },
    );
  });

  app.get('/v1/me', async (request, reply) => {
    const authed = await resolveUser(ctx, bearerToken(request));
    if (!authed.ok) return sendError(request, reply, authed.error, 'me.read');
    const memberships = await listWorkspacesForUser(ctx, authed.data.user.id);
    return sendOk(
      request,
      reply,
      {
        user: {
          id: authed.data.user.id,
          email: authed.data.user.email,
          displayName: authed.data.user.displayName,
          defaultLocale: authed.data.user.defaultLocale,
        },
        workspaces: memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, role: m.membership.role })),
      },
      'me.read',
      { subjectId: authed.data.user.id },
    );
  });

  /* --------------------------------------------------------- workspaces --- */

  app.get('/v1/workspaces', async (request, reply) => {
    const authed = await resolveUser(ctx, bearerToken(request));
    if (!authed.ok) return sendError(request, reply, authed.error, 'workspace.list');
    const rows = await listWorkspacesForUser(ctx, authed.data.user.id);
    return sendOk(
      request,
      reply,
      { items: rows.map((r) => ({ ...r.workspace, role: r.membership.role })), nextCursor: null },
      'workspace.list',
    );
  });

  app.post('/v1/workspaces', async (request, reply) => {
    const authed = await resolveUser(ctx, bearerToken(request));
    if (!authed.ok) return sendError(request, reply, authed.error, 'workspace.create');
    const result = await createWorkspace(ctx, authed.data.user.id, body(request).name);
    if (!result.ok) return sendError(request, reply, result.error, 'workspace.create');
    return sendOk(
      request,
      reply,
      { ...result.data.workspace, role: result.data.membership.role },
      'workspace.create',
      { subjectId: result.data.workspace.id },
    );
  });

  app.get('/v1/workspaces/:workspaceId', async (request, reply) => {
    const actor = await withActor(request, reply, 'workspace.read', param(request, 'workspaceId'));
    if (!actor) return reply;
    return sendOk(request, reply, { ...actor.workspace, role: actor.role }, 'workspace.read', {
      actor,
      subjectId: actor.workspace.id,
    });
  });

  app.get('/v1/workspaces/:workspaceId/members', async (request, reply) => {
    const actor = await withActor(request, reply, 'workspace.members.list', param(request, 'workspaceId'));
    if (!actor) return reply;
    return respond(request, reply, 'workspace.members.list', actor, await listMembers(ctx, actor));
  });

  app.post('/v1/workspaces/:workspaceId/members', async (request, reply) => {
    const actor = await withActor(request, reply, 'workspace.members.add', param(request, 'workspaceId'));
    if (!actor) return reply;
    const payload = body(request);
    const result = await addMember(ctx, actor, { email: payload.email, role: payload.role });
    return respond(request, reply, 'workspace.members.add', actor, result, result.ok ? result.data.id : null);
  });

  /*
   * P2-MCP-34: tai lieu OpenAPI, SINH tu bang route chu khong viet tay.
   *
   * Tra THANG tai lieu, khong boc trong `{ok, data}`: cong cu doc OpenAPI mong doi tai lieu o
   * muc goc cua phan hoi. Day la ngoai le CO CHU DICH voi quy uoc vo boc, giong `/healthz`.
   */
  app.get('/openapi.json', async (request, reply) => {
    log(request, reply, { operation: 'openapi.read' });
    return reply.send(buildOpenApiDocument());
  });

  app.get('/v1/workspaces/:workspaceId/audit-events', async (request, reply) => {
    const actor = await withActor(request, reply, 'audit.list', param(request, 'workspaceId'));
    if (!actor) return reply;
    const query = request.query as Record<string, string | undefined>;
    return respond(
      request,
      reply,
      'audit.list',
      actor,
      await listAuditEvents(ctx, actor, { cursor: query.cursor ?? null, limit: Number(query.limit ?? 50) }),
    );
  });

  /* ------------------------------------------------------------ projects --- */

  app.get('/v1/workspaces/:workspaceId/projects', async (request, reply) => {
    const actor = await withActor(request, reply, 'project.list', param(request, 'workspaceId'));
    if (!actor) return reply;
    const query = request.query as Record<string, string | undefined>;
    return respond(
      request,
      reply,
      'project.list',
      actor,
      await listProjects(ctx, actor, { cursor: query.cursor ?? null, limit: Number(query.limit ?? 50) }),
    );
  });

  app.post('/v1/workspaces/:workspaceId/projects', async (request, reply) => {
    const actor = await withActor(request, reply, 'project.create', param(request, 'workspaceId'));
    if (!actor) return reply;
    const result = await createProject(ctx, actor, body(request).name);
    return respond(request, reply, 'project.create', actor, result, result.ok ? result.data.id : null);
  });

  app.get('/v1/projects/:projectId', async (request, reply) => {
    const actor = await withActor(request, reply, 'project.read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'project.read', actor, await getProject(ctx, actor, param(request, 'projectId')));
  });

  app.get('/v1/projects/:projectId/assets', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.list', workspaceHeader(request));
    if (!actor) return reply;
    const query = request.query as Record<string, string | undefined>;
    return respond(
      request,
      reply,
      'asset.list',
      actor,
      await listAssets(ctx, actor, param(request, 'projectId'), {
        cursor: query.cursor ?? null,
        limit: Number(query.limit ?? 50),
      }),
    );
  });

  /* ------------------------------------------------- upload va storage --- */

  app.post('/v1/projects/:projectId/assets/upload-intent', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.upload_intent', workspaceHeader(request));
    if (!actor) return reply;
    const payload = body(request);
    const result = await createUploadIntent(ctx, actor, param(request, 'projectId'), {
      originalFilename: payload.originalFilename,
      mimeType: payload.mimeType,
      byteSize: payload.byteSize,
      mediaType: payload.mediaType,
    });
    return respond(request, reply, 'asset.upload_intent', actor, result, result.ok ? result.data.assetId : null);
  });

  /**
   * Nhan byte that. Xac thuc bang upload ticket (capability), khong bang session:
   * dung hop dong cua presigned URL. Ticket rang buoc bucket/key/content-type/kich thuoc/han dung.
   */
  app.put('/v1/storage/upload/:uploadToken', async (request, reply) => {
    const raw = request.body;
    if (!Buffer.isBuffer(raw)) {
      return sendError(request, reply, apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE), 'storage.upload');
    }
    const result = await completeUpload(ctx, param(request, 'uploadToken'), raw);
    if (!result.ok) return sendError(request, reply, result.error, 'storage.upload');
    return sendOk(request, reply, result.data, 'storage.upload', { subjectId: result.data.assetId });
  });

  app.get('/v1/storage/download/:downloadToken', async (request, reply) => {
    const ticket = ctx.storage.verifyTicket(param(request, 'downloadToken'), 'download', ctx.now().getTime());
    if (!ticket.ok) return sendError(request, reply, ticket.error, 'storage.download');
    const head = await ctx.storage.head({ bucket: ticket.payload.bucket, key: ticket.payload.key });
    if (!head.exists) {
      return sendError(request, reply, apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND), 'storage.download');
    }
    // P2-MCP-24: doc BYTE qua hop dong chung. Truoc day doc bang duong dan tep, nen bien
    // download chi chay duoc voi adapter local.
    const contentType = (await ctx.storage.contentTypeOf({ bucket: ticket.payload.bucket, key: ticket.payload.key })) ?? 'application/octet-stream';
    const bytes = Buffer.from(await ctx.storage.getObject({ bucket: ticket.payload.bucket, key: ticket.payload.key }));
    log(request, reply, { operation: 'storage.download' });
    /*
     * P2-MCP-33: khong co header nay thi trinh duyet MO tep ngay trong tab, va neu nguoi dung
     * bam luu thi ten tep la CA CHUOI VE da ky - dai hang tram ky tu va vo nghia. Bam tay moi
     * thay: nut "Tai tep ket qua" chuyen tab sang mot anh thay vi tai ve mot tep.
     *
     * Ten lay tu phan cuoi cua khoa object. Khoa do he thong tu sinh (`storageKeyFor`) nen
     * khong chua gi do nguoi dung dat - khong co duong chen ky tu la vao header.
     */
    const filename = ticket.payload.key.split('/').pop() ?? 'mediaclear-download';
    return reply
      .header('content-type', contentType)
      .header('content-disposition', `attachment; filename="${filename}"`)
      .send(bytes);
  });

  /* ------------------------------------ P2-MCP-35: tai len noi lai duoc --- */

  app.post('/v1/source-files/:sourceFileId/upload-session', async (request, reply) => {
    const actor = await withActor(request, reply, 'upload.session_open', workspaceHeader(request));
    if (!actor) return reply;
    const payload = body(request);
    const chunkSizeBytes = typeof payload.chunkSizeBytes === 'number' ? payload.chunkSizeBytes : undefined;
    return respond(
      request,
      reply,
      'upload.session_open',
      actor,
      await openUploadSession(ctx, actor, param(request, 'sourceFileId'), chunkSizeBytes),
    );
  });

  app.get('/v1/upload-sessions/:sessionId', async (request, reply) => {
    const actor = await withActor(request, reply, 'upload.session_read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'upload.session_read', actor, await getUploadSession(ctx, actor, param(request, 'sessionId')));
  });

  /*
   * Nhan BYTE THO cua mot manh. Dung chung bo phan tich nhi phan voi duong tai len mot lan
   * (`PUT /v1/storage/upload/:token`), nen `content-type` tuy y cung doc duoc.
   */
  app.put('/v1/upload-sessions/:sessionId/chunks/:chunkIndex', async (request, reply) => {
    const actor = await withActor(request, reply, 'upload.chunk_put', workspaceHeader(request));
    if (!actor) return reply;
    const raw = request.body;
    if (!Buffer.isBuffer(raw)) {
      return sendError(request, reply, apiError(ERROR_CODES.MCP_VAL_EMPTY_FILE), 'upload.chunk_put', actor);
    }
    const index = Number(param(request, 'chunkIndex'));
    return respond(
      request,
      reply,
      'upload.chunk_put',
      actor,
      await putUploadChunk(ctx, actor, param(request, 'sessionId'), index, raw),
    );
  });

  app.post('/v1/upload-sessions/:sessionId/complete', async (request, reply) => {
    const actor = await withActor(request, reply, 'upload.session_complete', workspaceHeader(request));
    if (!actor) return reply;
    const result = await completeUploadSession(ctx, actor, param(request, 'sessionId'));
    if (!result.ok) return sendError(request, reply, result.error, 'upload.session_complete', actor);
    return sendOk(request, reply, result.data, 'upload.session_complete', {
      actor,
      subjectId: result.data.assetId,
    });
  });

  /* ---------------------------------------- P3-MCP-30: ban proxy xem truoc --- */

  app.post('/v1/assets/:assetId/proxy', async (request, reply) => {
    const actor = await withActor(request, reply, 'proxy.create', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'proxy.create', actor, await createVideoProxy(ctx, actor, param(request, 'assetId')));
  });

  app.get('/v1/assets/:assetId/proxy', async (request, reply) => {
    const actor = await withActor(request, reply, 'proxy.read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'proxy.read', actor, await getVideoProxy(ctx, actor, param(request, 'assetId')));
  });

  app.get('/v1/assets/:assetId/proxy/download-url', async (request, reply) => {
    const actor = await withActor(request, reply, 'proxy.download', workspaceHeader(request));
    if (!actor) return reply;
    return respond(
      request,
      reply,
      'proxy.download',
      actor,
      await createVideoProxyDownloadUrl(ctx, actor, param(request, 'assetId')),
    );
  });

  /*
   * P3-MCP-34: danh sach preset. Cong khai va KHONG can dang nhap — day la thong tin ve nang luc
   * cua he thong, khong phai du lieu cua ai. `status` cua moi preset noi ve dieu he thong TU DO
   * DUOC, khong phai ve viec nen tang co chap nhan tep hay khong (Q-P3-04).
   */
  app.get('/v1/export-presets', async (request, reply) => {
    log(request, reply, { operation: 'preset.list' });
    return reply.send({ ok: true, data: { presets: EXPORT_PRESETS } });
  });

  app.get('/v1/assets/:assetId/download-url', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.download_url', workspaceHeader(request));
    if (!actor) return reply;
    return respond(
      request,
      reply,
      'asset.download_url',
      actor,
      await createAssetDownloadUrl(ctx, actor, param(request, 'assetId')),
    );
  });

  /* ------------------------------------------------------------- assets --- */

  app.get('/v1/assets/:assetId', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'asset.read', actor, await getAssetView(ctx, actor, param(request, 'assetId')));
  });

  app.post('/v1/assets/:assetId/validate', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.validate', workspaceHeader(request));
    if (!actor) return reply;
    const result = await validateAsset(ctx, actor, param(request, 'assetId'));
    return respond(request, reply, 'asset.validate', actor, result, param(request, 'assetId'));
  });

  /* ------------------------------------------------- rights attestation --- */

  app.post('/v1/assets/:assetId/rights-attestation', async (request, reply) => {
    const actor = await withActor(request, reply, 'rights.attest', workspaceHeader(request));
    if (!actor) return reply;
    const payload = body(request);
    const result = await createAttestation(ctx, actor, param(request, 'assetId'), {
      statementId: payload.statementId,
      statementVersion: payload.statementVersion,
      localeShown: payload.localeShown,
      accepted: payload.accepted,
    });
    return respond(request, reply, 'rights.attest', actor, result, result.ok ? result.data.id : null);
  });

  app.get('/v1/assets/:assetId/rights-attestation', async (request, reply) => {
    const actor = await withActor(request, reply, 'rights.read', workspaceHeader(request));
    if (!actor) return reply;
    const result = await getAttestation(ctx, actor, param(request, 'assetId'));
    if (!result.ok) return sendError(request, reply, result.error, 'rights.read', actor);
    return sendOk(
      request,
      reply,
      {
        attestation: result.data,
        statement: {
          id: RIGHTS_STATEMENT.id,
          version: RIGHTS_STATEMENT.version,
          i18nKey: RIGHTS_STATEMENT.i18nKey,
          validityDays: RIGHTS_STATEMENT.validityDays,
        },
      },
      'rights.read',
      { actor },
    );
  });

  /* --------------------------------------------------------------- jobs --- */

  app.post('/v1/assets/:assetId/jobs', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.create', workspaceHeader(request));
    if (!actor) return reply;
    const payload = body(request);
    const result = await createJob(ctx, actor, param(request, 'assetId'), {
      operations: payload.operations,
      regions: payload.regions,
      presetId: payload.presetId,
      idempotencyKey: payload.idempotencyKey,
    });
    if (!result.ok) return sendError(request, reply, result.error, 'job.create', actor);
    return sendOk(request, reply, result.data, 'job.create', {
      actor,
      subjectId: result.data.job.id,
      usageOperation: result.data.usage.state === 'reserved' ? 'reserve' : null,
    });
  });

  app.get('/v1/jobs/:jobId', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.read', actor, await getJob(ctx, actor, param(request, 'jobId')));
  });

  app.post('/v1/jobs/:jobId/cancel', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.cancel', workspaceHeader(request));
    if (!actor) return reply;
    const result = await cancelJob(ctx, actor, param(request, 'jobId'));
    if (!result.ok) return sendError(request, reply, result.error, 'job.cancel', actor);
    return sendOk(request, reply, result.data, 'job.cancel', {
      actor,
      subjectId: result.data.job.id,
      usageOperation: result.data.usage.state === 'released' ? 'release' : null,
    });
  });

  /*
   * P2-MCP-29. Hai route tach roi co chu dich: doc thong tin ban ket qua KHONG duoc keo theo
   * viec ky mot URL tai ve. URL tai ve co han rat ngan, nen moi lan xem trang lai duc ra mot
   * URL moi la vua thua vua kho theo dau vet ai that su tai tep ve.
   */
  app.get('/v1/jobs/:jobId/output', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.output_read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.output_read', actor, await getJobOutput(ctx, actor, param(request, 'jobId')));
  });

  app.get('/v1/jobs/:jobId/output/download-url', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.output_download', workspaceHeader(request));
    if (!actor) return reply;
    return respond(
      request,
      reply,
      'job.output_download',
      actor,
      await createJobOutputDownloadUrl(ctx, actor, param(request, 'jobId')),
    );
  });

  app.get('/v1/jobs/:jobId/receipt', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.receipt_read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.receipt_read', actor, await getJobReceipt(ctx, actor, param(request, 'jobId')));
  });

  /* --------------------------------------------------- P4: frame review (D-072) */

  app.get('/v1/jobs/:jobId/frames', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.frames_read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.frames_read', actor, await getJobFrames(ctx, actor, param(request, 'jobId')));
  });

  app.post('/v1/jobs/:jobId/frames/:frameIndex/correction', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.frame_correction', workspaceHeader(request));
    if (!actor) return reply;
    const body = (request.body ?? {}) as { box?: unknown };
    return respond(
      request, reply, 'job.frame_correction', actor,
      await correctJobFrame(ctx, actor, param(request, 'jobId'), Number(param(request, 'frameIndex')), body.box),
    );
  });

  /* --------------------------------------------------- P5: nguon goc & bo nhan dien */

  app.get('/v1/assets/:assetId/provenance', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.provenance', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'asset.provenance', actor,
      await getAssetProvenance(ctx, actor, param(request, 'assetId')));
  });

  app.get('/v1/jobs/:jobId/metadata', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.metadata', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.metadata', actor,
      await getJobMetadataComparison(ctx, actor, param(request, 'jobId')));
  });

  app.get('/v1/brand-kits', async (request, reply) => {
    const actor = await withActor(request, reply, 'brand_kit.list', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'brand_kit.list', actor, await listBrandKits(ctx, actor));
  });

  app.post('/v1/brand-kits', async (request, reply) => {
    const actor = await withActor(request, reply, 'brand_kit.create', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'brand_kit.create', actor, await createBrandKit(ctx, actor, request.body));
  });

  app.get('/v1/brand-kits/:brandKitId', async (request, reply) => {
    const actor = await withActor(request, reply, 'brand_kit.read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'brand_kit.read', actor,
      await getBrandKit(ctx, actor, param(request, 'brandKitId')));
  });

  app.post('/v1/brand-kits/:brandKitId/versions', async (request, reply) => {
    const actor = await withActor(request, reply, 'brand_kit.version', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'brand_kit.version', actor,
      await addBrandKitVersion(ctx, actor, param(request, 'brandKitId'), request.body));
  });

  app.post('/v1/brand-kits/:brandKitId/state', async (request, reply) => {
    const actor = await withActor(request, reply, 'brand_kit.state', workspaceHeader(request));
    if (!actor) return reply;
    const body = (request.body ?? {}) as { state?: unknown };
    return respond(request, reply, 'brand_kit.state', actor,
      await setBrandKitState(ctx, actor, param(request, 'brandKitId'), body.state));
  });

  app.post('/v1/jobs/:jobId/estimate', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.estimate', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.estimate', actor, await estimateJob(ctx, actor, param(request, 'jobId')));
  });

  /*
   * Preview KHONG ghi so muc dung (I-12). `usageOperation` de null co chu dich: nhat ky request
   * khong duoc ghi nham rang luot nay co dong vao muc dung cua ai do.
   */
  app.post('/v1/jobs/:jobId/preview', async (request, reply) => {
    const actor = await withActor(request, reply, 'job.preview', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'job.preview', actor, await previewJob(ctx, actor, param(request, 'jobId')));
  });

  app.get('/v1/usage', async (request, reply) => {
    const actor = await withActor(request, reply, 'usage.read', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'usage.read', actor, await getUsageSummary(ctx, actor));
  });

  /* --------------------------------------------- P1.1: luu giu du lieu --- */

  app.get('/v1/assets/:assetId/retention', async (request, reply) => {
    const actor = await withActor(request, reply, 'asset.retention', workspaceHeader(request));
    if (!actor) return reply;
    return respond(request, reply, 'asset.retention', actor, await retentionForAsset(ctx, actor, param(request, 'assetId')));
  });

  /* ------------------------------------------- P1.1: route van hanh --- */

  /**
   * Guard cho route noi bo: khong cau hinh khoa => route coi nhu KHONG TON TAI (404),
   * giong het duong dan la. Khong bao gio mo mac dinh, khong bao gio dung route cua
   * nguoi dung de chay viec van hanh.
   */
  function internalDenied(request: FastifyRequest, reply: FastifyReply, operation: string) {
    const configured = ctx.config.internalApiToken;
    const provided = request.headers['x-internal-token'];
    if (!configured || typeof provided !== 'string' || provided !== configured) {
      return sendError(
        request,
        reply,
        apiError(ERROR_CODES.MCP_RESOURCE_NOT_FOUND, { resource: 'route' }),
        operation,
      );
    }
    return null;
  }

  app.post('/v1/internal/usage-reservations/expire', async (request, reply) => {
    const denied = internalDenied(request, reply, 'internal.usage_expire');
    if (denied) return denied;
    const payload = body(request);
    const dryRun = payload.dryRun === true;
    const result = await expireReservations(ctx, { dryRun });
    return sendOk(request, reply, result, 'internal.usage_expire', {
      usageOperation: dryRun ? null : 'release',
    });
  });

  /**
   * P2-MCP-27: chay mot job da `queued`.
   *
   * De o duong NOI BO (tat mac dinh) thay vi chay dong bo luc tao job: worker cua P2-MCP-28
   * se goi dung ham `runJob` nay, nen khong phai viet lai logic o hai cho.
   */
  app.post('/v1/internal/jobs/run', async (request, reply) => {
    const denied = internalDenied(request, reply, 'internal.job_run');
    if (denied) return denied;
    const payload = body(request);
    const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : '';
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : '';
    if (workspaceId.length === 0 || jobId.length === 0) {
      return sendError(
        request,
        reply,
        apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'jobId' }),
        'internal.job_run',
      );
    }
    const outcome = await runJob(ctx, workspaceId, jobId);
    return sendOk(request, reply, outcome, 'internal.job_run', {
      subjectId: outcome.jobId,
      usageOperation: outcome.state === 'completed' ? 'commit' : null,
    });
  });

  app.post('/v1/internal/retention/dry-run', async (request, reply) => {
    const denied = internalDenied(request, reply, 'internal.retention_dry_run');
    if (denied) return denied;
    const payload = body(request);
    const asOfRaw = typeof payload.asOf === 'string' ? new Date(payload.asOf) : ctx.now();
    if (Number.isNaN(asOfRaw.getTime())) {
      return sendError(
        request,
        reply,
        apiError(ERROR_CODES.MCP_VAL_REQUEST_INVALID, { field: 'asOf' }),
        'internal.retention_dry_run',
      );
    }
    // Chi DEM. Khong co nhanh nao trong route nay xoa du lieu.
    const report = await retentionDryRunReport(ctx, {
      asOf: asOfRaw,
      workspaceId: typeof payload.workspaceId === 'string' ? payload.workspaceId : null,
      dataClass: typeof payload.dataClass === 'string' ? (payload.dataClass as never) : null,
    });
    return sendOk(request, reply, report, 'internal.retention_dry_run');
  });

  /* ------------------------------------- route chua hien thuc: van 501 --- */

  /*
   * P2-MCP-31: bang route hien KHONG con muc 'planned' nao, nen vong lap nay khong chay lan nao.
   * Giu no lai co chu dich - xoa di thi route 'planned' tiep theo se lang le khong co handler va
   * tra 404 thay vi 501, tuc la noi sai rang duong do khong ton tai.
   */
  for (const route of API_ROUTES as readonly { method: string; path: string; status: ApiRouteStatus }[]) {
    if (route.status !== 'planned') continue;
    const handler = async (request: FastifyRequest, reply: FastifyReply) => {
      const error = apiError(ERROR_CODES.MCP_NOT_IMPLEMENTED, { route: route.path });
      return sendError(request, reply, error, 'not_implemented');
    };
    if (route.method === 'GET') app.get(route.path, handler);
    else app.post(route.path, handler);
  }

  return Object.assign(app, { mediaclearContext: ctx, mediaclearRequestLog: requestLog });
}

const isEntrypoint = process.argv[1]?.endsWith('server.js') ?? false;
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 3001);
  const app = buildServer();
  const ctx = app.mediaclearContext;

  const bootstrap = async (): Promise<void> => {
    // P2-MCP-23: chay migration TRUOC khi nhan request dau tien. Neu luoc do chua san sang
    // thi tha khong khoi dong con hon nhan request roi hong giua chung.
    if (ctx.dbPool) {
      const dir = join(import.meta.dirname, '../../../db/migrations');
      const outcome = await runMigrations(ctx.dbPool, dir);
      console.log(
        `[mediaclear-api] migration: ap dung ${outcome.applied.length}, bo qua ${outcome.skipped.length}` +
          (outcome.checksumBackfilled.length > 0
            ? `, ghi bu tong kiem ${outcome.checksumBackfilled.length}`
            : ''),
      );
    }
    // P2-MCP-24: bucket phai san sang TRUOC khi nhan request. Thieu bucket ma van khoi dong
    // thi loi se no ra o giua luong upload cua nguoi dung - muon va kho hieu hon nhieu.
    if (ctx.config.s3 && ctx.storage instanceof S3CompatibleStorageAdapter) {
      const s3 = ctx.storage;
      if (!(await s3.bucketExists())) {
        if (!ctx.config.s3.createBucket) {
          throw new Error(
            `Bucket "${ctx.config.s3.bucket}" khong ton tai hoac khong doc duoc tren ` +
              `${ctx.config.s3.endpoint}. Tao san bucket, hoac dat MEDIACLEAR_S3_CREATE_BUCKET=1 ` +
              'neu muon he thong tu tao (chi nen dung o dev).',
          );
        }
        await s3.createBucket();
        console.log(`[mediaclear-api] da tao bucket "${ctx.config.s3.bucket}"`);
      }
      console.log(`[mediaclear-api] object storage: ${ctx.storage.id} · bucket ${ctx.config.s3.bucket}`);
    }

    await app.listen({ port, host: '0.0.0.0' });
    console.log(
      `[mediaclear-api] ${PHASE} on :${port} · luu tru ${ctx.persistence.id} (${ctx.persistence.durability})`,
    );
  };

  bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
