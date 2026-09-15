/**
 * MediaClear Pro - cau hinh runtime cua API (Phase 1).
 *
 * KHONG hard-code secret. Thieu secret => sinh secret ngau nhien cho PHIEN chay nay
 * va tu khai `uploadSecretProvided=false` o /healthz, de khong ai nham tuong da cau hinh.
 */
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface ApiConfig {
  /** Thu muc goc cua object storage local. KHONG bao gio la thu muc repo. */
  dataDir: string;
  /** Khoa ky upload ticket. */
  uploadSecret: string;
  uploadSecretProvided: boolean;
  /** Dev identity provider: chi bat ngoai production. */
  devAuthEnabled: boolean;
  sessionTtlSeconds: number;
  uploadTicketTtlSeconds: number;
  downloadUrlTtlSeconds: number;
  /** Base URL de dung upload URL tra ve cho client. */
  publicBaseUrl: string;
  /** CORS: chi dung Bearer token (khong cookie) nen '*' an toan cho dev. */
  corsAllowOrigin: string;
  /**
   * P1.1: khoa cho route /v1/internal/*. Khong cau hinh => route noi bo TAT han
   * (tra 404 nhu duong dan khong ton tai), khong bao gio mo mac dinh.
   */
  internalApiToken: string | null;
  environment: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const environment = env.NODE_ENV ?? 'development';
  const secret = env.MEDIACLEAR_UPLOAD_SECRET ?? '';
  return {
    dataDir: env.MEDIACLEAR_DATA_DIR ?? join(tmpdir(), 'mediaclear-data'),
    uploadSecret: secret.length > 0 ? secret : randomBytes(32).toString('hex'),
    uploadSecretProvided: secret.length > 0,
    // Mac dinh TAT o production: khong bao gio de cua dev auth mo tren that.
    devAuthEnabled: env.MEDIACLEAR_DEV_AUTH === '1' || (environment !== 'production' && env.MEDIACLEAR_DEV_AUTH !== '0'),
    sessionTtlSeconds: Number(env.MEDIACLEAR_SESSION_TTL_SECONDS ?? 60 * 60 * 12),
    uploadTicketTtlSeconds: Number(env.MEDIACLEAR_UPLOAD_TTL_SECONDS ?? 60 * 15),
    downloadUrlTtlSeconds: Number(env.MEDIACLEAR_DOWNLOAD_TTL_SECONDS ?? 60 * 5),
    publicBaseUrl: env.MEDIACLEAR_PUBLIC_BASE_URL ?? `http://localhost:${env.PORT ?? 3001}`,
    corsAllowOrigin: env.MEDIACLEAR_CORS_ORIGIN ?? '*',
    internalApiToken: env.MEDIACLEAR_INTERNAL_TOKEN && env.MEDIACLEAR_INTERNAL_TOKEN.length >= 16
      ? env.MEDIACLEAR_INTERNAL_TOKEN
      : null,
    environment,
  };
}
