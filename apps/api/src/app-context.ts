/**
 * Composition root cua API (Phase 1).
 *
 * Moi phu thuoc ben ngoai (danh tinh, luu tru, do media, provider) duoc dung o day
 * va truyen xuong service qua tham so => test thay duoc tung manh, va doi
 * in-memory -> PostgreSQL hay local-fs -> R2 khong phai sua domain.
 */
import { ProviderRegistry, NoopContractProvider, type ObjectStorageAdapter } from '@mediaclear/contracts';
import { loadConfig, type ApiConfig } from './config/env.js';
import { DevIdentityProvider, type IdentityProvider } from './auth/identity.js';
import { Pool } from 'pg';
import { InMemoryPersistence } from './persistence/in-memory.js';
import { PostgresPersistence } from './persistence/postgres.js';
import type { PersistencePort } from './persistence/port.js';
import { LocalFsStorageAdapter } from './storage/local-fs-adapter.js';
import { S3CompatibleStorageAdapter } from './storage/s3-adapter.js';
import type { TicketResult, UploadTicketPayload } from './storage/upload-ticket.js';
import { HeaderMediaProbe } from './media/header-probe.js';
import type { MediaProbeAdapter } from './media/probe.js';

/**
 * P2-MCP-24: be mat luu tru ma API that su can. Ngoai hop dong chung `ObjectStorageAdapter`,
 * bien upload/download con can ky/kiem ticket - ca hai adapter deu co.
 */
export type StorageAdapter = ObjectStorageAdapter & {
  sign(payload: UploadTicketPayload): string;
  verifyTicket(token: string, use: 'upload' | 'download', nowMs?: number): TicketResult;
};

export interface AppContext {
  config: ApiConfig;
  persistence: PersistencePort;
  identity: IdentityProvider;
  storage: StorageAdapter;
  probe: MediaProbeAdapter;
  providers: ProviderRegistry;
  bucket: string;
  now: () => Date;
  /**
   * P2-MCP-23: chi co gia tri khi dang chay tren PostgreSQL. Server dung no de chay migration
   * truoc khi nhan request, va de dong ket noi khi tat.
   */
  dbPool: Pool | null;
}

export interface AppContextOverrides {
  config?: Partial<ApiConfig>;
  persistence?: PersistencePort;
  probe?: MediaProbeAdapter;
  now?: () => Date;
}

export function createAppContext(overrides: AppContextOverrides = {}): AppContext {
  const config: ApiConfig = { ...loadConfig(), ...overrides.config };
  // Mot dong ho duy nhat cho ca tien trinh: danh tinh, job, usage, retention deu doc day.
  const now = overrides.now ?? (() => new Date());
  // Mac dinh KHONG doi: thieu cau hinh DB thi van in-memory y nhu truoc.
  // `new Pool()` khong ket noi ngay, nen ham nay van dong bo duoc.
  let dbPool: Pool | null = null;
  let defaultPersistence: PersistencePort;
  if (config.databaseUrl) {
    dbPool = new Pool({ connectionString: config.databaseUrl });
    defaultPersistence = new PostgresPersistence(dbPool);
  } else {
    defaultPersistence = new InMemoryPersistence();
  }
  const persistence = overrides.persistence ?? defaultPersistence;
  const bucket = 'mediaclear-phase1';
  // Mac dinh KHONG doi: thieu cau hinh S3 thi van ghi ra dia local y nhu truoc.
  const storage: StorageAdapter = config.s3
    ? new S3CompatibleStorageAdapter({
        endpoint: config.s3.endpoint,
        region: config.s3.region,
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
        bucket: config.s3.bucket,
        forcePathStyle: config.s3.forcePathStyle,
        publicBaseUrl: config.publicBaseUrl,
        signingSecret: config.uploadSecret,
      })
    : new LocalFsStorageAdapter({
        rootDir: config.dataDir,
        bucket,
        publicBaseUrl: config.publicBaseUrl,
        signingSecret: config.uploadSecret,
      });
  const providers = new ProviderRegistry();
  /*
   * Phase 1 CHI dang ky provider no-op (isProductionProvider = false).
   * Khong provider production nao duoc dang ky truoc khi co benchmark evidence (Q-06).
   */
  providers.register(new NoopContractProvider());

  return {
    config,
    persistence,
    identity: new DevIdentityProvider(persistence, config.sessionTtlSeconds, now),
    storage,
    probe: overrides.probe ?? new HeaderMediaProbe(),
    providers,
    bucket,
    now,
    dbPool,
  };
}
