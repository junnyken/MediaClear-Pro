'use client';

/**
 * Client goi API that (Phase 1). Khong co du lieu mau, khong co man hinh gia:
 * moi so tren UI deu den tu mot response that.
 */
import { DEFAULT_LOCALE, t, type Locale } from '@mediaclear/i18n';

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
}

export function apiBaseUrl(): string {
  if (typeof window !== 'undefined' && typeof window.__MCP_API_BASE__ === 'string' && window.__MCP_API_BASE__.length > 0) {
    return window.__MCP_API_BASE__;
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

export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; workspaceId?: string | null } = {},
): Promise<ApiResult<T>> {
  const session = readSession();
  // Chi khai content-type khi THAT SU co body: POST khong tham so ma van khai
  // application/json se bi tang HTTP tu choi truoc khi vao ung dung.
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (session.token) headers.authorization = `Bearer ${session.token}`;
  const workspaceId = init.workspaceId ?? session.workspaceId;
  if (workspaceId) headers['x-workspace-id'] = workspaceId;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
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

/** Hien thi loi cho nguoi dung: luon qua translation key, khong bao gio in ma loi tho. */
export function errorText(error: ApiErrorShape): string {
  return translate(error.messageKey, error.params);
}
