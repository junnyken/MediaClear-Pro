/**
 * Sinh tai lieu OpenAPI TU BANG ROUTE, khong viet tay (P2-MCP-34).
 *
 * Vi sao khong viet tay: mot tai lieu viet tay se troi khoi ma nguon, va tai lieu mo ta mot API
 * KHAC voi API that thi con te hon khong co tai lieu - nguoi doc tin no. `API_ROUTES` da la
 * nguon su that duy nhat cho danh sach duong dan (co test doi chieu voi server that), nen sinh
 * tu do la cach duy nhat bao dam hai ben khong lech.
 *
 * TAI LIEU NAY CO Y KHONG mo ta schema rieng cho tung route. Ly do: khong co gi kiem chung duoc
 * nhung schema do - viet ra la khai mot thu khong ai do. Dung loi ma `P2-MCP-32` vua vap: kieu
 * cua giao dien va kieu cua may chu la hai khai bao roi nhau nen ca hai deu "xanh" trong khi
 * thuc te lech. Cai tai lieu nay khai la thu KIEM CHUNG DUOC: duong dan, phuong thuc, trang
 * thai hien thuc, yeu cau xac thuc, va hinh dang VO BOC chung cua moi phan hoi.
 */
import { API_ROUTES, type ApiRouteStatus } from './api.js';
import { ALL_ERROR_CODES, ERROR_CATALOGUE, errorI18nKey } from './errors.js';

export const OPENAPI_VERSION = '3.1.0';

/** Doi `/v1/jobs/:jobId` sang `/v1/jobs/{jobId}` theo cu phap OpenAPI. */
export function toOpenApiPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

/** Ten cac tham so duong dan, lay tu chinh duong dan. */
export function pathParamsOf(path: string): string[] {
  return [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1] as string);
}

interface OpenApiOperation {
  operationId: string;
  summary: string;
  tags: string[];
  security?: Array<Record<string, string[]>>;
  parameters?: Array<Record<string, unknown>>;
  responses: Record<string, unknown>;
}

function operationIdFor(method: string, path: string): string {
  const cleaned = path.replace(/^\/+/, '').replace(/[/{}:]/g, '_').replace(/_+/g, '_').replace(/_$/, '');
  return `${method.toLowerCase()}_${cleaned}`;
}

/**
 * Cau tom tat noi THAT ve trang thai cua route. Mot route `planned` van xuat hien trong tai
 * lieu - giau di se khien nguoi doc tuong no khong ton tai, trong khi no co that va tra 501.
 */
function summaryFor(status: ApiRouteStatus, mcp: string): string {
  const note: Record<ApiRouteStatus, string> = {
    implemented: 'Da hien thuc va co test HTTP that.',
    planned: 'CHUA hien thuc - luon tra 501 MCP_NOT_IMPLEMENTED.',
    dev_only: 'Chi song trong moi truong dev; tat o production.',
    internal: 'Route van hanh noi bo; TAT mac dinh, chi song khi co khoa noi bo.',
  };
  return `${note[status]} (${mcp})`;
}

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, OpenApiOperation>> = {};

  for (const route of API_ROUTES) {
    const oaPath = toOpenApiPath(route.path);
    const status = route.status as ApiRouteStatus;
    const params = pathParamsOf(route.path);

    const operation: OpenApiOperation = {
      operationId: operationIdFor(route.method, route.path),
      summary: summaryFor(status, route.mcp),
      tags: [route.mcp],
      responses: {
        '200': { $ref: '#/components/responses/Ok' },
        default: { $ref: '#/components/responses/Error' },
      },
    };
    // Duong dan cong khai: chi `/`, `/healthz` va cac duong xac thuc.
    const isPublic = route.path === '/' || route.path === '/healthz' || route.path.startsWith('/v1/auth/') || route.path.startsWith('/v1/storage/');
    if (!isPublic) operation.security = [{ bearerAuth: [] }];
    if (params.length > 0) {
      operation.parameters = params.map((name) => ({
        name,
        in: 'path',
        required: true,
        schema: { type: 'string' },
      }));
    }
    paths[oaPath] ??= {};
    (paths[oaPath] as Record<string, OpenApiOperation>)[route.method.toLowerCase()] = operation;
  }

  return {
    openapi: OPENAPI_VERSION,
    info: {
      title: 'MediaClear Pro API',
      version: '0.0.0-phase2',
      description:
        'Tai lieu nay duoc SINH tu bang route trong ma nguon, khong viet tay. No khai duong dan, ' +
        'phuong thuc, trang thai hien thuc va hinh dang vo boc chung cua phan hoi. No CO Y khong ' +
        'mo ta schema rieng cho tung route, vi hien khong co gi kiem chung duoc nhung schema do.',
    },
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer' },
      },
      schemas: {
        /** Vo boc chung cua MOI phan hoi thanh cong. Co test HTTP that kiem hinh dang nay. */
        OkEnvelope: {
          type: 'object',
          required: ['ok', 'data'],
          properties: { ok: { const: true }, data: {} },
        },
        /** Vo boc chung cua MOI phan hoi loi. `messageKey` la KHOA i18n, khong phai cau da dich. */
        ErrorEnvelope: {
          type: 'object',
          required: ['ok', 'error'],
          properties: {
            ok: { const: false },
            error: {
              type: 'object',
              required: ['code', 'messageKey'],
              properties: {
                code: { type: 'string', enum: [...ALL_ERROR_CODES] },
                messageKey: { type: 'string' },
                params: { type: 'object' },
              },
            },
          },
        },
      },
      responses: {
        Ok: {
          description: 'Thanh cong',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/OkEnvelope' } } },
        },
        Error: {
          description: 'Loi - luon dung vo boc nay, khong bao gio tra text da dich',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
        },
      },
    },
    'x-mediaclear-error-catalogue': ALL_ERROR_CODES.map((code) => ({
      code,
      httpStatus: ERROR_CATALOGUE[code].httpStatus,
      messageKey: errorI18nKey(code),
    })),
  };
}
