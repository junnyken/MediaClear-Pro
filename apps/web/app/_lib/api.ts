'use client';

/**
 * Client goi API that (Phase 1). Khong co du lieu mau, khong co man hinh gia:
 * moi so tren UI deu den tu mot response that.
 */
import { DEFAULT_LOCALE, t, type Locale } from '@mediaclear/i18n';
import type { schema } from '@mediaclear/contracts';

export interface ApiErrorShape {
  code: string;
  messageKey: string;
  params?: Record<string, string | number>;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiErrorShape };

/**
 * P2-MCP-26: dia chi API doc LUC CHAY, khong phai luc build.
 *
 * `NEXT_PUBLIC_*` bi Next NHUNG THANG vao bundle khi build. Nghia la doi dia chi API la phai
 * build lai toan bo web - khong dung duoc khi trien khai len nen tang cap ten mien sau khi build.
 * Vi vay layout (server component) tiem dia chi vao `window.__MCP_API_BASE__`, va day doc no truoc.
 *
 * Thu tu: bien luc chay -> bien luc build -> mac dinh dev.
 */
declare global {
  var __MCP_API_BASE__: string | undefined;
  /** `true` = goi API qua cung mot goc voi giao dien. Xem `apiBaseUrl()`. */
  var __MCP_SAME_ORIGIN__: boolean | undefined;
}

export function apiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    /*
     * CUNG GOC: goi `/v1/...` tren chinh dia chi cua giao dien, va may chu Next chuyen tiep sang
     * API (xem `next.config.mjs`).
     *
     * Can thiet khi may chu chay trong container/workspace tu xa: `http://127.0.0.1:3301` dung o
     * BEN TRONG nhung sai o TRINH DUYET — `127.0.0.1` khi do la may CUA NGUOI DUNG. Trang van hien
     * ra binh thuong roi bao "Khong ket noi duoc may chu", va nguoi doc de tuong may chu da chet.
     *
     * Phai kiem co NAY TRUOC: chuoi rong o `__MCP_API_BASE__` mang nghia "chua dat bien", khong
     * mang nghia "cung goc".
     */
    if (window.__MCP_SAME_ORIGIN__ === true) return '';
    if (typeof window.__MCP_API_BASE__ === 'string' && window.__MCP_API_BASE__.length > 0) {
      return window.__MCP_API_BASE__;
    }
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
}

/** Giu ten cu cho cho goi san; gia tri duoc tinh lai moi lan doc. */
export const API_BASE = apiBaseUrl();

const TOKEN_KEY = 'mediaclear.session.token';
const WORKSPACE_KEY = 'mediaclear.workspace.id';

export function readSession(): { token: string | null; workspaceId: string | null } {
  if (typeof window === 'undefined') return { token: null, workspaceId: null };
  return {
    token: window.localStorage.getItem(TOKEN_KEY),
    workspaceId: window.localStorage.getItem(WORKSPACE_KEY),
  };
}

export function writeSession(token: string | null, workspaceId?: string | null): void {
  if (typeof window === 'undefined') return;
  if (token === null) window.localStorage.removeItem(TOKEN_KEY);
  else window.localStorage.setItem(TOKEN_KEY, token);
  if (workspaceId === null) window.localStorage.removeItem(WORKSPACE_KEY);
  else if (workspaceId !== undefined) window.localStorage.setItem(WORKSPACE_KEY, workspaceId);
}

/** Loi phia client: dung tien to UI_ de khong bao gio bi nham voi ma loi cua may chu. */
export const UI_ERROR = {
  NETWORK: { code: 'UI_NETWORK_ERROR', messageKey: 'ui.error.network' },
  UNKNOWN: { code: 'UI_UNKNOWN_ERROR', messageKey: 'ui.error.unknown' },
} as const;

export interface ApiInit {
  method?: string;
  body?: unknown;
  /** `D-077`: byte tho (tep logo). Loai tru voi `body`. */
  rawBody?: ArrayBuffer;
  contentType?: string;
  workspaceId?: string | null;
}

export async function apiFetch<T>(
  path: string,
  init: ApiInit = {},
): Promise<ApiResult<T>> {
  const session = readSession();
  // Chi khai content-type khi THAT SU co body: POST khong tham so ma van khai
  // application/json se bi tang HTTP tu choi truoc khi vao ung dung.
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  /*
   * `D-077` — byte THO cho tep logo.
   *
   * Khong nhet anh vao JSON: ma hoa base64 phong to 33% va bat ca hai ben lam viec khong can thiet.
   * `content-type` o day chi de may chu DOI CHIEU — may chu do kieu tep tren chinh byte.
   */
  if (init.rawBody !== undefined) headers['content-type'] = init.contentType ?? 'application/octet-stream';
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  const workspaceId = init.workspaceId ?? session.workspaceId;
  if (workspaceId) headers['x-workspace-id'] = workspaceId;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.rawBody !== undefined
        ? init.rawBody
        : init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    return { ok: false, error: { ...UI_ERROR.NETWORK } };
  }

  try {
    const payload = (await response.json()) as ApiResult<T>;
    return payload;
  } catch {
    return { ok: false, error: { ...UI_ERROR.UNKNOWN } };
  }
}

/** Day byte that len upload URL do may chu ky. */
export async function apiUpload(uploadUrl: string, file: File): Promise<ApiResult<{ assetId: string }>> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
    return (await response.json()) as ApiResult<{ assetId: string }>;
  } catch {
    return { ok: false, error: { ...UI_ERROR.NETWORK } };
  }
}

export interface HealthResponse {
  ok: boolean;
  phase: string;
  productionAiProcessingEnabled: boolean;
  limits: {
    maxFileBytes: number;
    maxVideoDurationSeconds: number;
    maxVideoWidthPx: number;
    maxVideoHeightPx: number;
    imageMimeTypes: string[];
    videoMimeTypes: string[];
    rightsAttestationValidityDays: number;
  };
}

/**
 * /healthz la probe ha tang nen tra DOI TUONG PHANG, khong dung bao {ok,data}
 * nhu cac route /v1/*. Doc thang o day de UI khong bi ket o trang thai "dang tai".
 */
export async function fetchHealth(): Promise<ApiResult<HealthResponse>> {
  try {
    const response = await fetch(`${apiBaseUrl()}/healthz`);
    const payload = (await response.json()) as HealthResponse;
    if (!payload || typeof payload.phase !== 'string') return { ok: false, error: { ...UI_ERROR.UNKNOWN } };
    return { ok: true, data: payload };
  } catch {
    return { ok: false, error: { ...UI_ERROR.NETWORK } };
  }
}

export function translate(key: string, params?: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  return t(locale, key, params);
}

/**
 * Nhan cho mot loai su kien o trang Nhat ky.
 *
 * Vi sao khong goi thang `translate()`: `recordAudit` nhan `eventType: string` chu KHONG phai mot
 * union, va `t()` tra ve CHINH KHOA khi thieu. Nen mot loai su kien la — dong cu trong co so du
 * lieu, hoac mot cho goi moi quen them nhan — se hien nguyen `audit_event.<gi do>` ra man hinh
 * nguoi dung. Phep chan i18n chi soi danh sach `AUDIT_EVENTS` DANG co trong ma; no khong the bao
 * ve luc chay truoc mot gia tri chua tung biet. Day la duong lui cuoi cung.
 */
export function auditEventLabel(eventType: string): string {
  const key = `audit_event.${eventType}`;
  const text = translate(key);
  return text === key ? translate('audit_event.unknown') : text;
}

/** Hien thi loi cho nguoi dung: luon qua translation key, khong bao gio in ma loi tho. */
export function errorText(error: ApiErrorShape): string {
  return translate(error.messageKey, error.params);
}

/**
 * P3-MCP-30…34: doc du lieu tu may chu CO KIEM LUC CHAY (dong D-047).
 *
 * `apiFetch<T>` chi la mot loi KHANG DINH kieu — khong ai kiem. Doi hinh dang phan hoi o may chu
 * lam trang hong LUC CHAY trong khi `tsc` ca hai ben deu xanh; da xay ra that o trang Hoat dong.
 *
 * Ham nay dung CHINH lich kiem ma may chu dung (`@mediaclear/contracts`), nen khong the co hai
 * khai bao troi khac nhau. Phan hoi sai hinh dang tra ve mot `ApiErrorShape` — giao dien hien loi
 * tu te thay vi vo.
 */
export async function apiFetchChecked<T>(
  path: string,
  /*
   * Dung THANG `Schema<T>` cua contracts, khong phai mot kieu cau truc tuong duong: kieu cau truc
   * lam TypeScript khong suy ra duoc `T` va moi phan hoi tro thanh `{}` — dung luc do thi giao
   * dien lai mat kieu, tuc la mat chinh thu ma D-047 di sua.
   */
  schema: schema.Schema<T>,
  init: ApiInit = {},
): Promise<ApiResult<T>> {
  const raw = await apiFetch<unknown>(path, init);
  if (!raw.ok) return raw;
  const checked = schema.check(raw.data, 'response.data');
  if (checked.ok) return { ok: true, data: checked.value };
  // Lo ra o console de nguoi phat trien thay NGAY; nguoi dung thi thay mot loi co ma on dinh.
  if (typeof console !== 'undefined') console.error('[contract] phan hoi sai hinh dang:', checked.errors);
  return { ok: false, error: { code: 'MCP_VAL_REQUEST_INVALID', messageKey: 'errors.mcp_val_request_invalid' } };
}
