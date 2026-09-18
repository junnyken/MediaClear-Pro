/**
 * Phase 5 — Provenance & Brand Kit (MCP-50…54).
 *
 * NOI DUY NHAT dinh nghia luat cua Phase 5. UI, API, worker va tang luu tru deu hoi o day (`D-047`).
 *
 * BA CAU HOI Phase 5 phai tra loi TRUNG THUC, va cho nao trong file nay thi hanh chung:
 *
 *   1. "Metadata co con nguyen khong" -> `compareMetadata` doi chieu TUNG TRUONG, khong ket luan
 *      chung chung. Khong do duoc mot truong thi truong do la `unknown`, khong phai `preserved`.
 *   2. "Tep nay co phai do AI tao ra khong" -> `disclosureStatusFor`. KHONG bao gio bien `unknown`
 *      thanh mot ket luan. `absent` cua bo do C2PA nghia la "khong thay dau hieu", KHONG phai
 *      "chac chan khong phai AI".
 *   3. "Ban xuat nay da ap dung gi" -> bo nhan dien (`BrandKit`) phai duoc GHI vao bien nhan neu
 *      da ap dung, va khong bao gio duoc tu ap dung khi nguoi dung chua chon.
 */
import type { EvidenceStatus, Presence } from './vocabulary.js';

/* ------------------------------------------------ MCP-51: metadata theo TUNG TRUONG */

/**
 * Nhom metadata. Tach ra vi moi nhom co luat rieng — dac biet `location` va `device`.
 *
 * Gop het thanh mot khoi "metadata" roi bao "da giu" la cach de nhat de vua noi doi vua lo du
 * lieu nhay cam: giu GPS cua nguoi dung qua mot ban xuat cong khai KHONG phai la mot tinh nang.
 */
export const METADATA_CATEGORIES = [
  'technical',
  'descriptive',
  'location',
  'device',
  'provenance',
  'container',
] as const;
export type MetadataCategory = (typeof METADATA_CATEGORIES)[number];

/**
 * Nhom bi GO BO CO CHU DINH theo chinh sach.
 *
 * **RONG, va day la mot quyet dinh co can cu — xem `Q-P5-02`.**
 *
 * Ban dau danh sach nay la `['location', 'device']`, theo yeu cau bao ve du lieu nhay cam. Do THAT
 * tren mot luot chay production lai lo ra mot xung dot:
 *
 *   `preserveOriginalMetadata` la `true` **CO DINH** theo **guardrail 6 va 7** — mot cam ket cap
 *   owner rang he thong GIU NGUYEN thong tin goc. Duong xu ly anh goi `.withMetadata()` o moi cho
 *   ghi, va do duoc: `exif.Make = 'MatBao'` di nguyen ven tu tep vao sang ban xuat.
 *
 * Nen he thong **khong go gi ca**. Neu danh sach nay van khai `['location','device']` thi mot
 * truong vi tri bien mat VI BAT KY LY DO NAO (ffmpeg khong mang tag sang, dinh dang dich khong ho
 * tro) se bi goi ten la "go theo chinh sach" — tuc la he thong nhan cong mot viec no khong lam, va
 * che mat mot mat mat that. Do dung la kieu noi doi `MCP-51` ton tai de chan.
 *
 * Danh sach rong nghia la: moi truong bien mat deu duoc goi dung ten la `removed`.
 *
 * Kha nang phan loai VAN CON — `compareMetadata` nhan danh sach nay lam tham so. Khi owner quyet
 * (go them, hay giu nguyen guardrail 6/7), doi dung mot hang so nay la du.
 */
export const METADATA_CATEGORIES_STRIPPED_BY_DEFAULT: readonly MetadataCategory[] = [];

export function categoryStrippedByDefault(category: MetadataCategory): boolean {
  return METADATA_CATEGORIES_STRIPPED_BY_DEFAULT.includes(category);
}

/**
 * Trang thai cua MOT truong metadata sau khi xu ly.
 *
 * `removed_by_policy` tach han khoi `removed`: mot ben la quyet dinh, mot ben la mat mat. Gop hai
 * cai lai thi khong con phan biet duoc "he thong lam dung viec cua no" voi "he thong lam hong tep".
 */
export const METADATA_FIELD_STATUSES = [
  'preserved',
  'changed',
  'removed',
  'removed_by_policy',
  'added',
  'not_available',
  'unknown',
] as const;
export type MetadataFieldStatus = (typeof METADATA_FIELD_STATUSES)[number];

/** Gia tri mot truong metadata. `null` = KHONG CO. `undefined` khong duoc dung o day. */
export type MetadataValue = string | number | boolean | null;

export interface MetadataField {
  key: string;
  category: MetadataCategory;
  value: MetadataValue;
}

/**
 * Anh chup metadata tai MOT thoi diem.
 *
 * `readable: false` nghia la KHONG DOC DUOC ca anh chup — khac han mot anh chup rong. Anh chup
 * rong la "da doc va khong co truong nao"; khong doc duoc la "khong biet gi ca".
 */
export interface MetadataSnapshot {
  readable: boolean;
  fields: MetadataField[];
  /** Bo do da sinh ra anh chup nay, de ve sau biet ket luan den tu dau. */
  detectorId: string;
  /**
   * `D-076` — truong he thong BIET la co the ton tai nhung KHONG DO DUOC.
   *
   * Day la cho de noi doi nhat trong ca Phase 5. Bo doc EXIF cua he thong chi phu mot DANH SACH
   * DONG 5 the (`Q-P5-04`); the ngoai danh sach khong duoc doc. Neu chung don gian la vang mat
   * khoi `fields` thi phep doi chieu se khong bao gio nhac toi chung — va bao cao "da giu nguyen"
   * se dung ve nhung the da do va IM LANG ve phan con lai.
   *
   * Liet ke chung o day bien su im lang do thanh mot cau tra loi: `unknown`.
   */
  unmeasuredKeys: string[];
}

export interface MetadataFieldComparison {
  key: string;
  category: MetadataCategory;
  before: MetadataValue;
  after: MetadataValue;
  status: MetadataFieldStatus;
  /**
   * `D-076`. CHI khac `null` khi `status === 'changed'`.
   *
   * Mot truong doi gia tri ma bao cao khong noi duoc VI SAO thi do chi la mot canh bao trong —
   * nguoi dung khong lam duoc gi voi no.
   */
  changeReason: MetadataChangeReason | null;
}

/** Ket luan CHUNG. Chi duoc `preserved` khi KHONG con truong nao `unknown`. */
export const METADATA_VERDICTS = ['preserved', 'partially_preserved', 'changed', 'unknown'] as const;
export type MetadataVerdict = (typeof METADATA_VERDICTS)[number];

export interface MetadataComparison {
  /**
   * Ket luan ve PHAN DA DO.
   *
   * KHONG bao gom truong chua do duoc — neu bao gom, verdict se LUON la `unknown` (vi bo doc luon
   * co the ke ra the no khong doc), va mot ket luan luon giong nhau thi khong con la ket luan.
   * Do phu cua phep do duoc noi RIENG o `unmeasuredCount` va `evidenceStatus`.
   */
  verdict: MetadataVerdict;
  fields: MetadataFieldComparison[];
  counts: Record<MetadataFieldStatus, number>;
  /** Nhom co it nhat mot truong bi go theo chinh sach — de giao dien noi ro. */
  strippedCategories: MetadataCategory[];
  /**
   * So truong he thong BIET la co the ton tai nhung KHONG doc duoc.
   *
   * `> 0` keo `evidenceStatus` xuong `partially_verified`: phan da do la dung, nhung bao cao KHONG
   * phu het. Giau con so nay di se lam "da giu nguyen" nghe nhu mot ket luan day du.
   */
  unmeasuredCount: number;
  evidenceStatus: EvidenceStatus;
}

const emptyCounts = (): Record<MetadataFieldStatus, number> =>
  Object.fromEntries(METADATA_FIELD_STATUSES.map((s) => [s, 0])) as Record<MetadataFieldStatus, number>;

/**
 * Doi chieu metadata TRUOC va SAU, TUNG TRUONG.
 *
 * VI SAO KHONG DUOC KET LUAN CHUNG CHUNG: "metadata preserved" sau khi chi kiem vai truong la mot
 * lo hong quen thuoc — no dung voi nhung truong da kiem va noi doi ve phan con lai. Nen ham nay
 * lay HOP cua ca hai phia lam tap khoa, va moi khoa deu phai co mot trang thai.
 *
 * LUAT:
 *
 *  - Mot trong hai anh chup khong doc duoc  -> toan bo la `unknown`, verdict `unknown`.
 *  - Truong thuoc nhom bi go theo chinh sach, va da bien mat -> `removed_by_policy` (dung y do).
 *  - Con o ca hai phia, bang nhau                            -> `preserved`.
 *  - Con o ca hai phia, khac nhau                            -> `changed`.
 *  - Chi co o phia truoc                                     -> `removed`.
 *  - Chi co o phia sau                                       -> `added`.
 *  - Khong co o ca hai phia                                  -> `not_available`.
 *
 * VERDICT:
 *
 *  - Con bat ky `unknown` nao      -> `unknown`. KHONG duoc noi "da giu" khi con cho chua do duoc.
 *  - Co `changed`/`removed`/`added`-> `changed`.
 *  - Chi co `removed_by_policy`    -> `partially_preserved`: dung y do, nhung tep KHONG con nguyen.
 *  - Con lai                       -> `preserved`.
 */
/**
 * `D-076` — CHINH SACH metadata mac dinh, viet thanh ma chu khong chi thanh cau.
 *
 * `preserve`: giu nguyen thong tin goc. Day la cam ket cap owner (guardrail 6/7) va da do duoc tren
 * luot chay that: `exif.Make = 'MatBao'` di nguyen ven tu tep vao sang ban xuat.
 *
 * KHONG co gia tri `redact` o day. Xoa vi tri/thiet bi la mot THAO TAC RIENG do nguoi dung yeu cau
 * va duoc ghi rieng — khong phai mot hanh vi mac dinh am tham. Them mot gia tri vao enum nay ma
 * duong xu ly chua thi hanh se lam he thong khai mot chinh sach no khong lam.
 */
export const METADATA_POLICIES = ['preserve'] as const;
export type MetadataPolicy = (typeof METADATA_POLICIES)[number];
export const DEFAULT_METADATA_POLICY: MetadataPolicy = 'preserve';

/**
 * Ly do mot truong ĐỔI gia tri. Doi ma khong noi duoc VI SAO thi bao cao chi la mot canh bao trong.
 */
export const METADATA_CHANGE_REASONS = [
  /** Doi dinh dang chua (vd jpeg -> png) keo theo doi thuoc tinh. */
  'container_conversion',
  /** Duong xu ly ve lai diem anh (lam mo, cat, dan lop phu). */
  'pipeline_render',
  /** Do duoc la da doi, nhung he thong khong quy duoc ve nguyen nhan nao. */
  'unattributed',
] as const;
export type MetadataChangeReason = (typeof METADATA_CHANGE_REASONS)[number];

/**
 * Truong bi doi boi viec doi dinh dang. Danh sach DONG, va la ly do co the noi ra duoc.
 *
 * Ngoai danh sach nay, mot truong doi gia tri se duoc quy cho `pipeline_render` — cung la mot cau
 * tra loi THAT, chu khong phai mot o trong.
 */
const CONTAINER_CONVERSION_KEYS: readonly string[] = [
  'image.format', 'image.channels', 'image.hasIcc', 'image.space', 'image.density',
  'container.format', 'video.codec', 'audio.codec',
];

function changeReasonFor(key: string): MetadataChangeReason {
  if (CONTAINER_CONVERSION_KEYS.includes(key)) return 'container_conversion';
  return 'pipeline_render';
}

export function compareMetadata(
  before: MetadataSnapshot,
  after: MetadataSnapshot,
  strippedCategories: readonly MetadataCategory[] = METADATA_CATEGORIES_STRIPPED_BY_DEFAULT,
): MetadataComparison {
  const counts = emptyCounts();

  if (!before.readable || !after.readable) {
    /*
     * Mot phep do THAT BAI khong phai bang chung rang metadata con nguyen — cung khong phai bang
     * chung rang no da mat. Khong doc duoc thi cau tra loi duy nhat dung la "khong biet".
     */
    const keys = [...new Set([...before.fields, ...after.fields].map((f) => f.key))].sort();
    const fields = keys.map((key) => {
      const b = before.fields.find((f) => f.key === key);
      const a = after.fields.find((f) => f.key === key);
      counts.unknown += 1;
      return {
        key,
        category: (b?.category ?? a?.category ?? 'technical') as MetadataCategory,
        before: b?.value ?? null,
        after: a?.value ?? null,
        status: 'unknown' as const,
        changeReason: null,
      };
    });
    return {
      verdict: 'unknown', fields, counts, strippedCategories: [],
      unmeasuredCount: fields.length, evidenceStatus: 'unknown',
    };
  }

  /*
   * Tap khoa = hop cua CA BA nguon: truong doc duoc o hai phia, VA truong he thong biet la khong do
   * duoc. Bo nguon thu ba thi truong chua do se bien mat khoi bao cao thay vi duoc goi la `unknown`.
   */
  const unmeasured = new Set([...before.unmeasuredKeys, ...after.unmeasuredKeys]);
  const keys = [...new Set([
    ...before.fields.map((f) => f.key),
    ...after.fields.map((f) => f.key),
    ...unmeasured,
  ])].sort();
  const stripped = new Set<MetadataCategory>();

  const fields = keys.map((key): MetadataFieldComparison => {
    const b = before.fields.find((f) => f.key === key);
    const a = after.fields.find((f) => f.key === key);
    const category = (b?.category ?? a?.category ?? 'technical') as MetadataCategory;
    const bv = b?.value ?? null;
    const av = a?.value ?? null;

    let status: MetadataFieldStatus;
    /*
     * `D-076`, luat dau tien: CHUA DO thi la `unknown`, khong phai `not_available`.
     *
     * `not_available` nghia la "da tim va khong co". Dung no cho mot truong chua he duoc tim la
     * bien mot khoang trong trong phep do thanh mot ket luan — dung loi `D-044`.
     */
    if (unmeasured.has(key)) status = 'unknown';
    else if (bv === null && av === null) status = 'not_available';
    else if (bv !== null && av === null) {
      status = strippedCategories.includes(category) ? 'removed_by_policy' : 'removed';
      if (status === 'removed_by_policy') stripped.add(category);
    } else if (bv === null && av !== null) status = 'added';
    else status = bv === av ? 'preserved' : 'changed';

    counts[status] += 1;
    return {
      key, category, before: bv, after: av, status,
      changeReason: status === 'changed' ? changeReasonFor(key) : null,
    };
  });

  /*
   * Verdict tinh tren PHAN DA DO. `counts.unknown` o day chinh la so truong chua do duoc, va no
   * KHONG duoc keo verdict ve `unknown` — neu keo, moi phep doi chieu se cho cung mot ket qua.
   * Do phu duoc noi rieng ngay duoi.
   */
  const verdict: MetadataVerdict =
    counts.changed > 0 || counts.removed > 0 || counts.added > 0 ? 'changed'
      : counts.removed_by_policy > 0 ? 'partially_preserved'
        : 'preserved';

  return {
    verdict,
    fields,
    counts,
    strippedCategories: [...stripped].sort(),
    unmeasuredCount: counts.unknown,
    /*
     * `verified` CHI khi da doc duoc ca hai phia VA khong con truong nao chua do.
     *
     * Con truong chua do => `partially_verified`: phan da do la dung, nhung bao cao khong phu het.
     * Goi do la `verified` se la cach de nhat de tu phong cap bang chung — mot bao cao dung ve
     * nam truong no nhin thay va im lang ve muoi truong no khong nhin thay.
     */
    evidenceStatus: counts.unknown > 0 ? 'partially_verified' : 'verified',
  };
}

/* ------------------------------------------------ MCP-54: cong bo AI (disclosure) */

/**
 * Trang thai cong bo. SAU gia tri, va khong gia tri nao duoc suy ra tu su vang mat cua gia tri khac.
 */
export const DISCLOSURE_STATES = [
  /** Co bang chung truc tiep rang AI da duoc dung trong luot xu ly NAY. */
  'ai_used',
  /** Co bang chung truc tiep rang KHONG co buoc AI nao. */
  'ai_not_used',
  /** Khong du du lieu de ket luan. Day la gia tri MAC DINH, khong phai gia tri du phong. */
  'ai_status_unknown',
  /** Chi co ket qua do DAU HIEU tren tep dau vao — KHONG phai xac minh chu ky. */
  'ai_detection_only',
  /** Provider chua duoc chon/benchmark. */
  'provider_unknown',
  /** Provider bi chan boi mot phu thuoc cu the. */
  'provider_blocked',
] as const;
export type DisclosureState = (typeof DISCLOSURE_STATES)[number];

export interface DisclosureInput {
  /** Ket qua bo do C2PA tren tep DAU VAO. */
  inputAiPresence: Presence;
  /**
   * Bo do co xac minh CHU KY khong. Trong he thong nay luon `false` (`D-069`): bo do chi doc
   * su hien dien cua ban kha nang, khong kiem chuoi tin cay.
   */
  detectorVerifiesSignature: boolean;
  /** Provider AI da duoc chon va do chua. */
  providerStatus: EvidenceStatus;
  /** Luot xu ly nay co goi buoc AI nao khong. `null` = khong biet. */
  aiStepUsed: boolean | null;
}

export interface DisclosureResult {
  state: DisclosureState;
  /** i18n key giai thich GIOI HAN cua ket luan. Luon co — khong ket luan nao o day la tuyet doi. */
  limitationKey: string;
  evidenceStatus: EvidenceStatus;
}

export const DISCLOSURE_LIMITATION_KEYS = {
  presence_only: 'disclosure.limitation.presence_only',
  no_reader: 'disclosure.limitation.no_reader',
  provider_not_selected: 'disclosure.limitation.provider_not_selected',
  provider_blocked: 'disclosure.limitation.provider_blocked',
  step_measured: 'disclosure.limitation.step_measured',
} as const;

/**
 * Suy trang thai cong bo tu bang chung DANG CO.
 *
 * BA DIEU KHONG BAO GIO DUOC LAM, va moi dieu deu tung la mot cach he thong khac noi doi:
 *
 *  1. `absent` cua bo do KHONG thanh `ai_not_used`. Bo do chi doc ban kha nang cong khai trong
 *     container. Mot tep do AI tao ra roi bi go metadata se cho `absent` — ket luan "khong phai AI"
 *     tu do la sai, va sai theo huong nguy hiem nhat.
 *  2. `unknown` KHONG thanh mot ket luan. Khong doc duoc thi noi la khong biet.
 *  3. `present` KHONG thanh "da xac minh". Co dau hieu khac han co dau hieu THAT va con nguyen ven;
 *     bo do nay khong kiem chu ky nao (`detectorVerifiesSignature`).
 *
 * THU TU UU TIEN co chu dinh: trang thai cua PROVIDER duoc tra loi truoc, vi khi chua co provider
 * that thi moi ket luan ve "AI da lam gi" deu chua co co so.
 */
export function disclosureStatusFor(input: DisclosureInput): DisclosureResult {
  if (input.providerStatus === 'blocked') {
    return {
      state: 'provider_blocked',
      limitationKey: DISCLOSURE_LIMITATION_KEYS.provider_blocked,
      evidenceStatus: 'blocked',
    };
  }
  if (input.providerStatus === 'unknown' || input.providerStatus === 'unconfirmed') {
    return {
      state: 'provider_unknown',
      limitationKey: DISCLOSURE_LIMITATION_KEYS.provider_not_selected,
      evidenceStatus: 'unknown',
    };
  }

  // Do duoc buoc AI cua CHINH luot xu ly nay — bang chung truc tiep nhat.
  if (input.aiStepUsed === true) {
    return { state: 'ai_used', limitationKey: DISCLOSURE_LIMITATION_KEYS.step_measured, evidenceStatus: 'verified' };
  }
  if (input.aiStepUsed === false) {
    return { state: 'ai_not_used', limitationKey: DISCLOSURE_LIMITATION_KEYS.step_measured, evidenceStatus: 'verified' };
  }

  /*
   * Khong do duoc buoc AI. Chi con ket qua do DAU HIEU tren tep dau vao — va no chi noi duoc ve
   * TEP DAU VAO, khong noi duoc gi ve luot xu ly nay.
   */
  if (input.inputAiPresence === 'present') {
    return {
      state: 'ai_detection_only',
      limitationKey: input.detectorVerifiesSignature
        ? DISCLOSURE_LIMITATION_KEYS.step_measured
        : DISCLOSURE_LIMITATION_KEYS.presence_only,
      evidenceStatus: 'partially_verified',
    };
  }

  // `absent` VA `unknown` deu ra day. Day la cho luat 1 duoc thi hanh.
  return {
    state: 'ai_status_unknown',
    limitationKey: input.inputAiPresence === 'absent'
      ? DISCLOSURE_LIMITATION_KEYS.presence_only
      : DISCLOSURE_LIMITATION_KEYS.no_reader,
    evidenceStatus: 'unknown',
  };
}

/* ------------------------------------------------ MCP-53: bo nhan dien thuong hieu */

/** Trang thai mot bo nhan dien. KHONG co `deleted`: khong duong xoa nao trong Phase 5. */
export const BRAND_KIT_STATES = ['active', 'archived'] as const;
export type BrandKitState = (typeof BRAND_KIT_STATES)[number];

/** Vi tri lop phu. Danh sach dong — UI khong duoc tu che them gia tri. */
export const OVERLAY_POSITIONS = ['top_left', 'top_right', 'bottom_left', 'bottom_right'] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export interface BrandKitOverlayDefaults {
  position: OverlayPosition;
  /** 0..1. Do mo cua lop phu. */
  opacity: number;
  /** Co hien lop phu cong bo AI kem theo khong. Mac dinh TAT — `MCP-54` la opt-in. */
  includeDisclosure: boolean;
}

/**
 * Mot PHIEN BAN cua bo nhan dien. Bat bien: khong bao gio sua mot phien ban da ghi.
 *
 * Vi sao phai co phien ban: bien nhan cua mot ban xuat tro toi bo nhan dien da dung. Neu sua truc
 * tiep bo nhan dien thi bien nhan cu se tro toi mot noi dung KHAC voi cai da that su duoc ap dung
 * — tuc la ho so noi doi ve qua khu. Sua = tao phien ban moi.
 */
export interface BrandKitVersion {
  version: number;
  name: string;
  /** Ma mau HEX, da duoc kiem. */
  colors: string[];
  logoAssetId: string | null;
  overlayDefaults: BrandKitOverlayDefaults;
  createdAt: string;
  createdByUserId: string | null;
}

export const MAX_BRAND_COLORS = 12;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const BRAND_KIT_ERRORS = [
  'name_empty',
  'name_too_long',
  'color_invalid',
  'too_many_colors',
  'opacity_out_of_range',
  'position_invalid',
] as const;
export type BrandKitError = (typeof BRAND_KIT_ERRORS)[number];

export const MAX_BRAND_NAME_LENGTH = 80;

/**
 * Kiem mot phien ban bo nhan dien. Tra DANH SACH loi, khong phai boolean.
 *
 * Tra `false` tron thi giao dien chi noi duoc "sai o dau do" — nguoi dung khong sua duoc cai ho
 * khong biet la gi.
 */
export function validateBrandKitDraft(input: {
  name: string;
  colors: readonly string[];
  overlayDefaults: BrandKitOverlayDefaults;
}): BrandKitError[] {
  const errors: BrandKitError[] = [];
  const name = input.name.trim();
  if (name.length === 0) errors.push('name_empty');
  if (name.length > MAX_BRAND_NAME_LENGTH) errors.push('name_too_long');
  if (input.colors.length > MAX_BRAND_COLORS) errors.push('too_many_colors');
  if (input.colors.some((c) => !HEX.test(c))) errors.push('color_invalid');
  const o = input.overlayDefaults;
  if (!Number.isFinite(o.opacity) || o.opacity < 0 || o.opacity > 1) errors.push('opacity_out_of_range');
  if (!OVERLAY_POSITIONS.includes(o.position)) errors.push('position_invalid');
  return errors;
}

/* ------------------------------------------------ MCP-50: dong thoi gian nguon goc */

/**
 * Loai muc trong dong thoi gian. Doc tu cac nguon DA CO (nhat ky, ban ghi nguon goc, bien nhan,
 * ban proxy, khung hinh) — Phase 5 KHONG tao mot bang su kien thu hai.
 *
 * Mot bang thu hai se lap tuc tro thanh nguon su that thu hai, va hai nguon se lech nhau (`D-047`).
 */
export const PROVENANCE_NODE_KINDS = [
  'original_asset',
  'proxy_asset',
  'job',
  'operation',
  'correction',
  'review_decision',
  'output_asset',
  'receipt',
  'disclosure',
] as const;
export type ProvenanceNodeKind = (typeof PROVENANCE_NODE_KINDS)[number];

export interface ProvenanceNode {
  kind: ProvenanceNodeKind;
  /** Khoa on dinh de giao dien lam `key`, va de doi chieu giua hai lan doc. */
  id: string;
  occurredAt: string;
  /** Muc nay sinh ra tu muc nao. `null` = goc cua cay. */
  parentId: string | null;
  /** i18n key mo ta. KHONG bao gio la cau chu viet thang. */
  labelKey: string;
  /**
   * So lieu kem theo, da duoc loc — khong bao gio chua secret.
   *
   * La MANG chu khong phai object co chu dinh: day cung la hinh dang di qua bien gioi API. Neu
   * mien du lieu dung object con day dung mang thi phai co mot buoc chuyen doi o giua — va buoc do
   * la cho hai hinh dang lech nhau ma khong ai do duoc (`D-047`).
   */
  detail: Array<{
    key: string;
    /** Gia tri THO. `null` = khong co gia tri — khac han chuoi rong. */
    value: string | null;
    /**
     * Khi khac `null`: gia tri la mot KHOA DICH, giao dien phai dich no truoc khi hien.
     *
     * Can truong nay vi mot so gia tri la enum (`provider_blocked`) hoac chinh la khoa i18n
     * (`disclosure.limitation.*`). Neu de giao dien tu doan xem cai nao can dich thi phep doan do
     * se sai — va khoa THO se lot ra man hinh nguoi dung. Da xay ra that o lan bam tay dau tien.
     */
    valueKey: string | null;
  }>;
  evidenceStatus: EvidenceStatus;
}

export interface ProvenanceTimeline {
  assetId: string;
  nodes: ProvenanceNode[];
  /** Muc bi mo coi: tro toi mot cha khong co trong cay. Hien ra, khong giau. */
  orphanIds: string[];
  /** i18n key ve nhung gi he thong KHONG do duoc. Rong = khong co gioi han nao da biet. */
  limitationKeys: string[];
}

/**
 * Sap xep va kiem tinh toan ven cua dong thoi gian.
 *
 * HAI DIEU BAT BUOC:
 *
 *  1. **Thu tu on dinh.** Sap theo `(occurredAt, kind, id)`. Chi sap theo thoi gian thi hai muc
 *     cung moc se doi cho nhau giua hai lan doc, va nguoi dung se thay lich su "tu nhien doi".
 *  2. **Muc mo coi phai LO RA.** Mot muc tro toi cha khong ton tai nghia la du lieu thieu. Giau no
 *     di se lam dong thoi gian trong nhu da day du — dung kieu noi doi ma `MCP-50` ton tai de chan.
 */
export function buildProvenanceTimeline(
  assetId: string,
  nodes: readonly ProvenanceNode[],
  limitationKeys: readonly string[] = [],
): ProvenanceTimeline {
  const kindOrder = new Map(PROVENANCE_NODE_KINDS.map((k, i) => [k, i]));
  const sorted = [...nodes].sort((a, b) => {
    if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? -1 : 1;
    const ka = kindOrder.get(a.kind) ?? 0;
    const kb = kindOrder.get(b.kind) ?? 0;
    if (ka !== kb) return ka - kb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const ids = new Set(sorted.map((n) => n.id));
  const orphanIds = sorted
    .filter((n) => n.parentId !== null && !ids.has(n.parentId))
    .map((n) => n.id);

  return { assetId, nodes: sorted, orphanIds, limitationKeys: [...limitationKeys] };
}
