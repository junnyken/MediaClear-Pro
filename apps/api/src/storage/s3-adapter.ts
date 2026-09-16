/**
 * S3CompatibleStorageAdapter - luu media tren S3/R2/MinIO (P2-MCP-24).
 *
 * Owner decision Q-01: object storage la truu tuong S3-compatible, dich production dau tien
 * la Cloudflare R2. Adapter nay noi toi BAT KY dich S3-compatible nao qua `endpoint`:
 * R2, MinIO, hay S3 that.
 *
 * Bien upload/download VAN di qua API bang ticket HMAC (xem `upload-ticket.ts`). Byte thi
 * nam tren S3 thay vi dia local. Doi sang presigned URL tra thang cho trinh duyet la mot
 * thay doi kien truc rieng - keo theo CORS va lam mat diem kiem gioi han kich thuoc - nen
 * khong gop vao luot nay.
 *
 * Adapter nay hanh xu GIONG HET LocalFsStorageAdapter: bo test hop dong chay tren CA HAI.
 */
import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  ERROR_CODES,
  apiError,
  assertWritableKey,
  type CreateUploadUrlInput,
  type ObjectStorageAdapter,
  type SignedUrl,
  type StorageObjectHead,
  type StorageObjectRef,
} from '@mediaclear/contracts';
import { assertSafeObjectKey } from './object-key.js';
import { StorageError } from './local-fs-adapter.js';
import { signTicket, verifyTicket, type TicketResult, type UploadTicketPayload } from './upload-ticket.js';

export interface S3StorageOptions {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Base URL cua API, de dung URL tra ve cho client. */
  publicBaseUrl: string;
  signingSecret: string;
  /** MinIO can path-style; R2/S3 dung virtual-host. Mac dinh path-style cho an toan. */
  forcePathStyle?: boolean;
  /** Nhan dang lo ra /healthz. */
  id?: string;
}

/** Checksum luu kem object de `head()` tra duoc so that, khong phai doan. */
const CHECKSUM_META_KEY = 'sha256';

export class S3CompatibleStorageAdapter implements ObjectStorageAdapter {
  readonly id: string;
  /**
   * TU KHAI la adapter production. Khac LocalFsStorageAdapter (`false`), va khac
   * `DevIdentityProvider`: day la duong luu tru that su dung duoc o production.
   */
  readonly isProductionAdapter = true;

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly secret: string;

  constructor(options: S3StorageOptions) {
    this.id = options.id ?? 's3-compatible-phase2';
    this.bucket = options.bucket;
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '');
    this.secret = options.signingSecret;
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
      forcePathStyle: options.forcePathStyle ?? true,
    });
  }

  private guard(ref: StorageObjectRef): void {
    const invalid = assertSafeObjectKey(ref.key);
    if (invalid) throw new StorageError(invalid);
  }

  sign(payload: UploadTicketPayload): string {
    return signTicket(this.secret, payload);
  }

  verifyTicket(token: string, use: 'upload' | 'download', nowMs = Date.now()): TicketResult {
    return verifyTicket(this.secret, token, use, nowMs);
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<SignedUrl> {
    this.guard(input.ref);
    const exp = Math.floor(Date.now() / 1000) + input.ttlSeconds;
    const token = this.sign({
      bucket: input.ref.bucket,
      key: input.ref.key,
      contentType: input.contentType,
      maxByteSize: input.maxByteSize,
      exp,
      use: 'upload',
    });
    return {
      url: `${this.publicBaseUrl}/v1/storage/upload/${token}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async createDownloadUrl(ref: StorageObjectRef, ttlSeconds: number): Promise<SignedUrl> {
    this.guard(ref);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = this.sign({
      bucket: ref.bucket,
      key: ref.key,
      contentType: 'application/octet-stream',
      maxByteSize: 0,
      exp,
      use: 'download',
    });
    return {
      url: `${this.publicBaseUrl}/v1/storage/download/${token}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async head(ref: StorageObjectRef): Promise<StorageObjectHead> {
    this.guard(ref);
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(ref) }),
      );
      return {
        exists: true,
        byteSize: typeof out.ContentLength === 'number' ? out.ContentLength : null,
        // Khong co checksum da luu thi tra null - KHONG tu tinh lai roi bao nhu that.
        checksumSha256: out.Metadata?.[CHECKSUM_META_KEY] ?? null,
      };
    } catch (error) {
      if (isNotFound(error)) return { exists: false, byteSize: null, checksumSha256: null };
      throw error;
    }
  }

  async putObject(ref: StorageObjectRef, body: Uint8Array, contentType: string): Promise<void> {
    this.guard(ref);
    const existing = await this.head(ref);
    // Invariant I-1 o tang luu tru: khong ghi de object class 'source'.
    const violation = assertWritableKey(ref.key, existing.exists);
    if (violation) throw new StorageError(violation);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.objectKey(ref),
        Body: body,
        ContentType: contentType,
        Metadata: { [CHECKSUM_META_KEY]: createHash('sha256').update(body).digest('hex') },
      }),
    );
  }

  async getObject(ref: StorageObjectRef): Promise<Uint8Array> {
    this.guard(ref);
    try {
      const out = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(ref) }),
      );
      if (!out.Body) throw new StorageError(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
      return new Uint8Array(await out.Body.transformToByteArray());
    } catch (error) {
      if (isNotFound(error)) throw new StorageError(apiError(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND));
      throw error;
    }
  }

  async contentTypeOf(ref: StorageObjectRef): Promise<string | null> {
    this.guard(ref);
    try {
      const out = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.objectKey(ref) }),
      );
      return out.ContentType ?? null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async deleteObject(ref: StorageObjectRef): Promise<void> {
    this.guard(ref);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(ref) }));
  }

  /**
   * Bucket trong `ref` la bucket LOGIC cua ung dung; bucket that la cai cau hinh o adapter.
   * Ghep bucket logic vao khoa de nhieu bucket logic dung chung mot bucket that ma khong dung nhau.
   */
  private objectKey(ref: StorageObjectRef): string {
    return `${ref.bucket}/${ref.key}`;
  }

  /** Bucket co ton tai va doc duoc khong. Goi luc khoi dong, khong goi trong duong nong. */
  async bucketExists(): Promise<boolean> {
    const { HeadBucketCommand } = await import('@aws-sdk/client-s3');
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tao bucket. CHI goi khi duoc cho phep ro rang.
   *
   * Khong tu tao bucket o duong khoi dong mac dinh: im lang tao ha tang tren mot dich production
   * (R2, S3) la thu khong nen lam gium nguoi van hanh - go nham bucket trong cau hinh se thanh
   * "chay duoc" thay vi bao loi.
   */
  async createBucket(): Promise<void> {
    const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
  }

  /** Tien ich cho test: kiem, thieu thi tao. Khong dung o duong khoi dong production. */
  async ensureBucket(): Promise<void> {
    if (!(await this.bucketExists())) await this.createBucket();
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
}
