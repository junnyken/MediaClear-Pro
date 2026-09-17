/**
 * InMemoryPersistence - luu tru tam cho Phase 1.
 *
 * TU KHAI `durability = 'ephemeral'`: mat sach khi restart tien trinh.
 * KHONG phai adapter production. Schema PostgreSQL tuong ung nam o
 * db/migrations/0001_phase1_init.sql (da chay thu tren database sach).
 */
import { ERROR_CODES, RELEASE_REASONS } from '@mediaclear/contracts';
import type { PersistencePort } from './port.js';
import type {
  JobFrameCorrectionRecord,
  JobFrameRecord,
  JobFrameTimelineRecord,
  Asset,
  AuditEvent,
  Page,
  PageQuery,
  ProcessingJob,
  Project,
  RightsAttestation,
  OutputAssetRecord,
  ProcessingReceipt,
  ProvenanceRecord,
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

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** Cursor = "<createdAt>|<id>": on dinh, khong lo tong so ban ghi. */
function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | null | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const sep = raw.lastIndexOf('|');
    if (sep <= 0) return null;
    return { createdAt: raw.slice(0, sep), id: raw.slice(sep + 1) };
  } catch {
    return null;
  }
}

function paginate<T extends { id: string; createdAt: string }>(rows: T[], query?: PageQuery): Page<T> {
  const limit = Math.min(Math.max(query?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const sorted = [...rows].sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt),
  );
  const after = decodeCursor(query?.cursor);
  const start = after
    ? sorted.findIndex((r) => r.createdAt > after.createdAt || (r.createdAt === after.createdAt && r.id > after.id))
    : 0;
  const from = start < 0 ? sorted.length : start;
  const items = sorted.slice(from, from + limit);
  const last = items[items.length - 1];
  const hasMore = from + limit < sorted.length;
  return { items, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null };
}

/**
 * Phan trang GIAM DAN (moi nhat truoc) - P2-MCP-32.
 *
 * Tach rieng khoi `paginate` (tang dan) vi nhat kiem duoc doc nguoc chieu voi moi danh sach khac.
 * Khoa phu `id` la BAT BUOC: khong co no thi hai muc cung moc thoi gian co thu tu tuy y, va con
 * tro se nhay qua hoac lap lai muc. Ban PostgreSQL da sap xep `(occurred_at, id)` tu truoc, ban
 * nay thi KHONG - hai adapter tung lech nhau o dung cho do.
 */
function paginateDesc<T extends { id: string }>(
  rows: T[],
  keyOf: (row: T) => string,
  query?: PageQuery,
): Page<T> {
  const limit = Math.min(Math.max(query?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const sorted = [...rows].sort((a, b) =>
    keyOf(a) === keyOf(b) ? b.id.localeCompare(a.id) : keyOf(b).localeCompare(keyOf(a)),
  );
  const after = decodeCursor(query?.cursor);
  const start = after
    ? sorted.findIndex((r) => keyOf(r) < after.createdAt || (keyOf(r) === after.createdAt && r.id < after.id))
    : 0;
  const from = start < 0 ? sorted.length : start;
  const items = sorted.slice(from, from + limit);
  const last = items[items.length - 1];
  const hasMore = from + limit < sorted.length;
  return { items, nextCursor: hasMore && last ? encodeCursor(keyOf(last), last.id) : null };
}


/**
 * Cung mot LUAT ma PostgreSQL ep o tang du lieu (`0001`): `blocked` phai co DU ca `reasonCode` va
 * `blockReasonKind`.
 *
 * Vi sao ban in-memory cung phai ep: thieu no, adapter nay IM LANG nhan mot dong ma PostgreSQL se
 * tu choi — va do dung la cach mot loi that (`D-066`) song sot qua 611 test. Bo test hop dong chi
 * bat duoc lech giua hai adapter khi ca hai cung duoc doi hoi nhu nhau.
 */
/**
 * Cung LUAT `usage_ledger_release_reason_known` (migration `0002`): but toan `release` chi mang
 * duoc mot trong cac ly do da khai bao.
 *
 * Thieu phep ep nay, in-memory nhan moi chuoi — va do dung la cach mot loi TIEN BAC (`D-066`) song
 * sot: ma truyen MA LOI thay vi ly do, PostgreSQL tu choi, `catch {}` nuot loi, khoan giu cua
 * nguoi dung khong bao gio duoc tra lai. Moi test van xanh.
 */
function ensureReleaseReasonKnown(entry: UsageLedgerEntry): void {
  if (entry.reasonCode === null) return;
  if (!(RELEASE_REASONS as readonly string[]).includes(entry.reasonCode)) {
    throw new Error('violates check constraint "usage_ledger_release_reason_known"');
  }
}

function ensureBlockedHasReason(job: ProcessingJob): void {
  if (job.state !== 'blocked') return;
  if (job.reasonCode === null || job.blockReasonKind === null) {
    throw new Error('violates check constraint "processing_jobs_blocked_requires_reason"');
  }
}

export class InMemoryPersistence implements PersistencePort {
  readonly id = 'in-memory-phase1';
  readonly durability = 'ephemeral' as const;

  private readonly userRows = new Map<string, User>();
  private readonly workspaceRows = new Map<string, Workspace>();
  private readonly membershipRows: WorkspaceMembership[] = [];
  private readonly projectRows: Project[] = [];
  private readonly assetRows: Asset[] = [];
  private readonly sourceFileRows = new Map<string, SourceFileRecord>();
  private readonly frameTimelineRows = new Map<string, JobFrameTimelineRecord>();
  private frameRows: JobFrameRecord[] = [];
  private readonly frameCorrectionRows: JobFrameCorrectionRecord[] = [];
  private readonly validationRows: ValidationRecord[] = [];
  private readonly attestationRows: RightsAttestation[] = [];
  private readonly jobRows: ProcessingJob[] = [];
  private readonly usageRows: UsageLedgerEntry[] = [];
  private readonly auditRows: AuditEvent[] = [];
  private readonly passwordRows = new Map<string, string>();
  private readonly sessionRows: SessionRecord[] = [];
  private readonly outputRows: OutputAssetRecord[] = [];
  private readonly provenanceRows: ProvenanceRecord[] = [];
  private readonly receiptRows: ProcessingReceipt[] = [];
  private readonly uploadSessionRows: UploadSessionRecord[] = [];
  private readonly videoProxyRows: VideoProxyRecord[] = [];

  readonly users = {
    findById: async (id: string): Promise<User | null> => this.userRows.get(id) ?? null,
    findByEmail: async (email: string): Promise<User | null> =>
      [...this.userRows.values()].find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null,
    create: async (user: User): Promise<User> => {
      this.userRows.set(user.id, user);
      return user;
    },
    findPasswordHash: async (userId: string): Promise<string | null> => this.passwordRows.get(userId) ?? null,
    setPassword: async (userId: string, passwordHash: string): Promise<void> => {
      this.passwordRows.set(userId, passwordHash);
    },
  };

  readonly sessions = {
    create: async (session: SessionRecord): Promise<SessionRecord> => {
      this.sessionRows.push(session);
      return session;
    },
    findByTokenHash: async (tokenHash: string): Promise<SessionRecord | null> =>
      this.sessionRows.find((s) => s.tokenHash === tokenHash) ?? null,
    revoke: async (tokenHash: string, at: string): Promise<void> => {
      const index = this.sessionRows.findIndex((s) => s.tokenHash === tokenHash);
      const row = this.sessionRows[index];
      if (row) this.sessionRows[index] = { ...row, revokedAt: at };
    },
    listByUser: async (userId: string): Promise<SessionRecord[]> =>
      this.sessionRows.filter((s) => s.userId === userId),
  };

  readonly workspaces = {
    create: async (workspace: Workspace): Promise<Workspace> => {
      this.workspaceRows.set(workspace.id, workspace);
      return workspace;
    },
    findById: async (id: string): Promise<Workspace | null> => this.workspaceRows.get(id) ?? null,
    listForUser: async (userId: string) => {
      const out: Array<{ workspace: Workspace; membership: WorkspaceMembership }> = [];
      for (const membership of this.membershipRows) {
        if (membership.userId !== userId) continue;
        const workspace = this.workspaceRows.get(membership.workspaceId);
        if (workspace) out.push({ workspace, membership });
      }
      return out.sort((a, b) => a.workspace.createdAt.localeCompare(b.workspace.createdAt));
    },
  };

  readonly memberships = {
    create: async (membership: WorkspaceMembership): Promise<WorkspaceMembership> => {
      this.membershipRows.push(membership);
      return membership;
    },
    find: async (workspaceId: string, userId: string): Promise<WorkspaceMembership | null> =>
      this.membershipRows.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null,
    listByWorkspace: async (workspaceId: string): Promise<WorkspaceMembership[]> =>
      this.membershipRows.filter((m) => m.workspaceId === workspaceId),
  };

  readonly projects = {
    create: async (project: Project): Promise<Project> => {
      this.projectRows.push(project);
      return project;
    },
    findById: async (workspaceId: string, id: string): Promise<Project | null> =>
      this.projectRows.find((p) => p.id === id && p.workspaceId === workspaceId) ?? null,
    listByWorkspace: async (workspaceId: string, query?: PageQuery): Promise<Page<Project>> =>
      paginate(this.projectRows.filter((p) => p.workspaceId === workspaceId), query),
  };

  readonly assets = {
    create: async (asset: Asset): Promise<Asset> => {
      this.assetRows.push(asset);
      return asset;
    },
    findById: async (workspaceId: string, id: string): Promise<Asset | null> =>
      this.assetRows.find((a) => a.id === id && a.workspaceId === workspaceId) ?? null,
    listByProject: async (workspaceId: string, projectId: string, query?: PageQuery): Promise<Page<Asset>> =>
      paginate(
        this.assetRows.filter((a) => a.workspaceId === workspaceId && a.projectId === projectId),
        query,
      ),
  };

  readonly sourceFiles = {
    create: async (record: SourceFileRecord): Promise<SourceFileRecord> => {
      this.sourceFileRows.set(record.id, record);
      return record;
    },
    findById: async (workspaceId: string, id: string): Promise<SourceFileRecord | null> => {
      const row = this.sourceFileRows.get(id);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    markStored: async (
      workspaceId: string,
      id: string,
      patch: Pick<SourceFileRecord, 'measured' | 'uploadedAt'>,
    ): Promise<SourceFileRecord> => {
      const row = this.sourceFileRows.get(id);
      if (!row || row.workspaceId !== workspaceId) {
        throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      }
      // I-1 o tang du lieu: khong ghi de file goc da co byte.
      if (row.uploadState === 'stored') {
        throw new Error(ERROR_CODES.MCP_STORAGE_WRITE_DENIED);
      }
      const next: SourceFileRecord = { ...row, ...patch, uploadState: 'stored' };
      this.sourceFileRows.set(id, next);
      return next;
    },
    touchAccess: async (workspaceId: string, id: string, at: string): Promise<void> => {
      const row = this.sourceFileRows.get(id);
      if (!row || row.workspaceId !== workspaceId) return;
      this.sourceFileRows.set(id, { ...row, lastAccessedAt: at });
    },
    listForRetention: async (workspaceId?: string | null): Promise<SourceFileRecord[]> =>
      [...this.sourceFileRows.values()].filter((r) => !workspaceId || r.workspaceId === workspaceId),
    markDeleted: async (workspaceId: string, id: string, at: string): Promise<SourceFileRecord> => {
      const row = this.sourceFileRows.get(id);
      if (!row || row.workspaceId !== workspaceId) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      // Chi chay MOT lan, giong rang buoc `retention_state <> 'deleted'` cua ban PostgreSQL:
      // goi lai khong duoc ghi de moc `deletedAt` cu.
      if (row.retentionState === 'deleted') throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      const next: SourceFileRecord = { ...row, retentionState: 'deleted', deletedAt: at, scheduledDeletionAt: null };
      this.sourceFileRows.set(id, next);
      return next;
    },
  };

  readonly validations = {
    save: async (record: ValidationRecord): Promise<ValidationRecord> => {
      this.validationRows.push(record);
      return record;
    },
    findLatest: async (workspaceId: string, assetId: string): Promise<ValidationRecord | null> => {
      const rows = this.validationRows
        .filter((r) => r.workspaceId === workspaceId && r.assetId === assetId)
        .sort((a, b) => a.validatedAt.localeCompare(b.validatedAt));
      return rows[rows.length - 1] ?? null;
    },
  };

  readonly attestations = {
    create: async (attestation: RightsAttestation): Promise<RightsAttestation> => {
      this.attestationRows.push(attestation);
      return attestation;
    },
    findLatest: async (workspaceId: string, assetId: string): Promise<RightsAttestation | null> => {
      const rows = this.attestationRows
        .filter((a) => a.workspaceId === workspaceId && a.assetId === assetId)
        .sort((a, b) => a.attestedAt.localeCompare(b.attestedAt));
      return rows[rows.length - 1] ?? null;
    },
  };


  readonly jobs = {
    create: async (job: ProcessingJob): Promise<ProcessingJob> => {
      ensureBlockedHasReason(job);
      this.jobRows.push(job);
      return job;
    },
    findById: async (workspaceId: string, id: string): Promise<ProcessingJob | null> =>
      this.jobRows.find((j) => j.id === id && j.workspaceId === workspaceId) ?? null,
    findByIdempotencyKey: async (workspaceId: string, key: string): Promise<ProcessingJob | null> =>
      this.jobRows.find((j) => j.workspaceId === workspaceId && j.idempotencyKey === key) ?? null,
    update: async (job: ProcessingJob): Promise<ProcessingJob> => {
      ensureBlockedHasReason(job);
      const index = this.jobRows.findIndex((j) => j.id === job.id && j.workspaceId === job.workspaceId);
      if (index < 0) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      this.jobRows[index] = job;
      return job;
    },
    claimQueued: async (now: string): Promise<ProcessingJob | null> => {
      // Khong co `await` giua luc tim va luc doi trang thai => khong co cho nao de hai lenh
      // xen vao nhau. Trong mot tien trinh Node, day la nguyen tu that su.
      const index = this.jobRows.findIndex((j) => j.state === 'queued');
      const row = this.jobRows[index];
      if (!row) return null;
      const claimed: ProcessingJob = {
        ...row,
        state: 'processing',
        attemptCount: row.attemptCount + 1,
        updatedAt: now,
      };
      this.jobRows[index] = claimed;
      return claimed;
    },

    claimStale: async (now: string, staleBefore: string): Promise<ProcessingJob | null> => {
      const stale = this.jobRows
        .filter((j) => j.state === 'processing' && j.updatedAt < staleBefore)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))[0];
      if (!stale) return null;
      const claimed: ProcessingJob = { ...stale, attemptCount: stale.attemptCount + 1, updatedAt: now };
      const i = this.jobRows.findIndex((j) => j.id === stale.id);
      this.jobRows[i] = claimed;
      return claimed;
    },

    touch: async (workspaceId: string, id: string, now: string): Promise<boolean> => {
      const i = this.jobRows.findIndex((j) => j.id === id && j.workspaceId === workspaceId);
      const row = this.jobRows[i];
      if (!row || row.state !== 'processing') return false;
      this.jobRows[i] = { ...row, updatedAt: now };
      return true;
    },
  };

  readonly outputs = {
    create: async (output: OutputAssetRecord): Promise<OutputAssetRecord> => {
      if (this.outputRows.some((o) => o.jobId === output.jobId)) {
        // Khop rang buoc UNIQUE (job_id) cua luoc do: moi job dung mot ban ket qua.
        throw new Error(ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
      }
      this.outputRows.push(output);
      return output;
    },
    findByJob: async (workspaceId: string, jobId: string): Promise<OutputAssetRecord | null> =>
      this.outputRows.find((o) => o.workspaceId === workspaceId && o.jobId === jobId) ?? null,
    findById: async (workspaceId: string, id: string): Promise<OutputAssetRecord | null> =>
      this.outputRows.find((o) => o.workspaceId === workspaceId && o.id === id) ?? null,
    markValidated: async (workspaceId: string, id: string): Promise<OutputAssetRecord> => {
      const index = this.outputRows.findIndex((o) => o.workspaceId === workspaceId && o.id === id);
      const row = this.outputRows[index];
      if (!row) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      const next = { ...row, validated: true };
      this.outputRows[index] = next;
      return next;
    },
  };

  readonly uploadSessions = {
    create: async (session: UploadSessionRecord): Promise<UploadSessionRecord> => {
      if (this.uploadSessionRows.some((r) => r.sourceFileId === session.sourceFileId)) {
        throw new Error(ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
      }
      this.uploadSessionRows.push({ ...session, receivedChunks: [...session.receivedChunks] });
      return session;
    },
    findById: async (workspaceId: string, id: string): Promise<UploadSessionRecord | null> => {
      const row = this.uploadSessionRows.find((r) => r.workspaceId === workspaceId && r.id === id);
      return row ? { ...row, receivedChunks: [...row.receivedChunks] } : null;
    },
    findBySourceFile: async (workspaceId: string, sourceFileId: string): Promise<UploadSessionRecord | null> => {
      const row = this.uploadSessionRows.find((r) => r.workspaceId === workspaceId && r.sourceFileId === sourceFileId);
      return row ? { ...row, receivedChunks: [...row.receivedChunks] } : null;
    },
    recordChunk: async (workspaceId: string, id: string, chunkIndex: number): Promise<UploadSessionRecord> => {
      const row = this.uploadSessionRows.find((r) => r.workspaceId === workspaceId && r.id === id);
      if (!row) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      // Ghi trung mot manh KHONG phai loi: tai lai mot manh la chuyen binh thuong.
      if (!row.receivedChunks.includes(chunkIndex)) row.receivedChunks.push(chunkIndex);
      row.receivedChunks.sort((a, b) => a - b);
      return { ...row, receivedChunks: [...row.receivedChunks] };
    },
    setState: async (workspaceId: string, id: string, state: UploadSessionRecord['state']): Promise<UploadSessionRecord> => {
      const row = this.uploadSessionRows.find((r) => r.workspaceId === workspaceId && r.id === id);
      if (!row) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      row.state = state;
      return { ...row, receivedChunks: [...row.receivedChunks] };
    },

    listExpired: async (now: string, limit: number): Promise<UploadSessionRecord[]> =>
      this.uploadSessionRows
        .filter((r) => r.state === 'open' && r.expiresAt < now)
        .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
        .slice(0, limit)
        .map((r) => ({ ...r, receivedChunks: [...r.receivedChunks] })),
  };

  readonly videoProxies = {
    upsert: async (proxy: VideoProxyRecord): Promise<VideoProxyRecord> => {
      const i = this.videoProxyRows.findIndex((r) => r.workspaceId === proxy.workspaceId && r.assetId === proxy.assetId);
      if (i >= 0) this.videoProxyRows[i] = proxy;
      else this.videoProxyRows.push(proxy);
      return proxy;
    },
    findByAsset: async (workspaceId: string, assetId: string): Promise<VideoProxyRecord | null> =>
      this.videoProxyRows.find((r) => r.workspaceId === workspaceId && r.assetId === assetId) ?? null,
  };

  readonly provenance = {
    create: async (record: ProvenanceRecord): Promise<ProvenanceRecord> => {
      this.provenanceRows.push(record);
      return record;
    },
    findById: async (workspaceId: string, id: string): Promise<ProvenanceRecord | null> =>
      this.provenanceRows.find((r) => r.workspaceId === workspaceId && r.id === id) ?? null,
  };

  readonly receipts = {
    create: async (receipt: ProcessingReceipt): Promise<ProcessingReceipt> => {
      if (this.receiptRows.some((r) => r.jobId === receipt.jobId)) {
        // Khop rang buoc UNIQUE (job_id): moi job dung mot bien nhan.
        throw new Error(ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
      }
      this.receiptRows.push(receipt);
      return receipt;
    },
    findByJob: async (workspaceId: string, jobId: string): Promise<ProcessingReceipt | null> =>
      this.receiptRows.find((r) => r.workspaceId === workspaceId && r.jobId === jobId) ?? null,
  };

  readonly usage = {
    append: async (entry: UsageLedgerEntry): Promise<UsageLedgerEntry> => {
      ensureReleaseReasonKnown(entry);
      // Idempotency key la duy nhat trong ledger (khop unique constraint cua schema SQL).
      if (this.usageRows.some((e) => e.idempotencyKey === entry.idempotencyKey)) {
        throw new Error(ERROR_CODES.MCP_USAGE_RESERVATION_CONFLICT);
      }
      this.usageRows.push(entry);
      return entry;
    },
    listByWorkspace: async (workspaceId: string): Promise<UsageLedgerEntry[]> =>
      this.usageRows.filter((e) => e.workspaceId === workspaceId),
    listAll: async (): Promise<UsageLedgerEntry[]> => [...this.usageRows],
  };

  readonly jobFrames = {
    saveTimeline: async (record: JobFrameTimelineRecord): Promise<JobFrameTimelineRecord> => {
      this.frameTimelineRows.set(record.jobId, record);
      return record;
    },
    findTimeline: async (workspaceId: string, jobId: string): Promise<JobFrameTimelineRecord | null> => {
      const row = this.frameTimelineRows.get(jobId);
      return row && row.workspaceId === workspaceId ? row : null;
    },
    replaceFrames: async (workspaceId: string, jobId: string, frames: readonly JobFrameRecord[]): Promise<void> => {
      this.frameRows = this.frameRows.filter((r) => !(r.jobId === jobId && r.workspaceId === workspaceId));
      this.frameRows.push(...frames.map((f) => ({ ...f })));
    },
    listFrames: async (workspaceId: string, jobId: string): Promise<JobFrameRecord[]> =>
      this.frameRows
        .filter((r) => r.jobId === jobId && r.workspaceId === workspaceId)
        .sort((a, b) => a.frameIndex - b.frameIndex)
        .map((r) => ({ ...r })),
    updateFrame: async (record: JobFrameRecord): Promise<JobFrameRecord> => {
      const i = this.frameRows.findIndex(
        (r) => r.jobId === record.jobId && r.workspaceId === record.workspaceId && r.frameIndex === record.frameIndex,
      );
      if (i < 0) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      this.frameRows[i] = { ...record };
      return record;
    },
    appendCorrection: async (record: JobFrameCorrectionRecord): Promise<JobFrameCorrectionRecord> => {
      // APPEND-ONLY: chi push, khong bao gio thay the.
      this.frameCorrectionRows.push({ ...record });
      return record;
    },
    listCorrections: async (workspaceId: string, jobId: string): Promise<JobFrameCorrectionRecord[]> =>
      this.frameCorrectionRows
        .filter((r) => r.jobId === jobId && r.workspaceId === workspaceId)
        .sort((a, b) => a.correctedAt.localeCompare(b.correctedAt))
        .map((r) => ({ ...r })),
  };

  readonly audit = {
    append: async (event: AuditEvent): Promise<AuditEvent> => {
      this.auditRows.push(event);
      return event;
    },
    listByWorkspace: async (workspaceId: string, query?: PageQuery): Promise<Page<AuditEvent>> =>
      paginateDesc(
        this.auditRows.filter((e) => e.workspaceId === workspaceId),
        (e) => e.occurredAt,
        query,
      ),
  };
}
