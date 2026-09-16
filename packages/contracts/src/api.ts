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

/**
 * P2-MCP-29: ban ket qua cua mot job.
 *
 * `validated` KHONG bao gio duoc suy ra - no la co that trong co so du lieu, dat sau khi
 * doc lai byte va do lai (bat bien I-2). Chua `validated` thi khong phat URL tai ve.
 */
export interface JobOutputResponse {
  outputAssetId: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  validated: boolean;
  createdAt: string;
}

export interface JobOutputDownloadResponse {
  url: string;
  expiresAt: string;
  /** Lap lai de nguoi tai co the tu kiem tep minh nhan duoc, khong phai tin loi he thong. */
  checksumSha256: string;
  byteSize: number;
}

/**
 * P2-MCP-30: bien nhan kem CA hai ban ghi do.
 *
 * Tra ve ban ghi day du chu khong chi id: mot bien nhan tro toi hai id ma nguoi doc khong tra
 * cuu duoc thi khong phai bang chung, chi la mot loi hua.
 */
export interface JobReceiptResponse {
  receipt: ProcessingReceipt;
  provenanceBefore: ProvenanceRecord;
  /** null khi chua do lai duoc sau khi xu ly. */
  provenanceAfter: ProvenanceRecord | null;
}

/**
 * P2-MCP-31: ban xem truoc.
 *
 * `billable` va `providerJobBudget` nam trong response co chu dich: chung la loi TU KHAI cua he
 * thong ve viec luot nay co bi tinh tien khong, kiem tra duoc tu ben ngoai.
 */
export interface JobPreviewResponse {
  mode: 'proxy';
  /** Luon false (I-12). */
  billable: boolean;
  providerJobBudget: 0 | 1;
  operation: CleanupOperation;
  widthPx: number;
  heightPx: number;
  byteSize: number;
  /** Anh nhung thang trong response - KHONG luu vao kho, khong de lai rac. */
  imageDataUri: string;
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
  { method: 'GET', path: '/', status: 'implemented', mcp: 'P0-MCP-00' },
  { method: 'GET', path: '/healthz', status: 'implemented', mcp: 'P0-MCP-00' },
  { method: 'GET', path: '/openapi.json', status: 'implemented', mcp: 'P2-MCP-34' },

  // --- MCP-10 Auth & workspace boundary ---
  { method: 'POST', path: '/v1/auth/dev-session', status: 'dev_only', mcp: 'P1-MCP-10' },
  // P2-MCP-25 (Q-14 da chot): xac thuc that. Hai route nay chay o MOI moi truong.
  { method: 'POST', path: '/v1/auth/register', status: 'implemented', mcp: 'P2-MCP-25' },
  { method: 'POST', path: '/v1/auth/sign-in', status: 'implemented', mcp: 'P2-MCP-25' },
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

  // --- P3-MCP-30: ban proxy do phan giai thap de xem truoc video ---
  { method: 'POST', path: '/v1/assets/:assetId/proxy', status: 'implemented', mcp: 'P3-MCP-30' },
  { method: 'GET', path: '/v1/assets/:assetId/proxy', status: 'implemented', mcp: 'P3-MCP-30' },
  { method: 'GET', path: '/v1/assets/:assetId/proxy/download-url', status: 'implemented', mcp: 'P3-MCP-30' },

  // --- P3-MCP-34: preset xuat. Cong khai: day la nang luc he thong, khong phai du lieu cua ai ---
  { method: 'GET', path: '/v1/export-presets', status: 'implemented', mcp: 'P3-MCP-34' },

  // --- P2-MCP-35: tai len noi lai duoc. Mot request PUT duy nhat khong song noi voi tep lon
  //     tren duong truyen keu - mat ket noi la mat toan bo.
  { method: 'POST', path: '/v1/source-files/:sourceFileId/upload-session', status: 'implemented', mcp: 'P2-MCP-35' },
  { method: 'GET', path: '/v1/upload-sessions/:sessionId', status: 'implemented', mcp: 'P2-MCP-35' },
  { method: 'PUT', path: '/v1/upload-sessions/:sessionId/chunks/:chunkIndex', status: 'implemented', mcp: 'P2-MCP-35' },
  { method: 'POST', path: '/v1/upload-sessions/:sessionId/complete', status: 'implemented', mcp: 'P2-MCP-35' },
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
  { method: 'POST', path: '/v1/internal/jobs/run', status: 'internal', mcp: 'P2-MCP-27' },

  // --- P2-MCP-29: lay ban ket qua ve. Truoc muc nay ket qua nam trong kho ma KHONG
  //     duong nao dan toi no - tep da xu ly xong van vo hinh voi nguoi dung.
  { method: 'GET', path: '/v1/jobs/:jobId/output', status: 'implemented', mcp: 'P2-MCP-29' },
  { method: 'GET', path: '/v1/jobs/:jobId/output/download-url', status: 'implemented', mcp: 'P2-MCP-29' },

  // --- Van chua hien thuc: khong co xu ly media production trong Phase 1 ---
  { method: 'POST', path: '/v1/jobs/:jobId/estimate', status: 'implemented', mcp: 'P2-MCP-31' },
  { method: 'POST', path: '/v1/jobs/:jobId/preview', status: 'implemented', mcp: 'P2-MCP-31' },
  { method: 'GET', path: '/v1/jobs/:jobId/receipt', status: 'implemented', mcp: 'P2-MCP-30' },
] as const;

export type ApiRoute = (typeof API_ROUTES)[number];

/**
 * Tu vung trang thai route, khai RIENG chu khong suy ra tu `API_ROUTES`.
 *
 * Truoc day day la `ApiRoute['status']`. Hau qua lo ra o P2-MCP-31: khi bang khong con muc
 * 'planned' nao, kieu nay MAT LUON gia tri 'planned', va moi phep so sanh voi no thanh loi bien
 * dich. Tuc la "cac trang thai co the co" bi dinh nghia bang "cac trang thai dang co" - hai thu
 * khac nhau. Mot route 'planned' moi phai them duoc vao bat cu luc nao ma khong pha gi.
 */
export const API_ROUTE_STATUSES = ['implemented', 'planned', 'dev_only', 'internal'] as const;
export type ApiRouteStatus = (typeof API_ROUTE_STATUSES)[number];

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

/*
 * `MeResponse` nay SUY RA tu `ME_RESPONSE_SCHEMA` trong `api-schemas.ts`, khong con viet tay.
 *
 * Truoc day day la mot `interface` viet tay — tuc la MOT khai bao thu hai cho cung mot thu, ben
 * canh hinh dang ma may chu that su tra ve. Hai khai bao cho mot khai niem chinh la thu D-047
 * ton tai de chan, nen no bi go bo thay vi giu lai song song.
 */
export type { MeResponse } from './api-schemas.js';

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
