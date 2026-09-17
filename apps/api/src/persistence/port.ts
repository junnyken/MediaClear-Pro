/**
 * PersistencePort - ranh gioi giua domain va noi luu tru.
 *
 * MOI method doc/ghi tai nguyen thuoc workspace deu BAT BUOC nhan workspaceId.
 * Khong ton tai `findById(id)` tran => khong the vo tinh doc cheo tenant.
 * Media binary KHONG bao gio di qua day (guardrail 10 Phase 1).
 */
import type {
  JobFrameCorrectionRecord,
  JobFrameRecord,
  JobFrameTimelineRecord,
  Asset,
  AuditEvent,
  Page,
  PageQuery,
  ProcessingJob,
  ProcessingReceipt,
  Project,
  ProvenanceRecord,
  RightsAttestation,
  OutputAssetRecord,
  SessionRecord,
  SourceFileRecord,
  UploadSessionRecord,
  VideoProxyRecord,
  UsageLedgerEntry,
  User,
  ValidationRecord,
  Workspace,
  WorkspaceMembership,
} from './types.js';

export interface PersistencePort {
  readonly id: string;
  /** 'ephemeral' = mat khi restart. Lo ra /healthz, khong giau. */
  readonly durability: 'ephemeral' | 'durable';

  users: {
    findById(id: string): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    create(user: User): Promise<User>;
    /**
     * P2-MCP-25: chuoi bam mat khau. CO Y de ngoai kieu `User` - `User` di thang ra API
     * response, nen chuoi bam khong duoc phep nam trong do du chi mot lan.
     * null = tai khoan chua dat mat khau (tao o thoi dev) => khong dang nhap bang mat khau duoc.
     */
    findPasswordHash(userId: string): Promise<string | null>;
    setPassword(userId: string, passwordHash: string, at: string): Promise<void>;
  };

  /** P2-MCP-25: phien nam o day thay vi trong bo nho tien trinh. */
  sessions: {
    create(session: SessionRecord): Promise<SessionRecord>;
    findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
    /** Ghi moc thu hoi. Khong xoa dong: con dau vet de audit. */
    revoke(tokenHash: string, at: string): Promise<void>;
    listByUser(userId: string): Promise<SessionRecord[]>;
  };

  workspaces: {
    create(workspace: Workspace): Promise<Workspace>;
    findById(id: string): Promise<Workspace | null>;
    listForUser(userId: string): Promise<Array<{ workspace: Workspace; membership: WorkspaceMembership }>>;
  };

  memberships: {
    create(membership: WorkspaceMembership): Promise<WorkspaceMembership>;
    find(workspaceId: string, userId: string): Promise<WorkspaceMembership | null>;
    listByWorkspace(workspaceId: string): Promise<WorkspaceMembership[]>;
  };

  projects: {
    create(project: Project): Promise<Project>;
    findById(workspaceId: string, id: string): Promise<Project | null>;
    listByWorkspace(workspaceId: string, query?: PageQuery): Promise<Page<Project>>;
  };

  assets: {
    create(asset: Asset): Promise<Asset>;
    findById(workspaceId: string, id: string): Promise<Asset | null>;
    listByProject(workspaceId: string, projectId: string, query?: PageQuery): Promise<Page<Asset>>;
  };

  sourceFiles: {
    create(record: SourceFileRecord): Promise<SourceFileRecord>;
    findById(workspaceId: string, id: string): Promise<SourceFileRecord | null>;
    /** Chi duoc goi MOT lan cho moi file: lan hai bi tu choi (bat bien I-1). */
    markStored(workspaceId: string, id: string, patch: Pick<SourceFileRecord, 'measured' | 'uploadedAt'>): Promise<SourceFileRecord>;
    /** P1.1: ghi nhan lan truy cap de luat luu giu 30 ngay co moc that su. */
    touchAccess(workspaceId: string, id: string, at: string): Promise<void>;
    /** P1.1: quet cho bao cao luu giu. Khong workspaceId = pham vi noi bo. */
    listForRetention(workspaceId?: string | null): Promise<SourceFileRecord[]>;
    /**
     * P3 (`D-070`): danh dau tep DA BI XOA BYTE. Ban ghi O LAI lam bia mo.
     *
     * KHONG xoa dong: dong con lai la dau vet duy nhat chung minh tep tung ton tai va da bi don
     * theo luat nao. Xoa dong la xoa ca bang chung. `measured` cung duoc giu de con biet tep cu
     * to bao nhieu — chi BYTE trong kho la bi xoa.
     */
    markDeleted(workspaceId: string, id: string, at: string): Promise<SourceFileRecord>;
  };

  validations: {
    save(record: ValidationRecord): Promise<ValidationRecord>;
    findLatest(workspaceId: string, assetId: string): Promise<ValidationRecord | null>;
  };

  attestations: {
    /** Append-only: moi lan ky tao ban ghi moi, giu nguyen lich su. */
    create(attestation: RightsAttestation): Promise<RightsAttestation>;
    findLatest(workspaceId: string, assetId: string): Promise<RightsAttestation | null>;
  };

  jobs: {
    create(job: ProcessingJob): Promise<ProcessingJob>;
    findById(workspaceId: string, id: string): Promise<ProcessingJob | null>;
    findByIdempotencyKey(workspaceId: string, key: string): Promise<ProcessingJob | null>;
    update(job: ProcessingJob): Promise<ProcessingJob>;
    /**
     * P2-MCP-28 (owner decision Q-02): NHAN mot job dang `queued` va chuyen sang `processing`
     * trong MOT thao tac nguyen tu, tra ve job da nhan. null = khong con gi de lam.
     *
     * Phai nguyen tu that su: hai worker chay song song KHONG duoc cung nhan mot job, neu khong
     * mot tep se bi xu ly hai lan va muc dung bi tinh hai lan. Ban PostgreSQL dung
     * `FOR UPDATE SKIP LOCKED` - khoa dong da nhan va BO QUA no thay vi doi.
     */
    claimQueued(now: string): Promise<ProcessingJob | null>;
    /**
     * P3 (D-060): doi lai mot job KET o `processing`.
     *
     * Worker chet giua chung (het bo nho, container bi thay, may khoi dong lai) thi job no dang
     * cam nam o `processing` VINH VIEN: khong worker nao nhan lai vi `claimQueued` chi nhin
     * `queued`, va khong co gi danh dau no that bai. Nguoi dung thay "dang xu ly" mai mai.
     *
     * Phai NGUYEN TU giong `claimQueued`: hai worker cung doi mot job ket thi tep bi xu ly hai lan.
     */
    claimStale(now: string, staleBefore: string): Promise<ProcessingJob | null>;
    /**
     * P3 (D-060): bao "toi con song, van dang chay job nay".
     *
     * Khong co nhip nay thi `claimStale` khong dung duoc: mot job video dai hang phut trong lang
     * le se bi cho la ket, va worker thu hai se render chinh no lan nua. Nhip tim bien
     * `updated_at` tu "lan cuoi doi trang thai" thanh "lan cuoi con co worker song cam job".
     *
     * Chi cham khi job VAN o `processing`: job da xong roi thi khong duoc keo ngay len.
     * Tra false = khong con gi de cham (da xong, da that bai, hoac worker khac da doi mat).
     */
    touch(workspaceId: string, id: string, now: string): Promise<boolean>;
  };

  /** P2-MCP-27: ban ket qua. Moi job dung mot ban - chay lai la job MOI (D-005). */
  outputs: {
    create(output: OutputAssetRecord): Promise<OutputAssetRecord>;
    findByJob(workspaceId: string, jobId: string): Promise<OutputAssetRecord | null>;
    findById(workspaceId: string, id: string): Promise<OutputAssetRecord | null>;
    /** Dat `validated` sau khi DA do lai byte that (bat bien I-2). */
    markValidated(workspaceId: string, id: string): Promise<OutputAssetRecord>;
  };

  /**
   * P2-MCP-30. Ban ghi provenance la ket qua DO THAT tren byte, khong phai loi khai cua client.
   * Chi co `create` va `findById`: mot phep do da chay xong thi khong duoc sua - sua no la sua
   * bang chung.
   */
  /**
   * P2-MCP-35. `recordChunk` phai NGUYEN TU: hai manh gui song song ma doc-sua-ghi thi mot
   * trong hai se bien mat khoi danh sach, va luot tai len se "thieu manh" ma khong ai biet vi sao.
   */
  uploadSessions: {
    create(session: UploadSessionRecord): Promise<UploadSessionRecord>;
    findById(workspaceId: string, id: string): Promise<UploadSessionRecord | null>;
    findBySourceFile(workspaceId: string, sourceFileId: string): Promise<UploadSessionRecord | null>;
    recordChunk(workspaceId: string, id: string, chunkIndex: number): Promise<UploadSessionRecord>;
    setState(workspaceId: string, id: string, state: UploadSessionRecord['state']): Promise<UploadSessionRecord>;
    /**
     * P3 (`D-070`): phien con MO ma da qua han. Day la nguon ro manh thua trong kho.
     *
     * Chi lay phien `open`: phien `completed` da tu xoa manh, phien `aborted` cung vay.
     */
    listExpired(now: string, limit: number): Promise<UploadSessionRecord[]>;
  };

  /**
   * P3-MCP-30. `upsert` chu khong phai `create`: tao lai proxy (vd sau khi lan truoc that bai) la
   * chuyen binh thuong va KHONG duoc sinh ban thu hai cho cung mot asset.
   */
  videoProxies: {
    upsert(proxy: VideoProxyRecord): Promise<VideoProxyRecord>;
    findByAsset(workspaceId: string, assetId: string): Promise<VideoProxyRecord | null>;
  };

  provenance: {
    create(record: ProvenanceRecord): Promise<ProvenanceRecord>;
    findById(workspaceId: string, id: string): Promise<ProvenanceRecord | null>;
  };

  receipts: {
    create(receipt: ProcessingReceipt): Promise<ProcessingReceipt>;
    findByJob(workspaceId: string, jobId: string): Promise<ProcessingReceipt | null>;
  };

  usage: {
    append(entry: UsageLedgerEntry): Promise<UsageLedgerEntry>;
    listByWorkspace(workspaceId: string): Promise<UsageLedgerEntry[]>;
    /** P1.1: lenh het han chay tren moi workspace nen can duong doc toan bo. */
    listAll(): Promise<UsageLedgerEntry[]>;
  };

  /**
   * P4 (`D-072`): trang thai frame cua mot job.
   *
   * `timeline` va `frames` NAM RIENG co chu dinh: `expectedFrameCount` la con so de DOI CHIEU voi
   * so dong trong `frames`. Nhet chung vao mot cho thi phep doi chieu tro thanh viec ung dung tu
   * cham diem chinh minh.
   */
  jobFrames: {
    saveTimeline(record: JobFrameTimelineRecord): Promise<JobFrameTimelineRecord>;
    findTimeline(workspaceId: string, jobId: string): Promise<JobFrameTimelineRecord | null>;
    /** Ghi ca loat. Thay the toan bo frame cua job — dung sau mot luot tracking. */
    replaceFrames(workspaceId: string, jobId: string, frames: readonly JobFrameRecord[]): Promise<void>;
    listFrames(workspaceId: string, jobId: string): Promise<JobFrameRecord[]>;
    /** Sua DUNG mot frame (MCP-42). */
    updateFrame(record: JobFrameRecord): Promise<JobFrameRecord>;
    /** APPEND-ONLY: khong co duong sua hay xoa. */
    appendCorrection(record: JobFrameCorrectionRecord): Promise<JobFrameCorrectionRecord>;
    listCorrections(workspaceId: string, jobId: string): Promise<JobFrameCorrectionRecord[]>;
  };

  audit: {
    append(event: AuditEvent): Promise<AuditEvent>;
    /**
     * P2-MCP-32: phan trang bang con tro, MOI NHAT TRUOC.
     *
     * Truoc day chi co `limit` va tra mang: nhat ky dai hon `limit` thi phan con lai KHONG CO
     * DUONG NAO doc toi. Voi mot ban ghi dung de doi chieu ve sau, "khong doc toi duoc" nghia la
     * khong dung duoc.
     *
     * Sap xep theo `(occurredAt, id)` giam dan. Khoa phu `id` la bat buoc: hai su kien cung moc
     * thoi gian ma khong co khoa phu thi thu tu khong on dinh, va con tro se nhay qua hoac lap
     * lai muc khi doc trang sau.
     */
    listByWorkspace(workspaceId: string, query?: PageQuery): Promise<Page<AuditEvent>>;
  };
}
