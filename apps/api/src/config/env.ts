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
  /**
   * P2-MCP-23: chuoi ket noi PostgreSQL. KHONG co => chay in-memory y nhu truoc.
   * Khong co che do "tu doan": co thi dung PostgreSQL, khong thi dung in-memory.
   */
  databaseUrl: string | null;
  /**
   * P2-MCP-24: cau hinh object storage S3-compatible (R2 / MinIO / S3).
   * KHONG co endpoint => dung adapter dia local y nhu truoc. Khong co che do tu doan.
   */
  /**
   * P2-MCP-24: cau hinh object storage S3-compatible (R2/MinIO/S3). Thieu BAT KY manh bat buoc
   * nao => dung adapter dia local nhu cu. Khong co che do "tu doan".
   */
  s3: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    forcePathStyle: boolean;
    /** Chi tao bucket khi duoc cho phep ro rang. Mac dinh TAT. */
    createBucket: boolean;
  } | null;
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
    databaseUrl: readDatabaseUrl(env),
    s3: readS3Config(env),
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

/**
 * P2-MCP-26: chuoi ket noi PostgreSQL.
 *
 * Uu tien bien RIENG cua he thong (`MEDIACLEAR_DATABASE_URL`), roi moi den `DATABASE_URL` -
 * ten ma hau het nen tang trien khai TU TIEM khi gan mot co so du lieu vao ung dung.
 * Khong doc tiep cac ten khac (POSTGRES_URL, DB_URL...) du chung cung duoc tiem: cang nhieu
 * nguon cang de roi vao tinh huong hai bien tro ve hai co so du lieu khac nhau.
 */
function readDatabaseUrl(env: NodeJS.ProcessEnv): string | null {
  for (const key of ['MEDIACLEAR_DATABASE_URL', 'DATABASE_URL'] as const) {
    const value = env[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/**
 * P2-MCP-24. Thieu BAT KY manh nao trong bo bat buoc thi tra null - chay dia local.
 * Khong tu dien mac dinh cho khoa truy cap: mot cau hinh thieu mot nua con nguy hiem hon
 * la khong cau hinh, vi no chay duoc mot luc roi hong giua chung.
 */
function readS3Config(env: NodeJS.ProcessEnv): ApiConfig['s3'] {
  const endpoint = env.MEDIACLEAR_S3_ENDPOINT ?? '';
  const accessKeyId = env.MEDIACLEAR_S3_ACCESS_KEY_ID ?? '';
  const secretAccessKey = env.MEDIACLEAR_S3_SECRET_ACCESS_KEY ?? '';
  const bucket = env.MEDIACLEAR_S3_BUCKET ?? '';
  if (endpoint.length === 0 || accessKeyId.length === 0 || secretAccessKey.length === 0 || bucket.length === 0) {
    return null;
  }
  return {
    endpoint,
    region: env.MEDIACLEAR_S3_REGION ?? 'auto',
    accessKeyId,
    secretAccessKey,
    bucket,
    // MinIO can path-style; R2 chap nhan ca hai. Mac dinh bat cho an toan.
    forcePathStyle: env.MEDIACLEAR_S3_FORCE_PATH_STYLE !== 'false' && env.MEDIACLEAR_S3_FORCE_PATH_STYLE !== '0',
    createBucket: env.MEDIACLEAR_S3_CREATE_BUCKET === '1',
  };
}
