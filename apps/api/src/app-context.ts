/**
 * Composition root cua API (Phase 1).
 *
 * Moi phu thuoc ben ngoai (danh tinh, luu tru, do media, provider) duoc dung o day
 * va truyen xuong service qua tham so => test thay duoc tung manh, va doi
 * in-memory -> PostgreSQL hay local-fs -> R2 khong phai sua domain.
 */
import { ProviderRegistry, NoopContractProvider } from '@mediaclear/contracts';
import { loadConfig, type ApiConfig } from './config/env.js';
import { DevIdentityProvider, type IdentityProvider } from './auth/identity.js';
import { Pool } from 'pg';
import { InMemoryPersistence } from './persistence/in-memory.js';
import { PostgresPersistence } from './persistence/postgres.js';
import type { PersistencePort } from './persistence/port.js';
import { LocalFsStorageAdapter } from './storage/local-fs-adapter.js';
import { HeaderMediaProbe } from './media/header-probe.js';
import type { MediaProbeAdapter } from './media/probe.js';

export interface AppContext {
  config: ApiConfig;
  persistence: PersistencePort;
  identity: IdentityProvider;
  storage: LocalFsStorageAdapter;
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
  const storage = new LocalFsStorageAdapter({
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
