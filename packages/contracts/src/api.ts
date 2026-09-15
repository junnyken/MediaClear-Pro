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

/**
 * Bang route.
 *  - 'implemented' = handler that, co test HTTP that.
 *  - 'planned'     = van tra 501 MCP_NOT_IMPLEMENTED.
 *  - 'dev_only'    = chi bat trong moi truong dev (auth provider production chua chot, Q-14).
 *  - 'internal'    = route van hanh noi bo, TAT mac dinh; chi song khi co khoa noi bo.
 *                    Khong bao gio dung route cua nguoi dung de chay viec van hanh.
 *
 * Phase 1 thay mot so path 'planned' cua Phase 0 bang path long tai nguyen theo owner prompt
 * Phase 1 muc 8. Cac path cu chua tung duoc hien thuc; bang doi chieu o docs/API.md (D-024).
 */
export const API_ROUTES = [
  { method: 'GET', path: '/healthz', status: 'implemented', mcp: 'P0-MCP-00' },

  // --- MCP-10 Auth & workspace boundary ---
  { method: 'POST', path: '/v1/auth/dev-session', status: 'dev_only', mcp: 'P1-MCP-10' },
  { method: 'GET', path: '/v1/me', status: 'implemented', mcp: 'P1-MCP-10' },
  { method: 'GET', path: '/v1/workspaces', status: 'implemented', mcp: 'P1-MCP-10' },
  { method: 'POST', path: '/v1/workspaces', status: 'implemented', mcp: 'P1-MCP-10' },
  { method: 'GET', path: '/v1/workspaces/:workspaceId', status: 'implemented', mcp: 'P1-MCP-10' },
  { method: 'GET', path: '/v1/workspaces/:workspaceId/members', status: 'implemented', mcp: 'P1-MCP-10' },
  { method: 'POST', path: '/v1/workspaces/:workspaceId/members', status: 'implemented', mcp: 'P1-MCP-10' },
  { method: 'GET', path: '/v1/workspaces/:workspaceId/audit-events', status: 'implemented', mcp: 'P1-MCP-10' },

  // --- MCP-11 Project & asset library ---
  { method: 'GET', path: '/v1/workspaces/:workspaceId/projects', status: 'implemented', mcp: 'P1-MCP-11' },
  { method: 'POST', path: '/v1/workspaces/:workspaceId/projects', status: 'implemented', mcp: 'P1-MCP-11' },
  { method: 'GET', path: '/v1/projects/:projectId', status: 'implemented', mcp: 'P1-MCP-11' },
  { method: 'GET', path: '/v1/projects/:projectId/assets', status: 'implemented', mcp: 'P1-MCP-11' },
  { method: 'GET', path: '/v1/assets/:assetId', status: 'implemented', mcp: 'P1-MCP-11' },

  // --- MCP-15 Upload storage adapter ---
  { method: 'POST', path: '/v1/projects/:projectId/assets/upload-intent', status: 'implemented', mcp: 'P1-MCP-15' },
  { method: 'PUT', path: '/v1/storage/upload/:uploadToken', status: 'implemented', mcp: 'P1-MCP-15' },
  { method: 'GET', path: '/v1/assets/:assetId/download-url', status: 'implemented', mcp: 'P1-MCP-15' },
  { method: 'GET', path: '/v1/storage/download/:downloadToken', status: 'implemented', mcp: 'P1-MCP-15' },

  // --- MCP-12 Media intake validation ---
  { method: 'POST', path: '/v1/assets/:assetId/validate', status: 'implemented', mcp: 'P1-MCP-12' },

  // --- MCP-13 Rights attestation gate ---
  { method: 'POST', path: '/v1/assets/:assetId/rights-attestation', status: 'implemented', mcp: 'P1-MCP-13' },
  { method: 'GET', path: '/v1/assets/:assetId/rights-attestation', status: 'implemented', mcp: 'P1-MCP-13' },

  // --- MCP-14 Processing job boundary + usage ---
  { method: 'POST', path: '/v1/assets/:assetId/jobs', status: 'implemented', mcp: 'P1-MCP-14' },
  { method: 'GET', path: '/v1/jobs/:jobId', status: 'implemented', mcp: 'P1-MCP-14' },
  { method: 'POST', path: '/v1/jobs/:jobId/cancel', status: 'implemented', mcp: 'P1-MCP-14' },
  { method: 'GET', path: '/v1/usage', status: 'implemented', mcp: 'P1-MCP-14' },

  // --- P1.1: luu giu du lieu + han cua khoan giu muc dung ---
  { method: 'GET', path: '/v1/assets/:assetId/retention', status: 'implemented', mcp: 'P1.1-MCP-18' },
  { method: 'POST', path: '/v1/internal/usage-reservations/expire', status: 'internal', mcp: 'P1.1-MCP-17' },
  { method: 'POST', path: '/v1/internal/retention/dry-run', status: 'internal', mcp: 'P1.1-MCP-18' },

  // --- Van chua hien thuc: khong co xu ly media production trong Phase 1 ---
  { method: 'POST', path: '/v1/jobs/:jobId/estimate', status: 'planned', mcp: 'P0-MCP-07' },
  { method: 'POST', path: '/v1/jobs/:jobId/preview', status: 'planned', mcp: 'P0-MCP-07' },
  { method: 'GET', path: '/v1/jobs/:jobId/receipt', status: 'planned', mcp: 'P0-MCP-05' },
] as const;

export type ApiRoute = (typeof API_ROUTES)[number];
export type ApiRouteStatus = ApiRoute['status'];

/** Phase 1: request/response contract cho cac route moi. */
export interface DevSessionRequest {
  email: string;
  displayName?: string;
}
export interface DevSessionResponse {
  token: string;
  userId: string;
  expiresAt: string;
  /** Luon false trong Phase 1: day KHONG phai IdP production (Q-14 con mo). */
  productionAuthProvider: false;
}

export interface MeResponse {
  user: { id: string; email: string; displayName: string; defaultLocale: string };
  workspaces: Array<{ id: string; name: string; role: string }>;
}

export interface CreateWorkspaceRequest {
  name: string;
}
export interface AddMemberRequest {
  email: string;
  role: string;
}
export interface CreateProjectRequest {
  name: string;
}

export interface UploadIntentRequest {
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  mediaType: MediaType;
}
export interface UploadIntentResponse {
  assetId: string;
  sourceFileId: string;
  uploadUrl: string;
  expiresAt: string;
  maxByteSize: number;
}

export interface CursorPage<T> {
  items: T[];
  /** null = het du lieu. */
  nextCursor: string | null;
}

export type { Asset, ProcessingJob, ProcessingReceipt, ProvenanceRecord, UsageLedgerEntry };
