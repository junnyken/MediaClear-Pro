/**
 * InMemoryStorageAdapter - CHI DE TEST CONTRACT.
 *
 * DAY KHONG PHAI ADAPTER PRODUCTION. Khong goi mang, khong ghi dia,
 * khong thay the Cloudflare R2/MinIO. Ton tai de chung minh contract
 * ObjectStorageAdapter dung duoc va de test tinh bat bien cua source key.
 */
import { ERROR_CODES } from '../errors.js';
import {
  assertWritableKey,
  type CreateUploadUrlInput,
  type ObjectStorageAdapter,
  type SignedUrl,
  type StorageObjectHead,
  type StorageObjectRef,
} from '../storage.js';

interface StoredObject {
  body: Uint8Array;
  contentType: string;
}

export class InMemoryStorageAdapter implements ObjectStorageAdapter {
  readonly id = 'in-memory-contract';
  readonly isProductionAdapter = false;
  private readonly objects = new Map<string, StoredObject>();

  private static path(ref: StorageObjectRef): string {
    return `${ref.bucket}/${ref.key}`;
  }

  async createUploadUrl(input: CreateUploadUrlInput): Promise<SignedUrl> {
    return {
      url: `memory://${InMemoryStorageAdapter.path(input.ref)}?upload=1`,
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
    };
  }

  async createDownloadUrl(ref: StorageObjectRef, ttlSeconds: number): Promise<SignedUrl> {
    return {
      url: `memory://${InMemoryStorageAdapter.path(ref)}?download=1`,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    };
  }

  async head(ref: StorageObjectRef): Promise<StorageObjectHead> {
    const found = this.objects.get(InMemoryStorageAdapter.path(ref));
    if (!found) return { exists: false, byteSize: null, checksumSha256: null };
    // Khong tu tinh checksum gia: chua do thi bao null.
    return { exists: true, byteSize: found.body.byteLength, checksumSha256: null };
  }

  async putObject(ref: StorageObjectRef, body: Uint8Array, contentType: string): Promise<void> {
    const path = InMemoryStorageAdapter.path(ref);
    const violation = assertWritableKey(ref.key, this.objects.has(path));
    if (violation) {
      throw new Error(ERROR_CODES.MCP_STORAGE_WRITE_DENIED);
    }
    this.objects.set(path, { body, contentType });
  }

  async deleteObject(ref: StorageObjectRef): Promise<void> {
    this.objects.delete(InMemoryStorageAdapter.path(ref));
  }

  /** P2-MCP-24: doc byte - be mat chung cho moi adapter. */
  async getObject(ref: StorageObjectRef): Promise<Uint8Array> {
    const found = this.objects.get(InMemoryStorageAdapter.path(ref));
    if (!found) throw new Error(ERROR_CODES.MCP_STORAGE_OBJECT_NOT_FOUND);
    return found.body;
  }

  async contentTypeOf(ref: StorageObjectRef): Promise<string | null> {
    return this.objects.get(InMemoryStorageAdapter.path(ref))?.contentType ?? null;
  }
}
