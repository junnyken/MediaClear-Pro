/**
 * PostgresPersistence - adapter luu tru BEN VUNG (P2-MCP-23).
 *
 * Ly do ton tai: truoc adapter nay, `/healthz` tu khai `durability: 'ephemeral'` - khoi dong lai
 * API la mat sach moi thu, ke ca LOI KHAI QUYEN SU DUNG. Ma loi khai quyen chinh la thu ma
 * Q-19, Q-20 va Q-22 dung len de lam BANG CHUNG. Bang chung khong song sot qua mot lan khoi
 * dong lai thi khong phai bang chung.
 *
 * Adapter nay phai vua khit `PersistencePort` va hanh xu GIONG HET `InMemoryPersistence`:
 * bo test hop dong chay tren CA HAI, nen cho nao lech la do.
 *
 * Luu y ve thoi gian: pg tra `timestamptz` thanh `Date`, trong khi mien dung chuoi ISO.
 * Moi duong doc deu phai di qua `iso()` - quen mot cho la ban ghi doc ra khac ban ghi ghi vao.
 */
import { ERROR_CODES } from '@mediaclear/contracts';
import type { BrandKitState, QualityGateVerdict } from '@mediaclear/contracts';
import type { Pool, PoolClient } from 'pg';
import type { PersistencePort } from './port.js';
import type {
  BrandKitRecord,
  BrandKitVersionRecord,
  BrandLogoAssetRecord,
  JobMetadataSnapshotRecord,
  JobFrameCorrectionNeighbour,
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

/** Chuoi ISO cho mien. Date cua pg -> ISO; chuoi giu nguyen; null giu null. */
function iso(value: Date | string | null): string | null {
  if (value === null || value === undefined) return null;
  return value instanceof Date ? value.toISOString() : value;
}

/** Nhu `iso()` nhung cho cot NOT NULL - de loi lo ra thay vi am tham thanh chuoi rong. */
function isoRequired(value: Date | string): string {
  const out = iso(value);
  if (out === null) throw new Error('mong doi moc thoi gian nhung nhan duoc null');
  return out;
}

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

function limitOf(query?: PageQuery): number {
  return Math.min(Math.max(query?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
}

/** Phan trang theo (createdAt, id) - cung quy uoc voi adapter in-memory. */
function pageOf<T extends { id: string; createdAt: string }>(rows: T[], limit: number): Page<T> {
  return pageOfBy(rows, limit, (r) => r.createdAt);
}

/**
 * P2-MCP-32: cung phep phan trang nhung khoa sap xep do ben goi chon.
 * Nhat ky kiem toan dung `occurredAt` chu khong phai `createdAt`.
 */
function pageOfBy<T extends { id: string }>(rows: T[], limit: number, keyOf: (row: T) => string): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(keyOf(last), last.id) : null };
}

export interface PostgresPersistenceOptions {
  /** Nhan dang lo ra `/healthz`. Doi duoc de test phan biet nhieu the hien. */
  id?: string;
}

export class PostgresPersistence implements PersistencePort {
  readonly id: string;
  readonly durability = 'durable' as const;

  constructor(
    private readonly pool: Pool,
    options: PostgresPersistenceOptions = {},
  ) {
    this.id = options.id ?? 'postgres-phase2';
  }

  private async q<R extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<R[]> {
    const result = await this.pool.query<R>(text, values);
    return result.rows;
  }

  /* ------------------------------------------------------------------ users */

  readonly users = {
    findById: async (id: string): Promise<User | null> => {
      const rows = await this.q<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    findByEmail: async (email: string): Promise<User | null> => {
      const rows = await this.q<UserRow>('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    create: async (user: User): Promise<User> => {
      await this.q(
        `INSERT INTO users (id, email, display_name, default_locale, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, user.email, user.displayName, user.defaultLocale, user.createdAt],
      );
      return user;
    },
    findPasswordHash: async (userId: string): Promise<string | null> => {
      const rows = await this.q<{ password_hash: string | null }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId],
      );
      return rows[0]?.password_hash ?? null;
    },
    setPassword: async (userId: string, passwordHash: string, at: string): Promise<void> => {
      await this.q('UPDATE users SET password_hash = $2, password_set_at = $3 WHERE id = $1', [
        userId,
        passwordHash,
        at,
      ]);
    },
  };

  readonly sessions = {
    create: async (session: SessionRecord): Promise<SessionRecord> => {
      await this.q(
        `INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          session.id, session.userId, session.tokenHash,
          session.createdAt, session.expiresAt, session.revokedAt,
        ],
      );
      return session;
    },
    findByTokenHash: async (tokenHash: string): Promise<SessionRecord | null> => {
      const rows = await this.q<SessionRow>('SELECT * FROM sessions WHERE token_hash = $1', [tokenHash]);
      return rows[0] ? toSession(rows[0]) : null;
    },
    revoke: async (tokenHash: string, at: string): Promise<void> => {
      await this.q('UPDATE sessions SET revoked_at = $2 WHERE token_hash = $1', [tokenHash, at]);
    },
    listByUser: async (userId: string): Promise<SessionRecord[]> => {
      const rows = await this.q<SessionRow>(
        'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at ASC, id ASC',
        [userId],
      );
      return rows.map(toSession);
    },
  };

  /* ------------------------------------------------------------- workspaces */

  readonly workspaces = {
    create: async (workspace: Workspace): Promise<Workspace> => {
      await this.q(
        'INSERT INTO workspaces (id, name, owner_user_id, created_at) VALUES ($1, $2, $3, $4)',
        [workspace.id, workspace.name, workspace.ownerUserId, workspace.createdAt],
      );
      return workspace;
    },
    findById: async (id: string): Promise<Workspace | null> => {
      const rows = await this.q<WorkspaceRow>('SELECT * FROM workspaces WHERE id = $1', [id]);
      return rows[0] ? toWorkspace(rows[0]) : null;
    },
    listForUser: async (userId: string) => {
      const rows = await this.q<WorkspaceRow & MembershipRow & { w_created_at: Date }>(
        `SELECT w.id  AS w_id, w.name, w.owner_user_id, w.created_at AS w_created_at,
                m.id  AS id, m.workspace_id, m.user_id, m.role, m.created_at
           FROM workspace_members m
           JOIN workspaces w ON w.id = m.workspace_id
          WHERE m.user_id = $1
          ORDER BY w.created_at ASC`,
        [userId],
      );
      return rows.map((r) => ({
        workspace: toWorkspace({
          id: (r as unknown as { w_id: string }).w_id,
          name: r.name,
          owner_user_id: r.owner_user_id,
          created_at: r.w_created_at,
        }),
        membership: toMembership(r),
      }));
    },
  };

  /* ------------------------------------------------------------ memberships */

  readonly memberships = {
    create: async (membership: WorkspaceMembership): Promise<WorkspaceMembership> => {
      await this.q(
        `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [membership.id, membership.workspaceId, membership.userId, membership.role, membership.createdAt],
      );
      return membership;
    },
    find: async (workspaceId: string, userId: string): Promise<WorkspaceMembership | null> => {
      const rows = await this.q<MembershipRow>(
        'SELECT * FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId],
      );
      return rows[0] ? toMembership(rows[0]) : null;
    },
    listByWorkspace: async (workspaceId: string): Promise<WorkspaceMembership[]> => {
      const rows = await this.q<MembershipRow>(
        'SELECT * FROM workspace_members WHERE workspace_id = $1 ORDER BY created_at ASC, id ASC',
        [workspaceId],
      );
      return rows.map(toMembership);
    },
  };

  /* --------------------------------------------------------------- projects */

  readonly projects = {
    create: async (project: Project): Promise<Project> => {
      await this.q(
        `INSERT INTO projects (id, workspace_id, name, created_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [project.id, project.workspaceId, project.name, project.createdByUserId, project.createdAt],
      );
      return project;
    },
    findById: async (workspaceId: string, id: string): Promise<Project | null> => {
      const rows = await this.q<ProjectRow>(
        'SELECT * FROM projects WHERE id = $1 AND workspace_id = $2',
        [id, workspaceId],
      );
      return rows[0] ? toProject(rows[0]) : null;
    },
    listByWorkspace: async (workspaceId: string, query?: PageQuery): Promise<Page<Project>> => {
      const limit = limitOf(query);
      const after = decodeCursor(query?.cursor);
      const rows = await this.q<ProjectRow>(
        `SELECT * FROM projects
          WHERE workspace_id = $1
            AND ($2::text IS NULL OR (created_at, id) > ($2::timestamptz, $3::text))
          ORDER BY created_at ASC, id ASC
          LIMIT $4`,
        [workspaceId, after?.createdAt ?? null, after?.id ?? null, limit + 1],
      );
      return pageOf(rows.map(toProject), limit);
    },
  };

  /* ----------------------------------------------------------------- assets */

  readonly assets = {
    create: async (asset: Asset): Promise<Asset> => {
      await this.q(
        `INSERT INTO assets (id, workspace_id, project_id, media_type, source_file_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [asset.id, asset.workspaceId, asset.projectId, asset.mediaType, asset.sourceFileId, asset.createdAt],
      );
      return asset;
    },
    findById: async (workspaceId: string, id: string): Promise<Asset | null> => {
      const rows = await this.q<AssetRow>('SELECT * FROM assets WHERE id = $1 AND workspace_id = $2', [
        id,
        workspaceId,
      ]);
      return rows[0] ? toAsset(rows[0]) : null;
    },
    listByProject: async (workspaceId: string, projectId: string, query?: PageQuery): Promise<Page<Asset>> => {
      const limit = limitOf(query);
      const after = decodeCursor(query?.cursor);
      const rows = await this.q<AssetRow>(
        `SELECT * FROM assets
          WHERE workspace_id = $1 AND project_id = $2
            AND ($3::text IS NULL OR (created_at, id) > ($3::timestamptz, $4::text))
          ORDER BY created_at ASC, id ASC
          LIMIT $5`,
        [workspaceId, projectId, after?.createdAt ?? null, after?.id ?? null, limit + 1],
      );
      return pageOf(rows.map(toAsset), limit);
    },
  };

  /* ----------------------------------------------------------- source files */

  readonly sourceFiles = {
    create: async (record: SourceFileRecord): Promise<SourceFileRecord> => {
      const m = record.measured;
      await this.q(
        `INSERT INTO source_files (
           id, workspace_id, project_id, asset_id, storage_key, original_filename,
           declared_mime_type, declared_byte_size, declared_media_type, upload_state,
           mime_type, byte_size, checksum_sha256, duration_seconds, width_px, height_px,
           has_audio_stream, corrupt, created_at, uploaded_at,
           last_accessed_at, retention_state, legal_hold_at, scheduled_deletion_at,
           deleted_at, retention_policy_version
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
           $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
           $21,$22,$23,$24,$25,$26
         )`,
        [
          record.id, record.workspaceId, record.projectId, record.assetId, record.storageKey,
          record.originalFilename, record.declaredMimeType, record.declaredByteSize,
          record.declaredMediaType, record.uploadState,
          m?.mimeType ?? null, m?.byteSize ?? null, m?.checksumSha256 ?? null,
          m?.durationSeconds ?? null, m?.widthPx ?? null, m?.heightPx ?? null,
          m?.hasAudioStream ?? null, m?.corrupt ?? false,
          record.createdAt, record.uploadedAt,
          record.lastAccessedAt, record.retentionState, record.legalHoldAt,
          record.scheduledDeletionAt, record.deletedAt, record.retentionPolicyVersion,
        ],
      );
      return record;
    },
    findById: async (workspaceId: string, id: string): Promise<SourceFileRecord | null> => {
      const rows = await this.q<SourceFileRow>(
        'SELECT * FROM source_files WHERE id = $1 AND workspace_id = $2',
        [id, workspaceId],
      );
      return rows[0] ? toSourceFileRecord(rows[0]) : null;
    },
    markStored: async (
      workspaceId: string,
      id: string,
      patch: Pick<SourceFileRecord, 'measured' | 'uploadedAt'>,
    ): Promise<SourceFileRecord> => {
      const client: PoolClient = await this.pool.connect();
      try {
        await client.query('BEGIN');
        // Khoa dong lai: hai lan upload dong thoi khong duoc cung di qua cong I-1.
        const current = await client.query<SourceFileRow>(
          'SELECT * FROM source_files WHERE id = $1 AND workspace_id = $2 FOR UPDATE',
          [id, workspaceId],
        );
        const row = current.rows[0];
        if (!row) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
        // I-1 o tang du lieu: khong ghi de file goc da co byte.
        if (row.upload_state === 'stored') throw new Error(ERROR_CODES.MCP_STORAGE_WRITE_DENIED);

        const m = patch.measured;
        const updated = await client.query<SourceFileRow>(
          `UPDATE source_files SET
             upload_state = 'stored', uploaded_at = $3,
             mime_type = $4, byte_size = $5, checksum_sha256 = $6, duration_seconds = $7,
             width_px = $8, height_px = $9, has_audio_stream = $10, corrupt = $11
           WHERE id = $1 AND workspace_id = $2
           RETURNING *`,
          [
            id, workspaceId, patch.uploadedAt,
            m?.mimeType ?? null, m?.byteSize ?? null, m?.checksumSha256 ?? null,
            m?.durationSeconds ?? null, m?.widthPx ?? null, m?.heightPx ?? null,
            m?.hasAudioStream ?? null, m?.corrupt ?? false,
          ],
        );
        await client.query('COMMIT');
        const next = updated.rows[0];
        if (!next) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
        return toSourceFileRecord(next);
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Loi goc moi la thu can nem len.
        }
        throw error;
      } finally {
        client.release();
      }
    },
    touchAccess: async (workspaceId: string, id: string, at: string): Promise<void> => {
      // Khong ton tai / khac workspace => khong lam gi, khong nem loi (khop in-memory).
      await this.q('UPDATE source_files SET last_accessed_at = $3 WHERE id = $1 AND workspace_id = $2', [
        id,
        workspaceId,
        at,
      ]);
    },
    listForRetention: async (workspaceId?: string | null): Promise<SourceFileRecord[]> => {
      const rows = await this.q<SourceFileRow>(
        `SELECT * FROM source_files
          WHERE ($1::text IS NULL OR workspace_id = $1)
          ORDER BY created_at ASC, id ASC`,
        [workspaceId ?? null],
      );
      return rows.map(toSourceFileRecord);
    },

    markDeleted: async (workspaceId: string, id: string, at: string): Promise<SourceFileRecord> => {
      /*
       * KHONG `DELETE FROM`. Dong o lai lam bia mo — no la dau vet duy nhat chung minh tep tung
       * ton tai va da bi don theo luat nao. Chi BYTE trong kho bi xoa.
       *
       * `retention_state <> 'deleted'` trong WHERE lam thao tac nay CHI CHAY MOT LAN: goi lai
       * khong ghi de moc `deleted_at` cu, nen moc do van la moc that.
       */
      const rows = await this.q<SourceFileRow>(
        `UPDATE source_files
            SET retention_state = 'deleted', deleted_at = $3, scheduled_deletion_at = NULL
          WHERE workspace_id = $1 AND id = $2 AND retention_state <> 'deleted'
          RETURNING *`,
        [workspaceId, id, at],
      );
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toSourceFileRecord(rows[0]);
    },
  };

  /* ------------------------------------------------------------ validations */

  readonly validations = {
    save: async (record: ValidationRecord): Promise<ValidationRecord> => {
      await this.q(
        `INSERT INTO validation_results
           (id, workspace_id, asset_id, source_file_id, state, error_codes, errors, validated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          record.id, record.workspaceId, record.assetId, record.sourceFileId, record.state,
          record.errors.map((e) => e.code),
          JSON.stringify(record.errors),
          record.validatedAt,
        ],
      );
      return record;
    },
    findLatest: async (workspaceId: string, assetId: string): Promise<ValidationRecord | null> => {
      const rows = await this.q<ValidationRow>(
        `SELECT * FROM validation_results
          WHERE workspace_id = $1 AND asset_id = $2
          ORDER BY validated_at DESC, id DESC
          LIMIT 1`,
        [workspaceId, assetId],
      );
      return rows[0] ? toValidation(rows[0]) : null;
    },
  };

  /* ----------------------------------------------------------- attestations */

  readonly attestations = {
    /** Append-only: khong bao gio UPDATE. Moi lan ky la mot dong moi. */
    create: async (attestation: RightsAttestation): Promise<RightsAttestation> => {
      await this.q(
        `INSERT INTO rights_attestations (
           id, workspace_id, scope, asset_id, source_file_id, status, attested_by_user_id,
           statement_id, statement_version, locale_shown, attestation_type, attested_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          attestation.id, attestation.workspaceId, attestation.scope, attestation.assetId,
          attestation.sourceFileId, attestation.status, attestation.attestedByUserId,
          attestation.statementId, attestation.statementVersion, attestation.localeShown,
          attestation.attestationType, attestation.attestedAt,
        ],
      );
      return attestation;
    },
    findLatest: async (workspaceId: string, assetId: string): Promise<RightsAttestation | null> => {
      const rows = await this.q<AttestationRow>(
        `SELECT * FROM rights_attestations
          WHERE workspace_id = $1 AND asset_id = $2
          ORDER BY attested_at DESC, id DESC
          LIMIT 1`,
        [workspaceId, assetId],
      );
      return rows[0] ? toAttestation(rows[0]) : null;
    },
  };

  /* ------------------------------------------------------------------- jobs */

  readonly jobs = {
    create: async (job: ProcessingJob): Promise<ProcessingJob> => {
      await this.q(
        `INSERT INTO processing_jobs (
           id, workspace_id, project_id, asset_id, source_file_id, media_type, state,
           operations, regions, preserve_original_metadata, preserve_ai_provenance, preset_id,
           output_asset_id, reason_code, block_reason_kind, idempotency_key, attempt_count,
           created_at, updated_at, branding
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)`,
        jobValues(job),
      );
      return job;
    },
    findById: async (workspaceId: string, id: string): Promise<ProcessingJob | null> => {
      const rows = await this.q<JobRow>('SELECT * FROM processing_jobs WHERE id = $1 AND workspace_id = $2', [
        id,
        workspaceId,
      ]);
      return rows[0] ? toJob(rows[0]) : null;
    },
    findByIdempotencyKey: async (workspaceId: string, key: string): Promise<ProcessingJob | null> => {
      const rows = await this.q<JobRow>(
        'SELECT * FROM processing_jobs WHERE workspace_id = $1 AND idempotency_key = $2',
        [workspaceId, key],
      );
      return rows[0] ? toJob(rows[0]) : null;
    },
    listByAsset: async (workspaceId: string, assetId: string): Promise<ProcessingJob[]> => {
      const rows = await this.q<JobRow>(
        'SELECT * FROM processing_jobs WHERE workspace_id = $1 AND asset_id = $2 ORDER BY created_at DESC',
        [workspaceId, assetId]);
      return rows.map(toJob);
    },
    update: async (job: ProcessingJob): Promise<ProcessingJob> => {
      // Danh sach tham so RIENG cho UPDATE: truyen thua tham so khong dung o dau thi
      // PostgreSQL khong suy duoc kieu va bao "could not determine data type".
      const rows = await this.q<JobRow>(
        `UPDATE processing_jobs SET
           state = $3, operations = $4, regions = $13::jsonb,
           preserve_original_metadata = $5, preserve_ai_provenance = $6,
           preset_id = $7, output_asset_id = $8, reason_code = $9, block_reason_kind = $10,
           attempt_count = $11, updated_at = $12
         WHERE id = $1 AND workspace_id = $2
         RETURNING *`,
        [
          job.id, job.workspaceId, job.state, job.request.operations,
          job.request.preserveOriginalMetadata, job.request.preserveAiProvenance,
          job.request.presetId, job.outputAssetId, job.reasonCode, job.blockReasonKind,
          job.attemptCount, job.updatedAt, JSON.stringify(job.request.regions ?? []),
        ],
      );
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toJob(rows[0]);
    },
    claimQueued: async (now: string): Promise<ProcessingJob | null> => {
      /*
       * `FOR UPDATE SKIP LOCKED` la diem mau chot: dong nao worker khac dang giu thi BO QUA,
       * khong xep hang doi. Neu doi, hai worker se lan luot cung nhan mot job va tep bi xu ly
       * hai lan. `SKIP LOCKED` bien hang doi thanh thu ma nhieu worker chia nhau duoc that su.
       *
       * Ca viec chon va viec doi trang thai nam trong MOT cau lenh => khong co khe ho o giua.
       */
      const rows = await this.q<JobRow>(
        `UPDATE processing_jobs SET state = 'processing', attempt_count = attempt_count + 1, updated_at = $1
          WHERE id = (
            SELECT id FROM processing_jobs
             WHERE state = 'queued'
             ORDER BY created_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
          RETURNING *`,
        [now],
      );
      return rows[0] ? toJob(rows[0]) : null;
    },

    claimStale: async (now: string, staleBefore: string): Promise<ProcessingJob | null> => {
      /*
       * Cung khuon voi `claimQueued`: chon va doi trang thai trong MOT cau lenh, `SKIP LOCKED` de
       * nhieu worker chia nhau duoc that su.
       *
       * Khac o dieu kien: nhin `processing` va `updated_at` da cu. `updated_at` duoc chinh moi lan
       * job doi trang thai, nen no chinh la "lan cuoi con co ai do dong vao job nay".
       */
      const rows = await this.q<JobRow>(
        `UPDATE processing_jobs SET attempt_count = attempt_count + 1, updated_at = $1
          WHERE id = (
            SELECT id FROM processing_jobs
             WHERE state = 'processing' AND updated_at < $2
             ORDER BY updated_at ASC
             LIMIT 1
             FOR UPDATE SKIP LOCKED
          )
          RETURNING *`,
        [now, staleBefore],
      );
      return rows[0] ? toJob(rows[0]) : null;
    },

    touch: async (workspaceId: string, id: string, now: string): Promise<boolean> => {
      // `state = 'processing'` trong WHERE la phan quan trong: job da roi trang thai thi
      // khong duoc cham nua, neu khong mot job da that bai se trong nhu dang chay.
      const rows = await this.q<{ id: string }>(
        `UPDATE processing_jobs SET updated_at = $3
          WHERE id = $1 AND workspace_id = $2 AND state = 'processing'
          RETURNING id`,
        [id, workspaceId, now],
      );
      return rows.length > 0;
    },
  };

  /* ------------------------------------------------------------------ usage */

  readonly outputs = {
    create: async (output: OutputAssetRecord): Promise<OutputAssetRecord> => {
      try {
        await this.q(
          `INSERT INTO output_assets
             (id, workspace_id, job_id, source_asset_id, storage_key, mime_type, byte_size,
              checksum_sha256, validated, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            output.id, output.workspaceId, output.jobId, output.sourceAssetId, output.storageKey,
            output.mimeType, output.byteSize, output.checksumSha256, output.validated, output.createdAt,
          ],
        );
      } catch (error) {
        // UNIQUE (job_id): moi job dung mot ban ket qua. Chay lai => job MOI (D-005).
        if (isUniqueViolation(error)) throw new Error(ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
        throw error;
      }
      return output;
    },
    findByJob: async (workspaceId: string, jobId: string): Promise<OutputAssetRecord | null> => {
      const rows = await this.q<OutputRow>(
        'SELECT * FROM output_assets WHERE workspace_id = $1 AND job_id = $2',
        [workspaceId, jobId],
      );
      return rows[0] ? toOutput(rows[0]) : null;
    },
    findById: async (workspaceId: string, id: string): Promise<OutputAssetRecord | null> => {
      const rows = await this.q<OutputRow>(
        'SELECT * FROM output_assets WHERE workspace_id = $1 AND id = $2',
        [workspaceId, id],
      );
      return rows[0] ? toOutput(rows[0]) : null;
    },
    markValidated: async (workspaceId: string, id: string): Promise<OutputAssetRecord> => {
      const rows = await this.q<OutputRow>(
        'UPDATE output_assets SET validated = true WHERE workspace_id = $1 AND id = $2 RETURNING *',
        [workspaceId, id],
      );
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toOutput(rows[0]);
    },
  };

  readonly uploadSessions = {
    create: async (session: UploadSessionRecord): Promise<UploadSessionRecord> => {
      try {
        await this.q(
          `INSERT INTO upload_sessions
             (id, workspace_id, project_id, asset_id, source_file_id, storage_key, content_type,
              declared_byte_size, chunk_size_bytes, total_chunks, received_chunks, state, created_at, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
          [
            session.id, session.workspaceId, session.projectId, session.assetId, session.sourceFileId,
            session.storageKey, session.contentType, session.declaredByteSize, session.chunkSizeBytes,
            session.totalChunks, JSON.stringify(session.receivedChunks), session.state,
            session.createdAt, session.expiresAt,
          ],
        );
      } catch (error) {
        if (isUniqueViolation(error)) throw new Error(ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
        throw error;
      }
      return session;
    },
    findById: async (workspaceId: string, id: string): Promise<UploadSessionRecord | null> => {
      const rows = await this.q<UploadSessionRow>(
        'SELECT * FROM upload_sessions WHERE workspace_id = $1 AND id = $2',
        [workspaceId, id],
      );
      return rows[0] ? toUploadSession(rows[0]) : null;
    },
    findBySourceFile: async (workspaceId: string, sourceFileId: string): Promise<UploadSessionRecord | null> => {
      const rows = await this.q<UploadSessionRow>(
        'SELECT * FROM upload_sessions WHERE workspace_id = $1 AND source_file_id = $2',
        [workspaceId, sourceFileId],
      );
      return rows[0] ? toUploadSession(rows[0]) : null;
    },
    recordChunk: async (workspaceId: string, id: string, chunkIndex: number): Promise<UploadSessionRecord> => {
      /*
       * Gop trong MOT cau lenh, khong doc-sua-ghi. Hai manh gui song song ma doc-sua-ghi thi mot
       * trong hai se bien mat khoi danh sach, va luot tai len se "thieu manh" ma khong ai biet
       * vi sao. `- to_jsonb(...)` truoc khi noi vao => ghi trung mot manh khong sinh ban sao.
       */
      const rows = await this.q<UploadSessionRow>(
        `UPDATE upload_sessions
            SET received_chunks = (
                  SELECT COALESCE(jsonb_agg(v ORDER BY (v::text)::int), '[]'::jsonb)
                    FROM jsonb_array_elements(
                           (received_chunks - to_jsonb($3::int)::text) || jsonb_build_array($3::int)
                         ) AS v
                )
          WHERE workspace_id = $1 AND id = $2
        RETURNING *`,
        [workspaceId, id, chunkIndex],
      );
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toUploadSession(rows[0]);
    },
    setState: async (workspaceId: string, id: string, state: UploadSessionRecord['state']): Promise<UploadSessionRecord> => {
      const rows = await this.q<UploadSessionRow>(
        'UPDATE upload_sessions SET state = $3 WHERE workspace_id = $1 AND id = $2 RETURNING *',
        [workspaceId, id, state],
      );
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toUploadSession(rows[0]);
    },

    listExpired: async (now: string, limit: number): Promise<UploadSessionRecord[]> => {
      const rows = await this.q<UploadSessionRow>(
        `SELECT * FROM upload_sessions
          WHERE state = 'open' AND expires_at < $1
          ORDER BY expires_at ASC
          LIMIT $2`,
        [now, limit],
      );
      return rows.map(toUploadSession);
    },
  };

  readonly videoProxies = {
    upsert: async (proxy: VideoProxyRecord): Promise<VideoProxyRecord> => {
      /*
       * `ON CONFLICT (asset_id)` — tao lai proxy la chuyen binh thuong (lan truoc that bai, hoac
       * nguoi dung muon ban moi). Dung `create` roi bao loi trung se bat tang tren phai tu xoa
       * truoc, va do la cho de bo sot.
       */
      await this.q(
        `INSERT INTO video_proxies
           (id, workspace_id, asset_id, source_file_id, storage_key, mime_type, byte_size,
            width_px, height_px, duration_seconds, has_audio, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (asset_id) DO UPDATE SET
           id = EXCLUDED.id, storage_key = EXCLUDED.storage_key, mime_type = EXCLUDED.mime_type,
           byte_size = EXCLUDED.byte_size, width_px = EXCLUDED.width_px,
           height_px = EXCLUDED.height_px, duration_seconds = EXCLUDED.duration_seconds,
           has_audio = EXCLUDED.has_audio, created_at = EXCLUDED.created_at`,
        [
          proxy.id, proxy.workspaceId, proxy.assetId, proxy.sourceFileId, proxy.storageKey,
          proxy.mimeType, proxy.byteSize, proxy.widthPx, proxy.heightPx, proxy.durationSeconds,
          proxy.hasAudio, proxy.createdAt,
        ],
      );
      return proxy;
    },
    findByAsset: async (workspaceId: string, assetId: string): Promise<VideoProxyRecord | null> => {
      const rows = await this.q<VideoProxyRow>(
        'SELECT * FROM video_proxies WHERE workspace_id = $1 AND asset_id = $2',
        [workspaceId, assetId],
      );
      return rows[0] ? toVideoProxy(rows[0]) : null;
    },
  };

  readonly provenance = {
    create: async (record: ProvenanceRecord): Promise<ProvenanceRecord> => {
      await this.q(
        `INSERT INTO provenance_records
           (id, workspace_id, original_metadata_presence, ai_provenance_presence,
            preservation_requested, preservation_attempted, preservation_result,
            limitation_note, evidence_status, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          record.id, record.workspaceId, record.originalMetadataPresence, record.aiProvenancePresence,
          record.preservationRequested, record.preservationAttempted, record.preservationResult,
          record.limitationNote, record.evidenceStatus, record.recordedAt,
        ],
      );
      return record;
    },
    findById: async (workspaceId: string, id: string): Promise<ProvenanceRecord | null> => {
      const rows = await this.q<ProvenanceRow>(
        'SELECT * FROM provenance_records WHERE workspace_id = $1 AND id = $2',
        [workspaceId, id],
      );
      return rows[0] ? toProvenance(rows[0]) : null;
    },
  };

  readonly receipts = {
    create: async (receipt: ProcessingReceipt): Promise<ProcessingReceipt> => {
      try {
        await this.q(
          `INSERT INTO processing_receipts
             (id, workspace_id, job_id, source_asset_id, output_asset_id, operations,
              provider_run_ids, provenance_before_id, provenance_after_id,
              invisible_watermark_disclaimer_key, evidence_status, created_at,
              operation_mode, preset_id, input_checksum, output_checksum,
              audio_before, audio_after, audio_verdict, output_verified,
              failure_reason, review_reason,
              metadata_verdict, metadata_evidence, metadata_stripped_categories,
              disclosure_state, disclosure_limitation_key,
              brand_kit_id, brand_kit_version, schema_version,
              brand_logo_asset_id, brand_overlay_applied, disclosure_overlay_applied)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                   $13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20,$21,$22,
                   $23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)`,
          [
            receipt.id, receipt.workspaceId, receipt.jobId, receipt.sourceAssetId, receipt.outputAssetId,
            JSON.stringify(receipt.operations), JSON.stringify(receipt.providerRunIds),
            receipt.provenanceBeforeId, receipt.provenanceAfterId,
            receipt.invisibleWatermarkDisclaimerKey, receipt.evidenceStatus, receipt.createdAt,
            receipt.operationMode, receipt.presetId, receipt.inputChecksum, receipt.outputChecksum,
            receipt.audioBefore === null ? null : JSON.stringify(receipt.audioBefore),
            receipt.audioAfter === null ? null : JSON.stringify(receipt.audioAfter),
            receipt.audioVerdict, receipt.outputVerified,
            receipt.failureReason, receipt.reviewReason,
            receipt.metadataVerdict, receipt.metadataEvidence, receipt.metadataStrippedCategories,
            receipt.disclosureState, receipt.disclosureLimitationKey,
            receipt.brandKitId, receipt.brandKitVersion, receipt.schemaVersion,
            receipt.brandLogoAssetId, receipt.brandOverlayApplied, receipt.disclosureOverlayApplied,
          ],
        );
      } catch (error) {
        // UNIQUE (job_id): moi job dung mot bien nhan.
        if (isUniqueViolation(error)) throw new Error(ERROR_CODES.MCP_STATE_INVALID_TRANSITION);
        throw error;
      }
      return receipt;
    },
    findByJob: async (workspaceId: string, jobId: string): Promise<ProcessingReceipt | null> => {
      const rows = await this.q<ReceiptRow>(
        'SELECT * FROM processing_receipts WHERE workspace_id = $1 AND job_id = $2',
        [workspaceId, jobId],
      );
      return rows[0] ? toReceipt(rows[0]) : null;
    },
  };

  readonly usage = {
    append: async (entry: UsageLedgerEntry): Promise<UsageLedgerEntry> => {
      // Khoa idempotency la duy nhat trong so - day la cai chan double-charge o tang du lieu.
      const existing = await this.q<{ id: string }>(
        'SELECT id FROM usage_ledger_entries WHERE idempotency_key = $1',
        [entry.idempotencyKey],
      );
      if (existing.length > 0) throw new Error(ERROR_CODES.MCP_USAGE_RESERVATION_CONFLICT);
      try {
        await this.q(
          `INSERT INTO usage_ledger_entries (
             id, workspace_id, job_id, unit_type, quantity, entry_type, reason_code,
             idempotency_key, recorded_at, expires_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            entry.id, entry.workspaceId, entry.jobId, entry.unitType, entry.quantity,
            entry.entryType, entry.reasonCode, entry.idempotencyKey, entry.recordedAt,
            entry.expiresAt,
          ],
        );
      } catch (error) {
        // Hai lenh dong thoi cung vuot qua vong kiem tren => rang buoc UNIQUE cua DB chan not.
        if (isUniqueViolation(error)) throw new Error(ERROR_CODES.MCP_USAGE_RESERVATION_CONFLICT);
        throw error;
      }
      return entry;
    },
    listByWorkspace: async (workspaceId: string): Promise<UsageLedgerEntry[]> => {
      const rows = await this.q<UsageRow>(
        'SELECT * FROM usage_ledger_entries WHERE workspace_id = $1 ORDER BY recorded_at ASC, id ASC',
        [workspaceId],
      );
      return rows.map(toUsage);
    },
    listAll: async (): Promise<UsageLedgerEntry[]> => {
      const rows = await this.q<UsageRow>(
        'SELECT * FROM usage_ledger_entries ORDER BY recorded_at ASC, id ASC',
      );
      return rows.map(toUsage);
    },
  };

  /* ------------------------------------------------------------------ audit */

  /* ------------------------------------------------------- P4: frame tracking */

  readonly jobFrames = {
    saveTimeline: async (r: JobFrameTimelineRecord): Promise<JobFrameTimelineRecord> => {
      await this.q(
        `INSERT INTO job_frame_timelines
           (job_id, workspace_id, expected_frame_count, declared_frame_count, decoded_frame_count,
            undecodable_frames, fps, variable_frame_rate, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (job_id) DO UPDATE SET
           expected_frame_count = EXCLUDED.expected_frame_count,
           declared_frame_count = EXCLUDED.declared_frame_count,
           decoded_frame_count  = EXCLUDED.decoded_frame_count,
           undecodable_frames   = EXCLUDED.undecodable_frames,
           fps                  = EXCLUDED.fps,
           variable_frame_rate  = EXCLUDED.variable_frame_rate`,
        [r.jobId, r.workspaceId, r.expectedFrameCount, r.declaredFrameCount, r.decodedFrameCount,
         r.undecodableFrames, r.fps, r.variableFrameRate, r.createdAt],
      );
      return r;
    },

    findTimeline: async (workspaceId: string, jobId: string): Promise<JobFrameTimelineRecord | null> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM job_frame_timelines WHERE workspace_id = $1 AND job_id = $2', [workspaceId, jobId]);
      const row = rows[0];
      if (!row) return null;
      return {
        jobId: row.job_id as string,
        workspaceId: row.workspace_id as string,
        expectedFrameCount: Number(row.expected_frame_count),
        declaredFrameCount: row.declared_frame_count === null ? null : Number(row.declared_frame_count),
        decodedFrameCount: Number(row.decoded_frame_count),
        undecodableFrames: Number(row.undecodable_frames),
        fps: row.fps === null ? null : Number(row.fps),
        variableFrameRate: row.variable_frame_rate as boolean,
        createdAt: isoRequired(row.created_at as Date | string),
      };
    },

    replaceFrames: async (workspaceId: string, jobId: string, frames: readonly JobFrameRecord[]): Promise<void> => {
      await this.q('DELETE FROM job_frames WHERE workspace_id = $1 AND job_id = $2', [workspaceId, jobId]);
      // Ghi tung dong. Cham hon mot cau INSERT lon, nhung moi dong tu chiu rang buoc cua rieng no.
      for (const f of frames) {
        await this.q(
          `INSERT INTO job_frames
             (job_id, workspace_id, frame_index, state, box_x, box_y, box_width, box_height,
              confidence, source, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [f.jobId, f.workspaceId, f.frameIndex, f.state,
           f.box?.x ?? null, f.box?.y ?? null, f.box?.width ?? null, f.box?.height ?? null,
           f.confidence, f.source, f.updatedAt],
        );
      }
    },

    listFrames: async (workspaceId: string, jobId: string): Promise<JobFrameRecord[]> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM job_frames WHERE workspace_id = $1 AND job_id = $2 ORDER BY frame_index ASC',
        [workspaceId, jobId]);
      return rows.map(toFrameRecord);
    },

    updateFrame: async (r: JobFrameRecord): Promise<JobFrameRecord> => {
      const rows = await this.q<Record<string, unknown>>(
        `UPDATE job_frames SET state = $4, box_x = $5, box_y = $6, box_width = $7, box_height = $8,
                confidence = $9, source = $10, updated_at = $11
          WHERE job_id = $1 AND workspace_id = $2 AND frame_index = $3
          RETURNING *`,
        [r.jobId, r.workspaceId, r.frameIndex, r.state,
         r.box?.x ?? null, r.box?.y ?? null, r.box?.width ?? null, r.box?.height ?? null,
         r.confidence, r.source, r.updatedAt],
      );
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toFrameRecord(rows[0]);
    },

    appendCorrection: async (r: JobFrameCorrectionRecord): Promise<JobFrameCorrectionRecord> => {
      // CHI insert. Khong co duong UPDATE hay DELETE nao cho bang nay trong toan bo ma.
      await this.q(
        CORRECTION_INSERT_SQL,
        correctionInsertParams(r),
      );
      return r;
    },

    listCorrections: async (workspaceId: string, jobId: string): Promise<JobFrameCorrectionRecord[]> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM job_frame_corrections WHERE workspace_id = $1 AND job_id = $2 ORDER BY corrected_at ASC',
        [workspaceId, jobId]);
      return rows.map((row) => ({
        id: row.id as string,
        jobId: row.job_id as string,
        workspaceId: row.workspace_id as string,
        frameIndex: Number(row.frame_index),
        beforeState: row.before_state as JobFrameRecord['state'],
        beforeSource: row.before_source as JobFrameRecord['source'],
        beforeBox: (row.before_box as JobFrameRecord['box']) ?? null,
        beforeConfidence: row.before_confidence === null ? null : Number(row.before_confidence),
        afterBox: row.after_box as NonNullable<JobFrameRecord['box']>,
        reinterpolated: (row.reinterpolated as number[]) ?? [],
        neighbours: (row.neighbours as JobFrameCorrectionNeighbour[]) ?? [],
        flickerBefore: row.flicker_before === null ? null : Number(row.flicker_before),
        flickerAfter: row.flicker_after === null ? null : Number(row.flicker_after),
        gateVerdictBefore: (row.gate_verdict_before as QualityGateVerdict | null) ?? null,
        gateVerdictAfter: (row.gate_verdict_after as QualityGateVerdict | null) ?? null,
        correctedAt: isoRequired(row.corrected_at as Date | string),
        actorUserId: (row.actor_user_id as string | null) ?? null,
      }));
    },

    /*
     * `D-074` — mot lan sua keyframe la MOT giao dich.
     *
     * Ghi audit TRUOC roi cap nhat tung frame, tat ca trong cung mot giao dich. Neu ghi roi rac,
     * mot su co o giua se de lai frame da doi ma audit chua ghi — tuc la gia tri cu bien mat vinh
     * vien va khong ai doi chieu lai duoc. `ROLLBACK` o day la thu duy nhat bao dam dieu do.
     */
    applyCorrectionAtomically: async (input: {
      audit: JobFrameCorrectionRecord;
      frames: readonly JobFrameRecord[];
    }): Promise<void> => {
      const client: PoolClient = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(CORRECTION_INSERT_SQL, correctionInsertParams(input.audit));
        for (const f of input.frames) {
          const updated = await client.query(
            `UPDATE job_frames SET state = $4, box_x = $5, box_y = $6, box_width = $7, box_height = $8,
                    confidence = $9, source = $10, updated_at = $11
              WHERE job_id = $1 AND workspace_id = $2 AND frame_index = $3`,
            [f.jobId, f.workspaceId, f.frameIndex, f.state,
             f.box?.x ?? null, f.box?.y ?? null, f.box?.width ?? null, f.box?.height ?? null,
             f.confidence, f.source, f.updatedAt],
          );
          // Khong co dong nao bi dung toi = danh sach dua vao sai. Do la loi, khong phai "khong sao".
          if (updated.rowCount === 0) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
        }
        await client.query('COMMIT');
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Loi goc moi la thu can nem len.
        }
        throw error;
      } finally {
        client.release();
      }
    },
  };

  /** `P5-MCP-51`. Chi sha index `(job_id, phase)` la thu ep tinh APPEND-ONLY o tang du lieu. */
  readonly metadataSnapshots = {
    save: async (r: JobMetadataSnapshotRecord): Promise<JobMetadataSnapshotRecord> => {
      /*
       * KHONG `ON CONFLICT DO UPDATE`. Ghi de mot anh chup `before` da co nghia la xoa mat ban goc
       * — thu duy nhat cho phep doi chieu. Trung khoa thi de rang buoc UNIQUE nem loi.
       */
      await this.q(
        `INSERT INTO job_metadata_snapshots
           (id, job_id, workspace_id, phase, readable, fields, unmeasured_keys, detector_id, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9)`,
        [r.id, r.jobId, r.workspaceId, r.phase, r.readable, JSON.stringify(r.fields),
         r.unmeasuredKeys, r.detectorId, r.recordedAt],
      );
      return r;
    },
    findByJob: async (workspaceId: string, jobId: string): Promise<JobMetadataSnapshotRecord[]> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM job_metadata_snapshots WHERE workspace_id = $1 AND job_id = $2 ORDER BY phase ASC',
        [workspaceId, jobId]);
      return rows.map((row) => ({
        id: row.id as string,
        jobId: row.job_id as string,
        workspaceId: row.workspace_id as string,
        phase: row.phase as 'before' | 'after',
        readable: row.readable as boolean,
        fields: (row.fields as JobMetadataSnapshotRecord['fields']) ?? [],
        unmeasuredKeys: (row.unmeasured_keys as string[]) ?? [],
        detectorId: row.detector_id as string,
        recordedAt: isoRequired(row.recorded_at as Date | string),
      }));
    },
  };

  /** `P5-MCP-53`. Khong mot cau lenh nao o day la `DELETE` — bo khong dung nua thi `archive`. */
  readonly brandKits = {
    create: async (kit: BrandKitRecord, first: BrandKitVersionRecord): Promise<BrandKitRecord> => {
      const client: PoolClient = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO brand_kits (id, workspace_id, state, current_version, created_at, updated_at, created_by_user_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [kit.id, kit.workspaceId, kit.state, kit.currentVersion, kit.createdAt, kit.updatedAt, kit.createdByUserId]);
        await client.query(BRAND_VERSION_INSERT_SQL, brandVersionParams(first));
        await client.query('COMMIT');
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* loi goc moi can nem len */ }
        throw error;
      } finally {
        client.release();
      }
      return kit;
    },
    addVersion: async (
      workspaceId: string, brandKitId: string, version: BrandKitVersionRecord,
    ): Promise<BrandKitRecord> => {
      const client: PoolClient = await this.pool.connect();
      try {
        await client.query('BEGIN');
        // Khoa dong lai: hai lan sua dong thoi khong duoc cung sinh ra mot so phien ban.
        const cur = await client.query<Record<string, unknown>>(
          'SELECT * FROM brand_kits WHERE id = $1 AND workspace_id = $2 FOR UPDATE', [brandKitId, workspaceId]);
        if (!cur.rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
        await client.query(BRAND_VERSION_INSERT_SQL, brandVersionParams(version));
        const updated = await client.query<Record<string, unknown>>(
          `UPDATE brand_kits SET current_version = $3, updated_at = $4
            WHERE id = $1 AND workspace_id = $2 RETURNING *`,
          [brandKitId, workspaceId, version.version, version.createdAt]);
        await client.query('COMMIT');
        return toBrandKit(updated.rows[0]!);
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* loi goc moi can nem len */ }
        throw error;
      } finally {
        client.release();
      }
    },
    setState: async (
      workspaceId: string, brandKitId: string, state: BrandKitState, at: string,
    ): Promise<BrandKitRecord> => {
      const rows = await this.q<Record<string, unknown>>(
        `UPDATE brand_kits SET state = $3, updated_at = $4
          WHERE id = $1 AND workspace_id = $2 RETURNING *`,
        [brandKitId, workspaceId, state, at]);
      if (!rows[0]) throw new Error(ERROR_CODES.MCP_RESOURCE_NOT_FOUND);
      return toBrandKit(rows[0]);
    },
    findById: async (workspaceId: string, brandKitId: string): Promise<BrandKitRecord | null> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM brand_kits WHERE id = $1 AND workspace_id = $2', [brandKitId, workspaceId]);
      return rows[0] ? toBrandKit(rows[0]) : null;
    },
    listByWorkspace: async (workspaceId: string): Promise<BrandKitRecord[]> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM brand_kits WHERE workspace_id = $1 ORDER BY created_at DESC', [workspaceId]);
      return rows.map(toBrandKit);
    },
    listVersions: async (workspaceId: string, brandKitId: string): Promise<BrandKitVersionRecord[]> => {
      const rows = await this.q<Record<string, unknown>>(
        `SELECT * FROM brand_kit_versions WHERE workspace_id = $1 AND brand_kit_id = $2 ORDER BY version ASC`,
        [workspaceId, brandKitId]);
      return rows.map(toBrandVersion);
    },
    findVersion: async (
      workspaceId: string, brandKitId: string, version: number,
    ): Promise<BrandKitVersionRecord | null> => {
      const rows = await this.q<Record<string, unknown>>(
        `SELECT * FROM brand_kit_versions WHERE workspace_id = $1 AND brand_kit_id = $2 AND version = $3`,
        [workspaceId, brandKitId, version]);
      return rows[0] ? toBrandVersion(rows[0]) : null;
    },
  };

  /** `D-077`. Khong mot cau lenh nao o day la `UPDATE` hay `DELETE`. */
  readonly brandLogos = {
    create: async (r: BrandLogoAssetRecord): Promise<BrandLogoAssetRecord> => {
      await this.q(
        `INSERT INTO brand_logo_assets
           (id, workspace_id, brand_kit_id, storage_key, mime_type, byte_size,
            width_px, height_px, checksum_sha256, created_at, created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [r.id, r.workspaceId, r.brandKitId, r.storageKey, r.mimeType, r.byteSize,
         r.widthPx, r.heightPx, r.checksumSha256, r.createdAt, r.createdByUserId]);
      return r;
    },
    findById: async (workspaceId: string, id: string): Promise<BrandLogoAssetRecord | null> => {
      const rows = await this.q<Record<string, unknown>>(
        'SELECT * FROM brand_logo_assets WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
      return rows[0] ? toBrandLogo(rows[0]) : null;
    },
    listByBrandKit: async (workspaceId: string, brandKitId: string): Promise<BrandLogoAssetRecord[]> => {
      const rows = await this.q<Record<string, unknown>>(
        `SELECT * FROM brand_logo_assets WHERE workspace_id = $1 AND brand_kit_id = $2
          ORDER BY created_at DESC`, [workspaceId, brandKitId]);
      return rows.map(toBrandLogo);
    },
  };

  readonly audit = {
    append: async (event: AuditEvent): Promise<AuditEvent> => {
      await this.q(
        `INSERT INTO audit_events
           (id, workspace_id, actor_user_id, event_type, subject_type, subject_id, detail, occurred_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
        [
          event.id, event.workspaceId, event.actorUserId, event.eventType, event.subjectType,
          event.subjectId, JSON.stringify(event.detail ?? {}), event.occurredAt,
        ],
      );
      return event;
    },
    listByWorkspace: async (workspaceId: string, query?: PageQuery): Promise<Page<AuditEvent>> => {
      const limit = limitOf(query);
      const after = decodeCursor(query?.cursor);
      const rows = await this.q<AuditRow>(
        `SELECT * FROM audit_events
          WHERE workspace_id = $1
            AND ($2::text IS NULL OR (occurred_at, id) < ($2::timestamptz, $3::text))
          ORDER BY occurred_at DESC, id DESC
          LIMIT $4`,
        [workspaceId, after?.createdAt ?? null, after?.id ?? null, limit + 1],
      );
      return pageOfBy(rows.map(toAudit), limit, (e) => e.occurredAt);
    },
  };
}

/* ====================================================================== rows */

type OutputRow = {
  id: string; workspace_id: string; job_id: string; source_asset_id: string;
  storage_key: string; mime_type: string; byte_size: string | number;
  checksum_sha256: string; validated: boolean; created_at: Date;
};

type UploadSessionRow = {
  id: string; workspace_id: string; project_id: string; asset_id: string; source_file_id: string;
  storage_key: string; content_type: string; declared_byte_size: string | number;
  chunk_size_bytes: number; total_chunks: number; received_chunks: unknown;
  state: string; created_at: Date; expires_at: Date;
};

type VideoProxyRow = {
  id: string; workspace_id: string; asset_id: string; source_file_id: string;
  storage_key: string; mime_type: string; byte_size: string | number;
  width_px: number | null; height_px: number | null; duration_seconds: number | null;
  has_audio: boolean; created_at: Date;
};

type ProvenanceRow = {
  id: string; workspace_id: string; original_metadata_presence: string; ai_provenance_presence: string;
  preservation_requested: boolean; preservation_attempted: boolean; preservation_result: string;
  limitation_note: string | null; evidence_status: string; recorded_at: Date;
};

type ReceiptRow = {
  id: string; workspace_id: string; job_id: string; source_asset_id: string;
  output_asset_id: string | null; operations: unknown; provider_run_ids: unknown;
  provenance_before_id: string; provenance_after_id: string | null;
  invisible_watermark_disclaimer_key: string; evidence_status: string; created_at: Date;
  operation_mode: string | null; preset_id: string | null;
  input_checksum: string | null; output_checksum: string | null;
  audio_before: unknown; audio_after: unknown; audio_verdict: string | null;
  output_verified: boolean; failure_reason: string | null; review_reason: string | null;
  // P5 (`D-075`). `null` = khong do duoc / khong ap dung, khong phai gia tri mac dinh.
  metadata_verdict: string | null; metadata_evidence: string | null;
  metadata_stripped_categories: string[] | null;
  disclosure_state: string | null; disclosure_limitation_key: string | null;
  brand_kit_id: string | null; brand_kit_version: number | null;
  schema_version: number | null;
  brand_logo_asset_id: string | null;
  brand_overlay_applied: boolean | null;
  disclosure_overlay_applied: boolean | null;
};

type SessionRow = {
  id: string; user_id: string; token_hash: string;
  created_at: Date; expires_at: Date; revoked_at: Date | null;
};

type UserRow = { id: string; email: string; display_name: string; default_locale: string; created_at: Date }
type WorkspaceRow = { id: string; name: string; owner_user_id: string; created_at: Date }
type MembershipRow = { id: string; workspace_id: string; user_id: string; role: string; created_at: Date }
type ProjectRow = { id: string; workspace_id: string; name: string; created_by_user_id: string; created_at: Date }
type AssetRow = { id: string; workspace_id: string; project_id: string; media_type: string; source_file_id: string; created_at: Date }

type SourceFileRow = {
  id: string; workspace_id: string; project_id: string; asset_id: string; storage_key: string;
  original_filename: string; declared_mime_type: string; declared_byte_size: string | number;
  declared_media_type: string; upload_state: string;
  mime_type: string | null; byte_size: string | number | null; checksum_sha256: string | null;
  duration_seconds: string | number | null; width_px: number | null; height_px: number | null;
  has_audio_stream: boolean | null; corrupt: boolean;
  created_at: Date; uploaded_at: Date | null;
  last_accessed_at: Date | null; retention_state: string; legal_hold_at: Date | null;
  scheduled_deletion_at: Date | null; deleted_at: Date | null; retention_policy_version: number;
}

type ValidationRow = {
  id: string; workspace_id: string; asset_id: string; source_file_id: string;
  state: string; error_codes: string[] | null; errors: unknown; validated_at: Date;
}

type AttestationRow = {
  id: string; workspace_id: string; scope: string; asset_id: string; source_file_id: string;
  status: string; attested_by_user_id: string; statement_id: string; statement_version: number;
  locale_shown: string; attestation_type: string; attested_at: Date;
}

type JobRow = {
  id: string; workspace_id: string; project_id: string; asset_id: string; source_file_id: string;
  media_type: string; state: string; operations: string[]; regions: unknown;
  branding: unknown;
  preserve_original_metadata: boolean;
  preserve_ai_provenance: boolean; preset_id: string | null; output_asset_id: string | null;
  reason_code: string | null; block_reason_kind: string | null; idempotency_key: string;
  attempt_count: number; created_at: Date; updated_at: Date;
}

type UsageRow = {
  id: string; workspace_id: string; job_id: string; unit_type: string; quantity: number;
  entry_type: string; reason_code: string | null; idempotency_key: string;
  recorded_at: Date; expires_at: Date | null;
}

type AuditRow = {
  id: string; workspace_id: string; actor_user_id: string | null; event_type: string;
  subject_type: string; subject_id: string; detail: unknown; occurred_at: Date;
}

/* ================================================================== mappers */

/** `bigint`/`numeric` ve tu pg duoi dang CHUOI de khong mat do chinh xac. Doi lai co chu dich. */
function num(value: string | number | null): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
}

function numRequired(value: string | number): number {
  const out = num(value);
  if (out === null) throw new Error('mong doi so nhung nhan duoc null');
  return out;
}

function toOutput(r: OutputRow): OutputAssetRecord {
  return {
    id: r.id, workspaceId: r.workspace_id, jobId: r.job_id, sourceAssetId: r.source_asset_id,
    storageKey: r.storage_key, mimeType: r.mime_type, byteSize: numRequired(r.byte_size),
    checksumSha256: r.checksum_sha256, validated: r.validated, createdAt: isoRequired(r.created_at),
  };
}

function toUploadSession(r: UploadSessionRow): UploadSessionRecord {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    projectId: r.project_id,
    assetId: r.asset_id,
    sourceFileId: r.source_file_id,
    storageKey: r.storage_key,
    contentType: r.content_type,
    declaredByteSize: numRequired(r.declared_byte_size),
    chunkSizeBytes: r.chunk_size_bytes,
    totalChunks: r.total_chunks,
    receivedChunks: Array.isArray(r.received_chunks) ? (r.received_chunks as number[]) : [],
    state: r.state as UploadSessionRecord['state'],
    createdAt: isoRequired(r.created_at),
    expiresAt: isoRequired(r.expires_at),
  };
}

function toVideoProxy(r: VideoProxyRow): VideoProxyRecord {
  return {
    id: r.id, workspaceId: r.workspace_id, assetId: r.asset_id, sourceFileId: r.source_file_id,
    storageKey: r.storage_key, mimeType: r.mime_type, byteSize: numRequired(r.byte_size),
    widthPx: r.width_px, heightPx: r.height_px, durationSeconds: r.duration_seconds,
    hasAudio: r.has_audio, createdAt: isoRequired(r.created_at),
  };
}

function toProvenance(r: ProvenanceRow): ProvenanceRecord {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    originalMetadataPresence: r.original_metadata_presence as ProvenanceRecord['originalMetadataPresence'],
    aiProvenancePresence: r.ai_provenance_presence as ProvenanceRecord['aiProvenancePresence'],
    preservationRequested: r.preservation_requested,
    preservationAttempted: r.preservation_attempted,
    preservationResult: r.preservation_result as ProvenanceRecord['preservationResult'],
    limitationNote: r.limitation_note,
    evidenceStatus: r.evidence_status as ProvenanceRecord['evidenceStatus'],
    recordedAt: isoRequired(r.recorded_at),
  };
}

function toReceipt(r: ReceiptRow): ProcessingReceipt {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    jobId: r.job_id,
    sourceAssetId: r.source_asset_id,
    outputAssetId: r.output_asset_id,
    operations: (Array.isArray(r.operations) ? r.operations : []) as ProcessingReceipt['operations'],
    providerRunIds: (Array.isArray(r.provider_run_ids) ? r.provider_run_ids : []) as ProcessingReceipt['providerRunIds'],
    provenanceBeforeId: r.provenance_before_id,
    provenanceAfterId: r.provenance_after_id,
    invisibleWatermarkDisclaimerKey: r.invisible_watermark_disclaimer_key,
    evidenceStatus: r.evidence_status as ProcessingReceipt['evidenceStatus'],
    createdAt: isoRequired(r.created_at),
    operationMode: r.operation_mode,
    presetId: r.preset_id,
    inputChecksum: r.input_checksum,
    outputChecksum: r.output_checksum,
    audioBefore: (r.audio_before ?? null) as ProcessingReceipt['audioBefore'],
    audioAfter: (r.audio_after ?? null) as ProcessingReceipt['audioAfter'],
    audioVerdict: r.audio_verdict,
    outputVerified: r.output_verified,
    failureReason: r.failure_reason,
    reviewReason: r.review_reason,
    metadataVerdict: (r.metadata_verdict ?? null) as ProcessingReceipt['metadataVerdict'],
    metadataEvidence: (r.metadata_evidence ?? null) as ProcessingReceipt['metadataEvidence'],
    metadataStrippedCategories: (r.metadata_stripped_categories ?? []) as ProcessingReceipt['metadataStrippedCategories'],
    disclosureState: (r.disclosure_state ?? null) as ProcessingReceipt['disclosureState'],
    disclosureLimitationKey: r.disclosure_limitation_key ?? null,
    brandKitId: r.brand_kit_id ?? null,
    brandKitVersion: r.brand_kit_version === null || r.brand_kit_version === undefined
      ? null : Number(r.brand_kit_version),
    // Dong ghi truoc Phase 5 khong co cot nay o gia tri nao khac `1` — va do la su that ve chung.
    schemaVersion: Number(r.schema_version ?? 1),
    brandLogoAssetId: r.brand_logo_asset_id ?? null,
    // Dong ghi truoc `D-077` khong co cot nay => `false`, va do la su that ve chung.
    brandOverlayApplied: r.brand_overlay_applied ?? false,
    disclosureOverlayApplied: r.disclosure_overlay_applied ?? false,
  };
}

function toSession(r: SessionRow): SessionRecord {
  return {
    id: r.id, userId: r.user_id, tokenHash: r.token_hash,
    createdAt: isoRequired(r.created_at), expiresAt: isoRequired(r.expires_at),
    revokedAt: iso(r.revoked_at),
  };
}

function toUser(r: UserRow): User {
  return {
    id: r.id, email: r.email, displayName: r.display_name,
    defaultLocale: r.default_locale, createdAt: isoRequired(r.created_at),
  };
}

function toWorkspace(r: WorkspaceRow): Workspace {
  return { id: r.id, name: r.name, ownerUserId: r.owner_user_id, createdAt: isoRequired(r.created_at) };
}

function toMembership(r: MembershipRow): WorkspaceMembership {
  return {
    id: r.id, workspaceId: r.workspace_id, userId: r.user_id,
    role: r.role as WorkspaceMembership['role'], createdAt: isoRequired(r.created_at),
  };
}

function toProject(r: ProjectRow): Project {
  return {
    id: r.id, workspaceId: r.workspace_id, name: r.name,
    createdByUserId: r.created_by_user_id, createdAt: isoRequired(r.created_at),
  };
}

function toAsset(r: AssetRow): Asset {
  return {
    id: r.id, workspaceId: r.workspace_id, projectId: r.project_id,
    mediaType: r.media_type as Asset['mediaType'], sourceFileId: r.source_file_id,
    createdAt: isoRequired(r.created_at),
  };
}

function toSourceFileRecord(r: SourceFileRow): SourceFileRecord {
  // `measured` chi ton tai khi DA do that. Chua co byte thi la null - khong bia so cho du field.
  const measured =
    r.upload_state === 'stored' && r.mime_type !== null
      ? {
          mimeType: r.mime_type,
          byteSize: numRequired(r.byte_size ?? 0),
          checksumSha256: r.checksum_sha256 ?? '',
          mediaType: r.declared_media_type as SourceFileRecord['declaredMediaType'],
          durationSeconds: num(r.duration_seconds),
          widthPx: r.width_px,
          heightPx: r.height_px,
          hasAudioStream: r.has_audio_stream,
          corrupt: r.corrupt,
        }
      : null;
  return {
    id: r.id, workspaceId: r.workspace_id, projectId: r.project_id, assetId: r.asset_id,
    storageKey: r.storage_key, originalFilename: r.original_filename,
    declaredMimeType: r.declared_mime_type, declaredByteSize: numRequired(r.declared_byte_size),
    declaredMediaType: r.declared_media_type as SourceFileRecord['declaredMediaType'],
    uploadState: r.upload_state as SourceFileRecord['uploadState'],
    measured: measured as SourceFileRecord['measured'],
    createdAt: isoRequired(r.created_at), uploadedAt: iso(r.uploaded_at),
    lastAccessedAt: iso(r.last_accessed_at),
    retentionState: r.retention_state as SourceFileRecord['retentionState'],
    legalHoldAt: iso(r.legal_hold_at), scheduledDeletionAt: iso(r.scheduled_deletion_at),
    deletedAt: iso(r.deleted_at), retentionPolicyVersion: r.retention_policy_version,
  };
}

function toValidation(r: ValidationRow): ValidationRecord {
  return {
    id: r.id, workspaceId: r.workspace_id, assetId: r.asset_id, sourceFileId: r.source_file_id,
    state: r.state as ValidationRecord['state'],
    errors: (Array.isArray(r.errors) ? r.errors : []) as ValidationRecord['errors'],
    validatedAt: isoRequired(r.validated_at),
  };
}

function toAttestation(r: AttestationRow): RightsAttestation {
  return {
    id: r.id, workspaceId: r.workspace_id, scope: r.scope as 'asset', assetId: r.asset_id,
    sourceFileId: r.source_file_id, status: r.status as RightsAttestation['status'],
    attestedByUserId: r.attested_by_user_id, statementId: r.statement_id,
    statementVersion: r.statement_version, localeShown: r.locale_shown,
    attestationType: r.attestation_type as 'user_self_declared',
    attestedAt: isoRequired(r.attested_at),
  };
}

function jobValues(job: ProcessingJob): unknown[] {
  return [
    job.id, job.workspaceId, job.projectId, job.assetId, job.sourceFileId, job.mediaType, job.state,
    job.request.operations, JSON.stringify(job.request.regions ?? []),
    job.request.preserveOriginalMetadata, job.request.preserveAiProvenance,
    job.request.presetId, job.outputAssetId, job.reasonCode, job.blockReasonKind,
    job.idempotencyKey, job.attemptCount, job.createdAt, job.updatedAt,
    job.request.branding === null ? null : JSON.stringify(job.request.branding),
  ];
}

function toJob(r: JobRow): ProcessingJob {
  return {
    id: r.id, workspaceId: r.workspace_id, projectId: r.project_id, assetId: r.asset_id,
    sourceFileId: r.source_file_id, mediaType: r.media_type as ProcessingJob['mediaType'],
    state: r.state as ProcessingJob['state'],
    request: {
      operations: r.operations as ProcessingJob['request']['operations'],
      regions: (Array.isArray(r.regions) ? r.regions : []) as ProcessingJob['request']['regions'],
      preserveOriginalMetadata: r.preserve_original_metadata as true,
      preserveAiProvenance: r.preserve_ai_provenance as true,
      presetId: r.preset_id,
      // `NULL` = nguoi dung khong chon lop phu nao. Day la mac dinh va la cho an toan.
      branding: (r.branding as ProcessingJob['request']['branding']) ?? null,
    },
    outputAssetId: r.output_asset_id, reasonCode: r.reason_code,
    blockReasonKind: r.block_reason_kind as ProcessingJob['blockReasonKind'],
    idempotencyKey: r.idempotency_key, attemptCount: r.attempt_count,
    createdAt: isoRequired(r.created_at), updatedAt: isoRequired(r.updated_at),
  };
}

function toUsage(r: UsageRow): UsageLedgerEntry {
  return {
    id: r.id, workspaceId: r.workspace_id, jobId: r.job_id,
    unitType: r.unit_type as UsageLedgerEntry['unitType'], quantity: r.quantity,
    entryType: r.entry_type as UsageLedgerEntry['entryType'], reasonCode: r.reason_code,
    idempotencyKey: r.idempotency_key, recordedAt: isoRequired(r.recorded_at),
    expiresAt: iso(r.expires_at),
  };
}

function toAudit(r: AuditRow): AuditEvent {
  return {
    id: r.id, workspaceId: r.workspace_id, actorUserId: r.actor_user_id,
    eventType: r.event_type, subjectType: r.subject_type as AuditEvent['subjectType'],
    subjectId: r.subject_id, detail: (r.detail ?? {}) as AuditEvent['detail'],
    occurredAt: isoRequired(r.occurred_at),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

/*
 * `D-074`. MOT cau INSERT dung chung cho ca `appendCorrection` va `applyCorrectionAtomically`.
 *
 * Viet hai lan se de hai ban lech nhau khi them cot — va vi bang nay la APPEND-ONLY, mot dong ghi
 * thieu cot khong the sua lai duoc.
 */
const CORRECTION_INSERT_SQL = `INSERT INTO job_frame_corrections
   (id, job_id, workspace_id, frame_index, before_state, before_source, before_box,
    before_confidence, after_box, reinterpolated, neighbours, flicker_before, flicker_after,
    gate_verdict_before, gate_verdict_after, corrected_at, actor_user_id)
 VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11::jsonb,$12,$13,$14,$15,$16,$17)`;

function correctionInsertParams(r: JobFrameCorrectionRecord): unknown[] {
  return [
    r.id, r.jobId, r.workspaceId, r.frameIndex, r.beforeState, r.beforeSource,
    r.beforeBox === null ? null : JSON.stringify(r.beforeBox), r.beforeConfidence,
    JSON.stringify(r.afterBox), r.reinterpolated, JSON.stringify(r.neighbours),
    r.flickerBefore, r.flickerAfter, r.gateVerdictBefore, r.gateVerdictAfter,
    r.correctedAt, r.actorUserId,
  ];
}

const BRAND_VERSION_INSERT_SQL = `INSERT INTO brand_kit_versions
   (brand_kit_id, workspace_id, version, name, colors, logo_asset_id,
    overlay_position, overlay_opacity, overlay_include_disclosure, created_at, created_by_user_id)
 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`;

function brandVersionParams(v: BrandKitVersionRecord): unknown[] {
  return [
    v.brandKitId, v.workspaceId, v.version, v.name, v.colors, v.logoAssetId,
    v.overlayPosition, v.overlayOpacity, v.overlayIncludeDisclosure, v.createdAt, v.createdByUserId,
  ];
}

function toBrandLogo(row: Record<string, unknown>): BrandLogoAssetRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    brandKitId: row.brand_kit_id as string,
    storageKey: row.storage_key as string,
    mimeType: row.mime_type as string,
    byteSize: Number(row.byte_size),
    widthPx: Number(row.width_px),
    heightPx: Number(row.height_px),
    checksumSha256: row.checksum_sha256 as string,
    createdAt: isoRequired(row.created_at as Date | string),
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
  };
}

function toBrandKit(row: Record<string, unknown>): BrandKitRecord {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    state: row.state as BrandKitState,
    currentVersion: Number(row.current_version),
    createdAt: isoRequired(row.created_at as Date | string),
    updatedAt: isoRequired(row.updated_at as Date | string),
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
  };
}

function toBrandVersion(row: Record<string, unknown>): BrandKitVersionRecord {
  return {
    brandKitId: row.brand_kit_id as string,
    workspaceId: row.workspace_id as string,
    version: Number(row.version),
    name: row.name as string,
    colors: (row.colors as string[]) ?? [],
    logoAssetId: (row.logo_asset_id as string | null) ?? null,
    overlayPosition: row.overlay_position as BrandKitVersionRecord['overlayPosition'],
    overlayOpacity: Number(row.overlay_opacity),
    overlayIncludeDisclosure: row.overlay_include_disclosure as boolean,
    createdAt: isoRequired(row.created_at as Date | string),
    createdByUserId: (row.created_by_user_id as string | null) ?? null,
  };
}

function toFrameRecord(row: Record<string, unknown>): JobFrameRecord {
  const x = row.box_x;
  return {
    jobId: row.job_id as string,
    workspaceId: row.workspace_id as string,
    frameIndex: Number(row.frame_index),
    state: row.state as JobFrameRecord['state'],
    box: x === null || x === undefined ? null : {
      x: Number(row.box_x), y: Number(row.box_y),
      width: Number(row.box_width), height: Number(row.box_height),
    },
    confidence: row.confidence === null ? null : Number(row.confidence),
    source: row.source as JobFrameRecord['source'],
    updatedAt: isoRequired(row.updated_at as Date | string),
  };
}
