/**
 * Kieu du lieu tang app (Phase 1).
 *
 * Nguyen tac: KHONG bia so do. Thong tin do client khai (`declared*`) va thong tin
 * do he thong DO THAT SU tren byte (`measured`) nam o hai cho khac nhau. Chi khi da
 * do that su moi dung duoc entity `SourceFile` cua contract Phase 0.
 */
import type {
  Asset,
  AuditEvent,
  Id,
  IsoTimestamp,
  OutputAsset,
  ProcessingJob,
  ProcessingReceipt,
  ProvenanceRecord,
  Project,
  RightsAttestation,
  SourceFile,
  UsageLedgerEntry,
  User,
  Workspace,
  WorkspaceMembership,
} from '@mediaclear/contracts';
import type { ApiError, FrameState, MaskBox, MaskSource, MediaType, RetentionState } from '@mediaclear/contracts';

export interface MeasuredSourceFile {
  /** MIME doc tu magic bytes, KHONG phai tu client. */
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  mediaType: MediaType;
  durationSeconds: number | null;
  widthPx: number | null;
  heightPx: number | null;
  hasAudioStream: boolean | null;
  corrupt: boolean;
}

export interface SourceFileRecord {
  id: Id;
  workspaceId: Id;
  projectId: Id;
  assetId: Id;
  storageKey: string;
  /** Ten file goc CHI luu lam ten hien thi - khong bao gio dung lam path. */
  originalFilename: string;
  declaredMimeType: string;
  declaredByteSize: number;
  declaredMediaType: MediaType;
  uploadState: 'pending' | 'stored';
  /** null khi chua co byte nao ve. Khong duoc dien so gia de "cho du field". */
  measured: MeasuredSourceFile | null;
  createdAt: IsoTimestamp;
  uploadedAt: IsoTimestamp | null;

  /* --- P1.1 (Q-18) retention. Moi field mot vai tro, khong field nao trung nghia. --- */
  /** Lan doc gan nhat. Luat 30 ngay tinh theo day, KHONG theo createdAt. */
  lastAccessedAt: IsoTimestamp | null;
  retentionState: RetentionState;
  /** Tu luc nao bi giu theo yeu cau phap ly (de audit). */
  legalHoldAt: IsoTimestamp | null;
  /** Co nghia khi retentionState = 'scheduled_for_deletion'. */
  scheduledDeletionAt: IsoTimestamp | null;
  /** Moc tinh thoi gian giu dau vet sau khi xoa. */
  deletedAt: IsoTimestamp | null;
  /** Biet ban ghi da duoc ap luat phien ban nao. */
  retentionPolicyVersion: number;
}

/**
 * Chi tra entity contract khi da do that su. Tra null neu chua co byte
 * => khong ton tai duong nao lam ra mot SourceFile voi so lieu bia.
 */
export function toSourceFile(record: SourceFileRecord): SourceFile | null {
  if (record.uploadState !== 'stored' || record.measured === null) return null;
  const m = record.measured;
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    storageKey: record.storageKey,
    originalFilename: record.originalFilename,
    mimeType: m.mimeType,
    byteSize: m.byteSize,
    checksumSha256: m.checksumSha256,
    mediaType: m.mediaType,
    durationSeconds: m.durationSeconds,
    widthPx: m.widthPx,
    heightPx: m.heightPx,
    hasAudioStream: m.hasAudioStream,
    uploadedAt: record.uploadedAt ?? record.createdAt,
    immutable: true,
  };
}

/**
 * P2-MCP-25: phien dang nhap luu BEN VUNG.
 *
 * CHI luu hash cua token - dump database khong lam lo mot token dung duoc.
 * Thu hoi la GHI MOC (`revokedAt`), khong xoa dong: con dau vet de audit.
 */
export interface SessionRecord {
  id: Id;
  userId: Id;
  tokenHash: string;
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  revokedAt: IsoTimestamp | null;
}

/**
 * P2-MCP-35: mot luot tai len nhieu manh.
 *
 * `receivedChunks` la thu DUY NHAT cho phep "tai tiep tu cho dut" - khong co no thi mat ket noi
 * nghia la lam lai tu dau. Luu chi so chu khong luu co, vi co manh suy ra duoc tu
 * `chunkSizeBytes` va `declaredByteSize`.
 */
export interface UploadSessionRecord {
  id: Id;
  workspaceId: Id;
  projectId: Id;
  assetId: Id;
  sourceFileId: Id;
  /** Khoa CUOI CUNG cua tep nguon. Manh khong ghi vao day. */
  storageKey: string;
  contentType: string;
  declaredByteSize: number;
  chunkSizeBytes: number;
  totalChunks: number;
  receivedChunks: number[];
  state: 'open' | 'completed' | 'aborted';
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
}

/** P3-MCP-30: ban proxy do phan giai thap. KHONG thay the tep goc (I-1). */
export interface VideoProxyRecord {
  id: Id;
  workspaceId: Id;
  assetId: Id;
  sourceFileId: Id;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  widthPx: number | null;
  heightPx: number | null;
  durationSeconds: number | null;
  /** DA DO va thay/khong thay — khac han "chua do duoc". */
  hasAudio: boolean;
  createdAt: IsoTimestamp;
}

/** P2-MCP-27: ban ket qua da luu. Cung hinh dang voi `OutputAsset` cua contract. */
export type OutputAssetRecord = OutputAsset;

export type ValidationState = 'not_validated' | 'passed' | 'failed';

export interface ValidationRecord {
  id: Id;
  workspaceId: Id;
  assetId: Id;
  sourceFileId: Id;
  state: Exclude<ValidationState, 'not_validated'>;
  errors: ApiError[];
  validatedAt: IsoTimestamp;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageQuery {
  cursor?: string | null;
  limit?: number;
}

export type { RetentionState };
export type { Asset, AuditEvent, ProcessingJob, ProcessingReceipt, ProvenanceRecord, Project, RightsAttestation, UsageLedgerEntry, User, Workspace, WorkspaceMembership };

/** P4-MCP-40: tong so frame KY VONG, do tren tep that. Tach khoi bang frame de con cho DOI CHIEU. */
export interface JobFrameTimelineRecord {
  jobId: Id;
  workspaceId: Id;
  expectedFrameCount: number;
  declaredFrameCount: number | null;
  decodedFrameCount: number;
  undecodableFrames: number;
  fps: number | null;
  variableFrameRate: boolean;
  createdAt: IsoTimestamp;
}

/** P4-MCP-41/42: trang thai MOT frame. Mot dong moi frame — de dem duoc. */
export interface JobFrameRecord {
  jobId: Id;
  workspaceId: Id;
  frameIndex: number;
  state: FrameState;
  box: MaskBox | null;
  /** `null` KHAC `0`: null = provider khong tra so nao. */
  confidence: number | null;
  source: MaskSource;
  updatedAt: IsoTimestamp;
}

/** P4-MCP-42: mot lan nguoi that sua mask. APPEND-ONLY. */
export interface JobFrameCorrectionRecord {
  id: Id;
  jobId: Id;
  workspaceId: Id;
  frameIndex: number;
  beforeState: FrameState;
  beforeSource: MaskSource;
  beforeBox: MaskBox | null;
  beforeConfidence: number | null;
  afterBox: MaskBox;
  reinterpolated: number[];
  correctedAt: IsoTimestamp;
  actorUserId: Id | null;
}
