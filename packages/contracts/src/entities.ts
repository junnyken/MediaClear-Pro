/**
 * MediaClear Pro - Domain entities (MCP-01 / MCP-05).
 *
 * Day la CONTRACT, khong phai ORM model. Phase 0 khong tao migration that.
 * Moi field dung English on dinh; text hien thi cho nguoi dung KHONG nam o day
 * (chi luu i18n key hoac ma loi), xem packages/i18n.
 *
 * Extension point (theo yeu cau owner 2026-09-15):
 * - Khong field nao gan voi web client hay Chrome Extension => extension tuong lai
 *   dung lai nguyen contract nay qua HTTP API (khong co engine rieng).
 * - ProcessingJob/WorkerJobEnvelope khong gan voi runtime Node => Python media worker
 *   tuong lai doc duoc cung mot payload JSON.
 */
import type {
  CleanupOperation,
  EvidenceStatus,
  JobState,
  MediaType,
  Presence,
  PreservationResult,
} from './vocabulary.js';
import type { NormalizedRegion } from './provider.js';
import type { WorkspaceRole } from './tenancy.js';
import type { BlockReasonKind } from './policy.js';

export type Id = string;
/** ISO-8601 UTC, vd 2026-09-15T07:00:00.000Z */
export type IsoTimestamp = string;

export interface User {
  id: Id;
  email: string;
  displayName: string;
  defaultLocale: string;
  createdAt: IsoTimestamp;
}

export interface Workspace {
  id: Id;
  name: string;
  ownerUserId: Id;
  /** Multi-tenant boundary. Moi truy van doc/ghi phai filter theo field nay. */
  createdAt: IsoTimestamp;
}

/**
 * Quan he user <-> workspace kem role (owner decision Q-04).
 * Role KHONG duoc suy dien tu bat ky field nao khac; day la nguon duy nhat.
 */
export interface WorkspaceMembership {
  id: Id;
  workspaceId: Id;
  userId: Id;
  role: WorkspaceRole;
  createdAt: IsoTimestamp;
}

export interface Project {
  id: Id;
  workspaceId: Id;
  name: string;
  createdByUserId: Id;
  createdAt: IsoTimestamp;
}

/** Asset = don vi noi dung logic (1 anh hoac 1 video) trong mot Project. */
export interface Asset {
  id: Id;
  workspaceId: Id;
  projectId: Id;
  mediaType: MediaType;
  /** File goc. Khong bao gio bi ghi de (invariant I-1). */
  sourceFileId: Id;
  createdAt: IsoTimestamp;
}

/** SourceFile = binary goc do nguoi dung upload. Immutable. */
export interface SourceFile {
  id: Id;
  workspaceId: Id;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  mediaType: MediaType;
  /** null = chua do duoc (vd video chua probe xong). Khong duoc dien 0 thay cho null. */
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  hasAudioStream: boolean | null;
  uploadedAt: IsoTimestamp;
  /** Immutable flag - de test regression khang dinh khong ai ghi de file goc. */
  readonly immutable: true;
}

export interface ProcessingJobRequest {
  operations: CleanupOperation[];
  /**
   * P2-MCP-27: vung can xu ly, toa do chuan hoa 0..1.
   * Rong = ap dung toan bo anh. Truoc day truong nay khong ton tai nen vung nguoi dung chon
   * bi kiem xong roi vut di.
   */
  regions: NormalizedRegion[];
  /** Mac dinh ON, MVP khong cho tat (guardrail 6, 7). */
  preserveOriginalMetadata: true;
  preserveAiProvenance: true;
  presetId: string | null;
}

export interface ProcessingJob {
  id: Id;
  workspaceId: Id;
  projectId: Id;
  assetId: Id;
  sourceFileId: Id;
  mediaType: MediaType;
  state: JobState;
  request: ProcessingJobRequest;
  /** Chi co gia tri khi state='completed'. Invariant I-2. */
  outputAssetId: Id | null;
  /** Ly do khi state='blocked' hoac 'failed'. Ma loi trong error-catalogue. */
  reasonCode: string | null;
  /** Phan loai ly do bi chan: policy_block | validation_block | provider_block. */
  blockReasonKind: BlockReasonKind | null;
  /** Khoa chong double-charge va chong submit trung provider (MCP-07). */
  idempotencyKey: string;
  attemptCount: number;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/** OutputAsset = ban moi, LUON tro ve source. Khong bao gio thay the SourceFile. */
export interface OutputAsset {
  id: Id;
  workspaceId: Id;
  jobId: Id;
  /** Invariant I-1: bat buoc, khong nullable. */
  sourceAssetId: Id;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  /** Invariant I-2: chi true sau khi validate output that su. */
  validated: boolean;
  createdAt: IsoTimestamp;
}

export interface BrandKit {
  id: Id;
  workspaceId: Id;
  name: string;
  logoFileIds: Id[];
  primaryColorHex: string | null;
  createdAt: IsoTimestamp;
}

/**
 * RightsAttestation = LOI KHAI CUA NGUOI DUNG, khong phai bang chung so huu (invariant I-4).
 * Khong duoc dat ten field kieu "ownershipVerified".
 */
export interface RightsAttestation {
  id: Id;
  workspaceId: Id;
  /** Scope MVP: chi 'asset' (owner decision Q-09). */
  scope: 'asset';
  assetId: Id;
  /** Source file moi tren cung asset => phai xac nhan lai (owner decision Q-09). */
  sourceFileId: Id;
  /** 'blocked' khi asset bi report va dang cho review. */
  status: 'active' | 'blocked';
  attestedByUserId: Id;
  /** Version cua cau xac nhan da hien thi, de audit ve sau. */
  statementId: string;
  statementVersion: number;
  localeShown: string;
  attestationType: 'user_self_declared';
  attestedAt: IsoTimestamp;
}

export interface ProvenanceRecord {
  id: Id;
  workspaceId: Id;
  /** Do tren SourceFile truoc khi xu ly. */
  originalMetadataPresence: Presence;
  aiProvenancePresence: Presence;
  preservationRequested: boolean;
  preservationAttempted: boolean;
  preservationResult: PreservationResult;
  /** Gioi han do luong that su cua he thong, vd "khong doc duoc C2PA". */
  limitationNote: string | null;
  evidenceStatus: EvidenceStatus;
  recordedAt: IsoTimestamp;
}

export interface ProcessingReceipt {
  id: Id;
  workspaceId: Id;
  jobId: Id;
  sourceAssetId: Id;
  outputAssetId: Id | null;
  operations: CleanupOperation[];
  providerRunIds: Id[];
  provenanceBeforeId: Id;
  provenanceAfterId: Id | null;
  /** i18n key cua disclaimer watermark vo hinh (guardrail 4). */
  invisibleWatermarkDisclaimerKey: string;
  evidenceStatus: EvidenceStatus;
  createdAt: IsoTimestamp;
}

export interface AuditEvent {
  id: Id;
  workspaceId: Id;
  actorUserId: Id | null;
  /** vd: rights.attested, policy.blocked, job.state_changed, usage.committed */
  eventType: string;
  /**
   * Phase 1 bo sung 'workspace' | 'project' | 'membership': cac su kien
   * workspace_created / workspace_member_added / project_created can subject that,
   * khong duoc ep vao 'asset' cho du field.
   */
  subjectType:
    | 'workspace'
    | 'project'
    | 'membership'
    | 'asset'
    | 'job'
    | 'output'
    | 'attestation'
    | 'usage'
    | 'audit'
    | 'provider_run';
  subjectId: Id;
  /** CHI metadata phi nhay cam. Cam log media bytes, API key, PII (guardrail 15). */
  detail: Record<string, string | number | boolean | null>;
  occurredAt: IsoTimestamp;
}

export interface ProviderRun {
  id: Id;
  workspaceId: Id;
  jobId: Id;
  providerId: string;
  modelVersion: string | null;
  operation: CleanupOperation;
  inputWidthPx: number | null;
  inputHeightPx: number | null;
  inputDurationSeconds: number | null;
  /** null = chua biet. Khong duoc dien 0 hay so bia (guardrail 10). */
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  latencyMs: number | null;
  qualityReviewResult: EvidenceStatus;
  errorCode: string | null;
  evidenceStatus: EvidenceStatus;
  startedAt: IsoTimestamp;
  finishedAt: IsoTimestamp | null;
}

export interface UsageLedgerEntry {
  id: Id;
  workspaceId: Id;
  jobId: Id;
  /** image_unit hoac video_minute_unit (MCP-07). */
  unitType: 'image_unit' | 'video_minute_unit';
  quantity: number;
  entryType: 'reserve' | 'commit' | 'release';
  /** Ly do release: provider_error | user_error | validation_failed | cancelled | blocked */
  reasonCode: string | null;
  /** Unique key chong double charge: (jobId, entryType) cho commit. */
  idempotencyKey: string;
  recordedAt: IsoTimestamp;
  /**
   * P1.1 (Q-17): han cua reservation, CHI co nghia tren but toan 'reserve'.
   * null tren but toan commit/release va tren but toan cu truoc khi co TTL.
   */
  expiresAt: IsoTimestamp | null;
}
