/**
 * MediaClear Pro - Provider abstraction & evidence model (MCP-04).
 *
 * Guardrail 13: khong khoa he thong vao mot AI provider cu the.
 * Guardrail 10: thieu evidence (capability/cost) => 'unknown'/'unconfirmed', KHONG doan.
 * Guardrail: khong hard-code API key - dung resolveProviderCredential() doc tu env.
 *
 * Extension point: interface nay thuan JSON in/out => mot media worker Python o phase sau
 * co the hien thuc cung contract qua HTTP ma khong doi domain (xem WorkerJobEnvelope).
 */
import type { CleanupOperation, EvidenceStatus, MediaType } from './vocabulary.js';
import type { ErrorCode } from './errors.js';

export interface ProviderCapability {
  operation: CleanupOperation;
  mediaType: MediaType;
  /** 'unknown' cho den khi co benchmark that (PROVIDER_BENCHMARK.md). */
  support: EvidenceStatus;
  maxDurationSeconds: number | null;
  maxWidthPx: number | null;
  notes: string | null;
}

export interface ProviderEstimateInput {
  operation: CleanupOperation;
  mediaType: MediaType;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
}

export interface ProviderEstimate {
  /** null = provider khong cong bo gia => KHONG duoc dien so gia. */
  costUsd: number | null;
  costEvidence: EvidenceStatus;
  etaSeconds: number | null;
  etaEvidence: EvidenceStatus;
}

export interface ProviderJobInput {
  jobId: string;
  operation: CleanupOperation;
  mediaType: MediaType;
  /** URL co thoi han, KHONG bao gio la binary inline trong log. */
  sourceUrl: string;
  /** Vung can xu ly, toa do chuan hoa 0..1 de doc lap do phan giai. */
  regions: NormalizedRegion[];
  preserveOriginalMetadata: true;
  preserveAiProvenance: true;
  idempotencyKey: string;
}

export interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** null = ap dung toan bo thoi luong (anh hoac video static mask). */
  startSeconds: number | null;
  endSeconds: number | null;
}

export interface ProviderJobReference {
  providerId: string;
  externalJobId: string;
  submittedAt: string;
}

export interface ProviderJobStatus {
  state: 'pending' | 'running' | 'succeeded' | 'failed';
  progressPercent: number | null;
  errorCode: ErrorCode | null;
}

export interface ProviderResult {
  /** null khi that bai. Khong duoc tra URL rong roi bao thanh cong. */
  outputUrl: string | null;
  modelVersion: string | null;
  /** null = provider khong tra chi phi that. */
  actualCostUsd: number | null;
  latencyMs: number | null;
  evidenceStatus: EvidenceStatus;
  errorCode: ErrorCode | null;
}

/**
 * Interface bat buoc theo prompt Phase 0 muc F.
 * Moi provider (bao gom worker noi bo o phase sau) deu phai hien thuc day du.
 */
export interface MediaProcessingProvider {
  id: string;
  /** false = KHONG duoc dung cho traffic that (vd mock trong test). */
  readonly isProductionProvider: boolean;
  capabilities(): ProviderCapability[];
  estimate(input: ProviderEstimateInput): ProviderEstimate;
  submit(input: ProviderJobInput): Promise<ProviderJobReference>;
  getStatus(ref: ProviderJobReference): Promise<ProviderJobStatus>;
  getResult(ref: ProviderJobReference): Promise<ProviderResult>;
}

/**
 * Doc credential tu env/config, khong hard-code.
 * Tra ve null khi thieu => caller phai bao 'blocked'/'unconfirmed', khong tu chay tiep.
 */
export function resolveProviderCredential(
  env: Record<string, string | undefined>,
  providerId: string,
): string | null {
  const key = `MEDIACLEAR_PROVIDER_${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`;
  const value = env[key];
  return value && value.length > 0 ? value : null;
}

/** Registry don gian: doi provider khong can sua domain workflow. */
export class ProviderRegistry {
  private readonly providers = new Map<string, MediaProcessingProvider>();

  register(provider: MediaProcessingProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): MediaProcessingProvider | null {
    return this.providers.get(id) ?? null;
  }

  /** Chi tra provider production - chan mock lot vao runtime that. */
  listProduction(): MediaProcessingProvider[] {
    return [...this.providers.values()].filter((p) => p.isProductionProvider);
  }

  findCapable(operation: CleanupOperation, mediaType: MediaType): MediaProcessingProvider[] {
    return this.listProduction().filter((p) =>
      p.capabilities().some(
        (c) => c.operation === operation && c.mediaType === mediaType && c.support === 'verified',
      ),
    );
  }
}
