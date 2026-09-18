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
import type { DisclosureState, MetadataCategory, MetadataVerdict } from './phase5.js';

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
  /**
   * `D-077` — lop phu nhan dien / cong bo AI cho ban xuat NAY.
   *
   * `null` la MAC DINH va la cho an toan: khong co lop phu nao. Truong nay chi khac `null` khi
   * nguoi dung CHON — khong duong nao trong ma tu dien gia tri vao day.
   *
   * KHONG nham voi thao tac `brand_overlay` trong `operations`: thao tac do la mat na xam dac to
   * kin mot vung (`Q-15`) — no XOA thong tin. Truong nay THEM thong tin len tren. Hai viec nguoc nhau.
   */
  branding: BrandingRequest | null;
}

export interface BrandingRequest {
  brandKitId: Id;
  /** Phien ban CU THE. Khong dung "phien ban dang hieu luc": ban xuat phai tro toi thu da that su dan. */
  brandKitVersion: number;
  /** Nguoi dung co the chon bo nhan dien roi TAT logo — hai o nay doc lap nhau. */
  applyLogo: boolean;
  applyDisclosure: boolean;
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

  /* --- P3: cac truong cua luot xu ly VIDEO. `null` voi bien nhan anh cua Phase 2. ---
   * KHONG tach bang bien nhan thu hai: hai nguon su that cho cung mot khai niem la dung thu
   * ma D-047 ton tai de chan. */
  operationMode: string | null;
  presetId: string | null;
  inputChecksum: string | null;
  outputChecksum: string | null;
  /** Do THAT tren byte truoc/sau. `null` = chua do (khong phai "khong co"). */
  audioBefore: AudioTrackSnapshot | null;
  audioAfter: AudioTrackSnapshot | null;
  audioVerdict: string | null;
  /** Bat bien I-2: chi true SAU KHI doc lai byte da ghi va do lai. */
  outputVerified: boolean;
  failureReason: string | null;
  reviewReason: string | null;

  /* --- P5 (`D-075`). `null` = KHONG DO DUOC hoac khong ap dung — khong phai gia tri mac dinh. --- */

  /** `P5-MCP-51`: ket luan doi chieu metadata TUNG TRUONG. */
  metadataVerdict: MetadataVerdict | null;
  metadataEvidence: EvidenceStatus | null;
  /** Nhom metadata bi go THEO CHINH SACH — dung y do, nhung nguoi dung van co quyen biet. */
  metadataStrippedCategories: MetadataCategory[];
  /** `P5-MCP-54`: cong bo AI. KHONG bao gio suy `ai_not_used` tu viec khong doc duoc gi. */
  disclosureState: DisclosureState | null;
  disclosureLimitationKey: string | null;
  /**
   * `P5-MCP-53`: bo nhan dien DA AP DUNG, kem PHIEN BAN.
   *
   * Phai ghi ca phien ban: sua bo nhan dien khong duoc lam doi ho so cua mot ban xuat da phat hanh.
   * `null` = nguoi dung KHONG chon bo nhan dien nao — va khi do ban xuat khong duoc co lop phu.
   */
  brandKitId: Id | null;
  brandKitVersion: number | null;
  /** `D-077`: tep logo THAT da duoc dan. `null` = khong dan logo nao. */
  brandLogoAssetId: Id | null;
  /**
   * `D-077`. Cot RIENG, KHONG suy tu `brandKitId !== null`.
   *
   * Nguoi dung co the chon mot bo nhan dien roi TAT lop phu. Suy tu su co mat cua id se noi sai
   * trong dung ca do — va do la mot trong nhung cau hoi bien nhan sinh ra de tra loi.
   */
  brandOverlayApplied: boolean;
  /** `D-077`: lop phu cong bo AI co duoc dan vao ban xuat khong. Mac dinh `false` — opt-in. */
  disclosureOverlayApplied: boolean;
  /** Doi hinh dang bien nhan ve sau se tang so nay; ban doc cu biet minh dang doc phien ban nao. */
  schemaVersion: number;
}

/** Anh chup luong tieng tai mot thoi diem. `present: false` = DA DO va khong thay. */
export interface AudioTrackSnapshot {
  present: boolean;
  codec: string | null;
  durationSeconds: number | null;
  channelCount: number | null;
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
    | 'provider_run'
    /* Moi tu `D-070`: viec don du lieu sinh su kien ve hai loai chu the nay. */
    | 'source_file'
    | 'upload_session'
    /** P5-MCP-53. */
    | 'brand_kit';
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
