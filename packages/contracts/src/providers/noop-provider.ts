/**
 * NoopContractProvider - CHI DE TEST CONTRACT.
 *
 * DAY KHONG PHAI PRODUCTION AI PROVIDER. Khong goi API that, khong xu ly media that.
 * Moi capability deu 'unknown', moi cost deu null: dung de chung minh rang
 * he thong xu ly dung truong hop "thieu evidence" ma khong bia so.
 */
import { ERROR_CODES } from '../errors.js';
import type {
  MediaProcessingProvider,
  ProviderCapability,
  ProviderEstimate,
  ProviderJobInput,
  ProviderJobReference,
  ProviderJobStatus,
  ProviderResult,
} from '../provider.js';

export class NoopContractProvider implements MediaProcessingProvider {
  readonly id = 'noop-contract';
  readonly isProductionProvider = false;
  /** Mock hop dong: khong xu ly gi, cang khong goi AI. */
  readonly usesAiModel = false;

  capabilities(): ProviderCapability[] {
    return [
      {
        operation: 'visible_logo_cleanup',
        mediaType: 'image',
        support: 'unknown',
        maxDurationSeconds: null,
        maxWidthPx: null,
        notes: 'Mock provider cho contract test. Khong xu ly media that.',
      },
    ];
  }

  estimate(): ProviderEstimate {
    return { costUsd: null, costEvidence: 'unknown', etaSeconds: null, etaEvidence: 'unknown' };
  }

  async submit(input: ProviderJobInput): Promise<ProviderJobReference> {
    return {
      providerId: this.id,
      externalJobId: `noop-${input.idempotencyKey}`,
      submittedAt: new Date(0).toISOString(),
    };
  }

  async getStatus(): Promise<ProviderJobStatus> {
    return {
      state: 'failed',
      progressPercent: null,
      errorCode: ERROR_CODES.MCP_PROVIDER_NOT_PRODUCTION,
    };
  }

  async getResult(): Promise<ProviderResult> {
    return {
      outputUrl: null,
      modelVersion: null,
      actualCostUsd: null,
      latencyMs: null,
      evidenceStatus: 'unknown',
      errorCode: ERROR_CODES.MCP_PROVIDER_NOT_PRODUCTION,
    };
  }
}
