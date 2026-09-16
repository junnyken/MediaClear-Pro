/**
 * PersistencePort - ranh gioi giua domain va noi luu tru.
 *
 * MOI method doc/ghi tai nguyen thuoc workspace deu BAT BUOC nhan workspaceId.
 * Khong ton tai `findById(id)` tran => khong the vo tinh doc cheo tenant.
 * Media binary KHONG bao gio di qua day (guardrail 10 Phase 1).
 */
import type {
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
