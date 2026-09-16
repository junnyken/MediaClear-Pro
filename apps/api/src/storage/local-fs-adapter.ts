/**
 * LocalFsStorageAdapter - hien thuc ObjectStorageAdapter tren dia.
 *
 * DAY KHONG PHAI ADAPTER PRODUCTION (`isProductionAdapter = false`): khong co
 * replication, khong lifecycle, khong CDN. Ton tai de Phase 1 chay that ma khong
 * phai gia vo da co R2/MinIO. Doi sang R2/MinIO = thay implementation cung port.
 *
 * Presigned URL duoc mo phong bang ticket ky HMAC tro ve chinh API.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import {
  ERROR_CODES,
  apiError,
  assertWritableKey,
  type ApiError,
  type CreateUploadUrlInput,
  type ObjectStorageAdapter,
  type SignedUrl,
  type StorageObjectHead,
  type StorageObjectRef,
} from '@mediaclear/contracts';
import { assertSafeObjectKey } from './object-key.js';

export interface UploadTicketPayload {
  bucket: string;
  key: string;
  contentType: string;
  maxByteSize: number;
  /** epoch giay */
  exp: number;
  /** 'upload' | 'download' - ticket khong dung cheo muc dich duoc. */
  use: 'upload' | 'download';
}

export interface LocalFsStorageOptions {
  rootDir: string;
  bucket: string;
  /** Base URL cua API, de dung URL tra ve cho client. */
  publicBaseUrl: string;
  signingSecret: string;
}

interface ObjectMeta {
  contentType: string;
  byteSize: number;
  checksumSha256: string;
}

export class LocalFsStorageAdapter implements ObjectStorageAdapter {
  readonly id = 'local-fs-phase1';
  readonly isProductionAdapter = false;
  readonly bucket: string;

  private readonly rootDir: string;
  private readonly publicBaseUrl: string;
  private readonly secret: string;

  constructor(options: LocalFsStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '');
    this.secret = options.signingSecret;
  }

  /** Duong dan that tren dia; nem loi neu khoa co the thoat ra ngoai rootDir. */
  private pathFor(ref: StorageObjectRef, kind: 'object' | 'meta'): string {
    const invalid = assertSafeObjectKey(ref.key);
    if (invalid) throw new StorageError(invalid);
    const suffix = kind === 'meta' ? '.meta.json' : '';
    const full = resolve(join(this.rootDir, kind, ref.bucket, `${ref.key}${suffix}`));
    const base = resolve(join(this.rootDir, kind, ref.bucket));
    // Chan path traversal lan hai (that lung + day deo): duong dan phai nam trong base.
    if (full !== base && !full.startsWith(base + sep)) {
      throw new StorageError(apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_FAILED, { reason: 'path_escape' }));
    }
    return full;
  }

  sign(payload: UploadTicketPayload): string {
    const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${signature}`;
  }

  /** Tra payload neu ticket hop le; nguoc lai tra ApiError (khong nem lo chi tiet ra ngoai). */
  verifyTicket(token: string, use: 'upload' | 'download', nowMs = Date.now()): { ok: true; payload: UploadTicketPayload } | { ok: false; error: ApiError } {
    const invalid = { ok: false as const, error: apiError(ERROR_CODES.MCP_STORAGE_UPLOAD_TICKET_INVALID) };
    const dot = token.lastIndexOf('.');
    if (dot <= 0) return invalid;
    const body = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    const expected = createHmac('sha256', this.secret).update(body).digest('base64url');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return invalid;
    let payload: UploadTicketPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as UploadTicketPayload;
    } catch {
      return invalid;
    }
    if (payload.use !== use) return invalid;
    if (!Number.isFinite(payload.exp) || payload.exp * 1000 < nowMs) return invalid;
    if (assertSafeObjectKey(payload.key)) return invalid;
    return { ok: true, payload };
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<SignedUrl> {
    const exp = Math.floor(Date.now() / 1000) + input.ttlSeconds;
    const token = this.sign({
      bucket: input.ref.bucket,
      key: input.ref.key,
      contentType: input.contentType,
      maxByteSize: input.maxByteSize,
      exp,
      use: 'upload',
    });
    return { url: `${this.publicBaseUrl}/v1/storage/upload/${token}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  async createDownloadUrl(ref: StorageObjectRef, ttlSeconds: number): Promise<SignedUrl> {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = this.sign({
      bucket: ref.bucket,
      key: ref.key,
      contentType: 'application/octet-stream',
      maxByteSize: 0,
      exp,
      use: 'download',
    });
    return { url: `${this.publicBaseUrl}/v1/storage/download/${token}`, expiresAt: new Date(exp * 1000).toISOString() };
  }

  async head(ref: StorageObjectRef): Promise<StorageObjectHead> {
    try {
      const meta = JSON.parse(await readFile(this.pathFor(ref, 'meta'), 'utf8')) as ObjectMeta;
      return { exists: true, byteSize: meta.byteSize, checksumSha256: meta.checksumSha256 };
    } catch {
      try {
        const info = await stat(this.pathFor(ref, 'object'));
        // Co file nhung mat metadata: bao size that, checksum bao null (khong bia).
        return { exists: true, byteSize: info.size, checksumSha256: null };
      } catch {
        return { exists: false, byteSize: null, checksumSha256: null };
      }
    }
  }

  async putObject(ref: StorageObjectRef, body: Uint8Array, contentType: string): Promise<void> {
    const existing = await this.head(ref);
    // Invariant I-1 o tang luu tru: khong ghi de object class 'source'.
    const violation = assertWritableKey(ref.key, existing.exists);
    if (violation) throw new StorageError(violation);

    const objectPath = this.pathFor(ref, 'object');
    const metaPath = this.pathFor(ref, 'meta');
    await mkdir(dirname(objectPath), { recursive: true });
    await mkdir(dirname(metaPath), { recursive: true });
    await writeFile(objectPath, body);
    const meta: ObjectMeta = {
      contentType,
      byteSize: body.byteLength,
      checksumSha256: createHash('sha256').update(body).digest('hex'),
    };
    await writeFile(metaPath, JSON.stringify(meta), 'utf8');
  }

  async deleteObject(ref: StorageObjectRef): Promise<void> {
    await rm(this.pathFor(ref, 'object'), { force: true });
    await rm(this.pathFor(ref, 'meta'), { force: true });
  }

  /** Duong dan that tren dia. CHI adapter local co khai niem nay - khong nam trong hop dong. */
  async objectPath(ref: StorageObjectRef): Promise<string> {
    return this.pathFor(ref, 'object');
  }

  /**
   * P2-MCP-24: doc byte. Day moi la be mat CHUNG cho moi adapter - S3/R2 khong co duong dan tep.
   */
  async getObject(ref: StorageObjectRef): Promise<Uint8Array> {
    try {
      return new Uint8Array(await readFile(this.pathFor(ref, 'object')));
    } catch {
      throw new StorageError(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
    }
  }

  async contentTypeOf(ref: StorageObjectRef): Promise<string | null> {
    try {
      const meta = JSON.parse(await readFile(this.pathFor(ref, 'meta'), 'utf8')) as ObjectMeta;
      return meta.contentType;
    } catch {
      return null;
    }
  }
}

/** Loi co mang theo ApiError de route map ra HTTP status tu catalogue. */
export class StorageError extends Error {
  constructor(readonly apiErrorValue: ApiError) {
    super(apiErrorValue.code);
    this.name = 'StorageError';
  }
}
