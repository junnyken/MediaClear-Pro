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
import type { Pool, PoolClient } from 'pg';
import type { PersistencePort } from './port.js';
import type {
  Asset,
  AuditEvent,
  Page,
  PageQuery,
  ProcessingJob,
  Project,
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
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null };
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
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
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
    listByWorkspace: async (workspaceId: string, limit = 100): Promise<AuditEvent[]> => {
      const rows = await this.q<AuditRow>(
        `SELECT * FROM audit_events WHERE workspace_id = $1
          ORDER BY occurred_at DESC, id DESC LIMIT $2`,
        [workspaceId, limit],
      );
      return rows.map(toAudit);
    },
  };
}

/* ====================================================================== rows */

type OutputRow = {
  id: string; workspace_id: string; job_id: string; source_asset_id: string;
  storage_key: string; mime_type: string; byte_size: string | number;
  checksum_sha256: string; validated: boolean; created_at: Date;
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
