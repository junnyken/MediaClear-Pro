/**
 * Lich kiem LUC CHAY cho TOAN BO phan hoi ma giao dien doc (dong not D-047).
 *
 * `D-051` da dong lo hong nay cho cac endpoint Phase 3. Tep nay dong phan con lai.
 *
 * Vi sao can: truoc day moi man hinh TU KHAI lai hinh dang phan hoi bang `apiFetch<T>` — mot loi
 * khang dinh kieu khong ai kiem. Hau qua do duoc, khong phai gia dinh:
 *
 *  - `MeResponse` duoc khai BA KIEU khac nhau o ba tep (co `email` o trang nay, khong co o trang kia)
 *  - `UsageResponse` khai 4 truong o `page.tsx` va 7 truong o `usage/page.tsx`
 *  - `AssetView` khai mot mau o `upload/page.tsx` va mau khac o `assets/[assetId]/page.tsx`
 *
 * Khong ban nao trong so do duoc doi chieu voi may chu. Doi hinh dang phan hoi lam trang hong LUC
 * CHAY trong khi `tsc` ca hai ben deu xanh — da xay ra that o trang Hoat dong (D-047).
 *
 * Nguyen tac: truong THUA bi bo qua (may chu them field khong lam hong giao dien cu), truong
 * THIEU bao loi — do moi la thu pha giao dien. Nen mot man hinh chi dung mot phan phan hoi VAN
 * dung duoc lich kiem day du.
 */
import { arrayOf, boolean, enumOf, nullable, number, object, optional, string } from './schema.js';
import { JOB_STATE_SCHEMA } from './phase3.js';
import { FRAME_STATES, MASK_SOURCES, QUALITY_GATE_REASONS, QUALITY_GATE_VERDICTS } from './phase4.js';
import {
  BRAND_KIT_STATES, DISCLOSURE_STATES, METADATA_CATEGORIES, METADATA_FIELD_STATUSES,
  METADATA_VERDICTS, OVERLAY_POSITIONS, PROVENANCE_NODE_KINDS,
} from './phase5.js';
import { EVIDENCE_STATUSES } from './vocabulary.js';
import type { Infer } from './schema.js';

/* ------------------------------------------------------------- chung --- */

/** Loi tra ve cho client: `messageKey` la KHOA i18n, khong phai cau da dich. */
export const API_ERROR_SCHEMA = object({
  code: string(),
  messageKey: string(),
  params: optional(object({})),
});

const ID_NAME = { id: string(), name: string() };

/* -------------------------------------------------------- phien / me --- */

export const SESSION_RESPONSE_SCHEMA = object({
  token: string(),
  userId: string(),
  expiresAt: string(),
  productionAuthProvider: boolean(),
});
export type SessionResponse = Infer<typeof SESSION_RESPONSE_SCHEMA>;

export const ME_RESPONSE_SCHEMA = object({
  user: object({
    id: string(),
    email: string(),
    displayName: string(),
    defaultLocale: string(),
  }),
  workspaces: arrayOf(object({ ...ID_NAME, role: string() })),
});
export type MeResponse = Infer<typeof ME_RESPONSE_SCHEMA>;

/* ------------------------------------------------ workspace / project --- */

export const WORKSPACE_LIST_SCHEMA = object({
  items: arrayOf(object({ ...ID_NAME, role: string() })),
});

/*
 * Hai route nay tra object PHANG, khong boc trong `workspace:`/`project:`.
 *
 * Ban dau toi khai chung la `{ workspace: {...} }` — va phep kiem lap tuc bat sai. Day dung la
 * ly do lich kiem ton tai: mot `interface` viet tay se im lang chap nhan hinh dang sai cho toi
 * khi nguoi dung bam vao va trang hong.
 */
export const WORKSPACE_CREATED_SCHEMA = object({ ...ID_NAME, role: string() });
export const PROJECT_CREATED_SCHEMA = object({ ...ID_NAME, createdAt: string() });

export const PROJECT_LIST_SCHEMA = object({
  items: arrayOf(object({ ...ID_NAME, createdAt: string() })),
  nextCursor: nullable(string()),
});

export const PROJECT_DETAIL_SCHEMA = object({ ...ID_NAME, createdAt: string() });

export const ASSET_LIST_SCHEMA = object({
  items: arrayOf(object({ id: string(), mediaType: string(), createdAt: string() })),
  nextCursor: nullable(string()),
});

/* ----------------------------------------------------------- tep goc --- */

/** `measured` la `null` khi CHUA co byte nao ve — khong phai so 0. */
export const MEASURED_SCHEMA = object({
  mimeType: string(),
  byteSize: number(),
  checksumSha256: string(),
  mediaType: string(),
  durationSeconds: nullable(number()),
  widthPx: nullable(number()),
  heightPx: nullable(number()),
  hasAudioStream: nullable(boolean()),
  corrupt: boolean(),
});

export const ASSET_VIEW_SCHEMA = object({
  asset: object({ id: string(), mediaType: string(), projectId: string() }),
  sourceFile: object({
    originalFilename: string(),
    declaredMimeType: string(),
    uploadState: string(),
    measured: nullable(MEASURED_SCHEMA),
  }),
  validation: object({
    state: string(),
    errors: arrayOf(API_ERROR_SCHEMA),
    validatedAt: nullable(string()),
  }),
  rightsAttestation: object({
    status: string(),
    attestedAt: nullable(string()),
    statementVersion: nullable(number()),
  }),
});

export const RETENTION_VIEW_SCHEMA = object({
  assetId: string(),
  retentionState: string(),
  lastAccessedAt: nullable(string()),
  retainUntil: nullable(string()),
  deletionCandidate: boolean(),
  reason: nullable(string()),
});

export const UPLOAD_INTENT_SCHEMA = object({
  assetId: string(),
  sourceFileId: string(),
  uploadUrl: string(),
  expiresAt: optional(string()),
});

export const VALIDATION_RESULT_SCHEMA = object({
  assetId: string(),
  valid: boolean(),
  errors: arrayOf(API_ERROR_SCHEMA),
});

export const RIGHTS_STATEMENT_SCHEMA = object({
  statement: object({
    id: string(),
    version: number(),
    i18nKey: string(),
    validityDays: number(),
  }),
});

/* --------------------------------------------------------- muc dung --- */

export const USAGE_SUMMARY_SCHEMA = object({
  workspaceId: string(),
  imageUnitsCommitted: number(),
  videoMinuteUnitsCommitted: number(),
  imageUnitsReserved: number(),
  videoMinuteUnitsReserved: number(),
  /** P1.1: da qua han giu nhung chua hoan tra — KHONG dem nhu dang giu. */
  imageUnitsExpired: number(),
  videoMinuteUnitsExpired: number(),
  entries: arrayOf(object({
    id: string(),
    jobId: string(),
    unitType: string(),
    quantity: number(),
    entryType: string(),
    reasonCode: nullable(string()),
    recordedAt: string(),
  })),
});

/* -------------------------------------------------------------- job --- */

export const JOB_VIEW_SCHEMA = object({
  job: object({
    id: string(),
    assetId: string(),
    state: JOB_STATE_SCHEMA,
    reasonCode: nullable(string()),
    blockReasonKind: nullable(string()),
    request: object({ operations: arrayOf(string()) }),
    outputAssetId: nullable(string()),
  }),
  providerCapability: string(),
  productionProcessingEnabled: boolean(),
  usage: object({
    unitType: string(),
    quantity: number(),
    state: string(),
    expiresAt: nullable(string()),
  }),
});

export const JOB_CREATED_SCHEMA = object({ job: object({ id: string(), state: JOB_STATE_SCHEMA }) });

export const SIGNED_URL_SCHEMA = object({
  url: string(),
  expiresAt: optional(string()),
  byteSize: optional(number()),
  checksumSha256: optional(string()),
});

/* -------------------------------------------------------- nhat ky --- */

export const AUDIT_PAGE_SCHEMA = object({
  items: arrayOf(object({
    id: string(),
    eventType: string(),
    subjectType: string(),
    subjectId: nullable(string()),
    occurredAt: string(),
  })),
  nextCursor: nullable(string()),
});

/* ------------------------------------------- ban ket qua / bien nhan --- */

export const JOB_OUTPUT_SCHEMA = object({
  outputAssetId: string(),
  mimeType: string(),
  byteSize: number(),
  checksumSha256: string(),
  /** I-2: chi true SAU KHI doc lai byte va do lai. */
  validated: boolean(),
  createdAt: string(),
});

const AUDIO_ROW_SCHEMA = object({
  present: boolean(),
  codec: nullable(string()),
  durationSeconds: nullable(number()),
  channelCount: nullable(number()),
});

const PROVENANCE_ROW_SCHEMA = object({
  id: string(),
  originalMetadataPresence: string(),
  aiProvenancePresence: string(),
  /** KHOA i18n, khong phai cau chu — giao dien phai `translate()` no. */
  limitationNote: nullable(string()),
  evidenceStatus: string(),
});

export const JOB_RECEIPT_SCHEMA = object({
  receipt: object({
    id: string(),
    jobId: string(),
    operations: arrayOf(string()),
    evidenceStatus: string(),
    provenanceBeforeId: string(),
    provenanceAfterId: nullable(string()),
    invisibleWatermarkDisclaimerKey: string(),
    /* P3: `null` voi bien nhan ANH — "khong ap dung", khong phai "chua do duoc". */
    operationMode: nullable(string()),
    presetId: nullable(string()),
    audioBefore: nullable(AUDIO_ROW_SCHEMA),
    audioAfter: nullable(AUDIO_ROW_SCHEMA),
    audioVerdict: nullable(string()),
    outputVerified: boolean(),
    reviewReason: nullable(string()),
    /* P5 (`D-075`). `null` = khong do duoc / khong ap dung — khong phai gia tri mac dinh. */
    metadataVerdict: nullable(enumOf(METADATA_VERDICTS)),
    metadataStrippedCategories: arrayOf(enumOf(METADATA_CATEGORIES)),
    disclosureState: nullable(enumOf(DISCLOSURE_STATES)),
    /** LUON di kem khi co `disclosureState`: khong ket luan nao o day la tuyet doi. */
    disclosureLimitationKey: nullable(string()),
    brandKitId: nullable(string()),
    brandKitVersion: nullable(number()),
    schemaVersion: number(),
  }),
  provenanceBefore: PROVENANCE_ROW_SCHEMA,
  provenanceAfter: nullable(PROVENANCE_ROW_SCHEMA),
});

export const JOB_PREVIEW_SCHEMA = object({
  mode: string(),
  /** Luon false (I-12). Loi TU KHAI kiem tra duoc tu ben ngoai. */
  billable: boolean(),
  operation: string(),
  widthPx: number(),
  heightPx: number(),
  byteSize: number(),
  imageDataUri: string(),
});

/* --------------------------------------------------------- Phase 4 (MCP-40…44) --- */

/**
 * Trang thai frame — MOT nguon su that cho ca UI lan may chu (`D-047`).
 *
 * Danh sach lay THANG tu `FRAME_STATES`, khong chep tay sang day: chep tay la tao ra nguon su that
 * thu hai, va hai nguon do se troi khac nhau dung luc khong ai nhin.
 */
export const FRAME_STATE_SCHEMA = enumOf(FRAME_STATES);
export const MASK_SOURCE_SCHEMA = enumOf(MASK_SOURCES);

export const MASK_BOX_SCHEMA = object({
  x: number(),
  y: number(),
  width: number(),
  height: number(),
});

export const FRAME_VIEW_SCHEMA = object({
  index: number(),
  state: FRAME_STATE_SCHEMA,
  box: nullable(MASK_BOX_SCHEMA),
  /** `null` = provider khong tra ve so nao. KHAC han `0`. */
  confidence: nullable(number()),
  source: MASK_SOURCE_SCHEMA,
});

export const FRAME_TIMELINE_SCHEMA = object({
  expectedFrameCount: number(),
  reportedFrameCount: number(),
  missing: number(),
  lowConfidence: number(),
  reviewRequired: number(),
  failed: number(),
  ok: number(),
  canComplete: boolean(),
});

/**
 * Ket qua cong chan chat luong.
 *
 * `counts` la thu cho phep UI noi CU THE ("12 frame do tin cay thap") thay vi mot nhan chung —
 * de bai doi dung dieu do.
 */
export const QUALITY_GATE_SCHEMA = object({
  verdict: enumOf(QUALITY_GATE_VERDICTS),
  reasons: arrayOf(enumOf(QUALITY_GATE_REASONS)),
  counts: object(Object.fromEntries(QUALITY_GATE_REASONS.map((r) => [r, number()]))),
});

/**
 * `D-074` — ket qua cua LAN SUA gan nhat.
 *
 * Co mat trong ca phan hoi doc lan phan hoi ghi, cung mot hinh dang. `null` = chua ai sua.
 *
 * `reinterpolated` la danh sach THAT cac frame lan can da duoc tinh lai. Truoc `D-074` duong API
 * luon ghi `[]` du no khong tinh gi — mot o trong noi doi im lang, va do chinh la `Q-P4-05`.
 */
export const CORRECTION_SUMMARY_SCHEMA = object({
  frameIndex: number(),
  reinterpolated: arrayOf(number()),
  /** So doan mask nhay, do ngay truoc va ngay sau lan sua. `null` = khong do duoc. */
  flickerBefore: nullable(number()),
  flickerAfter: nullable(number()),
  gateVerdictBefore: nullable(enumOf(QUALITY_GATE_VERDICTS)),
  gateVerdictAfter: nullable(enumOf(QUALITY_GATE_VERDICTS)),
  correctedAt: string(),
});

export const FRAME_TRACKING_VIEW_SCHEMA = object({
  jobId: string(),
  jobState: JOB_STATE_SCHEMA,
  timeline: FRAME_TIMELINE_SCHEMA,
  frames: arrayOf(FRAME_VIEW_SCHEMA),
  gate: QUALITY_GATE_SCHEMA,
  lastCorrection: nullable(CORRECTION_SUMMARY_SCHEMA),
});

export type FrameTrackingView = Infer<typeof FRAME_TRACKING_VIEW_SCHEMA>;

/* ------------------------------------------------------------------- Phase 5 (D-075) */

export const METADATA_FIELD_COMPARISON_SCHEMA = object({
  key: string(),
  category: enumOf(METADATA_CATEGORIES),
  before: nullable(string()),
  after: nullable(string()),
  status: enumOf(METADATA_FIELD_STATUSES),
});

/**
 * Ket qua doi chieu metadata cua MOT luot xu ly.
 *
 * `verdict` KHONG duoc suy o giao dien — no den tu `compareMetadata` cua contract. Hai ben tu tinh
 * lay se lech nhau dung o cho nguy hiem nhat (`D-047`).
 */
export const METADATA_COMPARISON_SCHEMA = object({
  verdict: enumOf(METADATA_VERDICTS),
  fields: arrayOf(METADATA_FIELD_COMPARISON_SCHEMA),
  strippedCategories: arrayOf(enumOf(METADATA_CATEGORIES)),
  evidenceStatus: enumOf(EVIDENCE_STATUSES),
  /** `false` = mot trong hai anh chup khong doc duoc. Khac han "khong co truong nao". */
  bothReadable: boolean(),
});

export const DISCLOSURE_SCHEMA = object({
  state: nullable(enumOf(DISCLOSURE_STATES)),
  /** LUON co khi co `state`: khong ket luan nao o day la tuyet doi. */
  limitationKey: nullable(string()),
  evidenceStatus: enumOf(EVIDENCE_STATUSES),
});

export const PROVENANCE_NODE_SCHEMA = object({
  kind: enumOf(PROVENANCE_NODE_KINDS),
  id: string(),
  occurredAt: string(),
  parentId: nullable(string()),
  labelKey: string(),
  detail: arrayOf(object({ key: string(), value: nullable(string()), valueKey: nullable(string()) })),
  evidenceStatus: enumOf(EVIDENCE_STATUSES),
});

/**
 * Dong thoi gian nguon goc.
 *
 * `orphanIds` co mat trong hop dong CO CHU DINH: muc mo coi phai di qua duoc bien gioi API de giao
 * dien hien ra. Loc chung o may chu se lam dong thoi gian trong nhu da day du — dung kieu noi doi
 * ma `MCP-50` ton tai de chan.
 */
export const PROVENANCE_TIMELINE_SCHEMA = object({
  assetId: string(),
  nodes: arrayOf(PROVENANCE_NODE_SCHEMA),
  orphanIds: arrayOf(string()),
  limitationKeys: arrayOf(string()),
});

export const BRAND_KIT_VERSION_SCHEMA = object({
  version: number(),
  name: string(),
  colors: arrayOf(string()),
  logoAssetId: nullable(string()),
  overlayDefaults: object({
    position: enumOf(OVERLAY_POSITIONS),
    opacity: number(),
    includeDisclosure: boolean(),
  }),
  createdAt: string(),
  createdByUserId: nullable(string()),
});

export const BRAND_KIT_SCHEMA = object({
  id: string(),
  state: enumOf(BRAND_KIT_STATES),
  currentVersion: number(),
  createdAt: string(),
  updatedAt: string(),
  /** Lich su phien ban. BAT BIEN — khong duong nao sua mot phien ban da ghi. */
  versions: arrayOf(BRAND_KIT_VERSION_SCHEMA),
});

export const BRAND_KIT_LIST_SCHEMA = object({ items: arrayOf(BRAND_KIT_SCHEMA) });

export type ProvenanceTimelineView = Infer<typeof PROVENANCE_TIMELINE_SCHEMA>;
export type BrandKitView = Infer<typeof BRAND_KIT_SCHEMA>;
export type MetadataComparisonView = Infer<typeof METADATA_COMPARISON_SCHEMA>;
