/**
 * MediaClear Pro - Object storage abstraction (MCP-10).
 *
 * Owner decision Q-01 (2026-09-15):
 *   Primary database: PostgreSQL
 *   Object storage: S3-compatible abstraction
 *   Initial production target: Cloudflare R2 (subject to final deployment review)
 *
 * Rang buoc: domain logic KHONG duoc phu thuoc truc tiep vao Cloudflare R2.
 * Moi truy cap di qua ObjectStorageAdapter; dev/test dung adapter local/MinIO.
 * PostgreSQL chi luu domain state - KHONG luu media binary.
 */
import { ERROR_CODES, apiError, type ApiError } from './errors.js';

export const STORAGE_TARGET = {
  protocol: 's3_compatible',
  initialProductionTarget: 'cloudflare_r2',
  /** Chua qua deployment review cuoi cung => khong coi la chot ha tang. */
  deploymentReviewStatus: 'pending',
} as const;

/** Media binary KHONG bao gio nam trong PostgreSQL. */
export const MEDIA_BINARY_IN_DATABASE = false;

export type StorageClass = 'source' | 'output' | 'preview';

export interface StorageObjectRef {
  bucket: string;
  key: string;
}

export interface SignedUrl {
  url: string;
  expiresAt: string;
}

export interface StorageObjectHead {
  exists: boolean;
  byteSize: number | null;
  checksumSha256: string | null;
}

export interface CreateUploadUrlInput {
  ref: StorageObjectRef;
  contentType: string;
  maxByteSize: number;
  ttlSeconds: number;
}

/**
 * Adapter S3-compatible. Moi hien thuc (R2, MinIO, local) deu phai tuan thu.
 * KHONG co method nao cho phep ghi de object class 'source'.
 */
export interface ObjectStorageAdapter {
  id: string;
  /** false = chi dung cho dev/test, khong duoc phuc vu traffic that. */
  readonly isProductionAdapter: boolean;
  createUploadUrl(input: CreateUploadUrlInput): Promise<SignedUrl>;
  createDownloadUrl(ref: StorageObjectRef, ttlSeconds: number): Promise<SignedUrl>;
  head(ref: StorageObjectRef): Promise<StorageObjectHead>;
  /** Chi dung cho output/preview. Goi voi class 'source' da ton tai => loi. */
  putObject(ref: StorageObjectRef, body: Uint8Array, contentType: string): Promise<void>;
  deleteObject(ref: StorageObjectRef): Promise<void>;
}

/** Khoa luu tru co cau truc: <workspaceId>/<class>/<id><ext>. */
export function storageKeyFor(
  workspaceId: string,
  storageClass: StorageClass,
  id: string,
  extension: string,
): string {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${workspaceId}/${storageClass}/${id}${ext}`;
}

export function storageClassOf(key: string): StorageClass | null {
  const part = key.split('/')[1];
  return part === 'source' || part === 'output' || part === 'preview' ? part : null;
}

/**
 * Invariant I-1 o tang luu tru: khong bao gio ghi de mot object class 'source'.
 * Tra ApiError neu thao tac ghi vi pham; null neu hop le.
 */
export function assertWritableKey(key: string, objectAlreadyExists: boolean): ApiError | null {
  if (storageClassOf(key) === 'source' && objectAlreadyExists) {
    return apiError(ERROR_CODES.MCP_STORAGE_WRITE_DENIED, { reason: 'source_immutable' });
  }
  return null;
}
