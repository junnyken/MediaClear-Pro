/**
 * MediaClear Pro - API contract types (MCP-03/04/07), khop docs/API.md.
 *
 * Phase 0: MOI handler deu tra 501 MCP_NOT_IMPLEMENTED. Kieu o day la contract
 * de Phase 1 hien thuc, KHONG phai bang chung rang endpoint da chay.
 */
import type { ApiError } from './errors.js';
import type {
  Asset,
  ProcessingJob,
  ProcessingReceipt,
  ProvenanceRecord,
  UsageLedgerEntry,
} from './entities.js';
import type { CleanupOperation, MediaType } from './vocabulary.js';
import type { NormalizedRegion } from './provider.js';

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/**
 * Mapping ma loi -> HTTP status nam trong ERROR_CATALOGUE (errors.ts), khong lap lai o day.
 * Dung httpStatusFor(code) khi tra loi qua HTTP.
 */
export { httpStatusFor, errorDefinition } from './errors.js';

export interface CreateUploadRequest {
  projectId: string;
  mediaType: MediaType;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
}
export interface CreateUploadResponse {
  sourceFileId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface ValidateAssetResponse {
  assetId: string;
  valid: boolean;
  errors: ApiError[];
}

export interface CreateAttestationRequest {
  assetId: string;
  statementId: string;
  statementVersion: number;
  localeShown: string;
  accepted: true;
}

export interface CreateJobRequest {
  assetId: string;
  operations: CleanupOperation[];
  regions: NormalizedRegion[];
  presetId: string | null;
  idempotencyKey: string;
}

export interface JobEstimateResponse {
  /** null = chua co evidence gia => UI phai hien "chua xac dinh", khong hien 0. */
  estimatedCostUsd: number | null;
  costEvidence: string;
  unitType: 'image_unit' | 'video_minute_unit';
  quantity: number;
}

export interface UsageSummaryResponse {
  workspaceId: string;
  imageUnitsCommitted: number;
  videoMinuteUnitsCommitted: number;
  entries: UsageLedgerEntry[];
}

/** Bang route cua Phase 0. status='planned' => chua hien thuc. */
export const API_ROUTES = [
  { method: 'POST', path: '/v1/uploads', status: 'planned', mcp: 'MCP-03' },
  { method: 'POST', path: '/v1/assets/:assetId/validate', status: 'planned', mcp: 'MCP-03' },
  { method: 'POST', path: '/v1/assets/:assetId/attestations', status: 'planned', mcp: 'MCP-02' },
  { method: 'POST', path: '/v1/jobs', status: 'planned', mcp: 'MCP-02' },
  { method: 'GET', path: '/v1/jobs/:jobId', status: 'planned', mcp: 'MCP-03' },
  { method: 'POST', path: '/v1/jobs/:jobId/estimate', status: 'planned', mcp: 'MCP-07' },
  { method: 'POST', path: '/v1/jobs/:jobId/preview', status: 'planned', mcp: 'MCP-07' },
  { method: 'GET', path: '/v1/jobs/:jobId/receipt', status: 'planned', mcp: 'MCP-05' },
  { method: 'GET', path: '/v1/workspaces/:workspaceId/usage', status: 'planned', mcp: 'MCP-07' },
  { method: 'GET', path: '/v1/workspaces/:workspaceId/audit-events', status: 'planned', mcp: 'MCP-02' },
  { method: 'GET', path: '/healthz', status: 'implemented', mcp: 'MCP-00' },
] as const;

export type ApiRoute = (typeof API_ROUTES)[number];

export type { Asset, ProcessingJob, ProcessingReceipt, ProvenanceRecord, UsageLedgerEntry };
