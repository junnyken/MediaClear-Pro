-- MediaClear Pro - Phase 1 schema (MCP-11 / MCP-13 / MCP-14 / MCP-15).
--
-- Nguyen tac:
--  * Media binary KHONG BAO GIO nam trong PostgreSQL: chi luu storage_key tro toi object store.
--  * Moi bang nghiep vu deu co workspace_id => moi truy van bi rang buoc theo tenant.
--  * Quan he cha-con dung KHOA NGOAI GHEP (id, workspace_id) de khong the tro cheo workspace.
--  * Khong destructive: migration nay chi TAO moi, khong sua/xoa gi.
--
-- Trang thai: da chay thu tren mot PostgreSQL 16 SACH (xem docs/TEST_LOG.md).
-- Runtime Phase 1 van dung InMemoryPersistence; adapter PostgreSQL la viec cua phase sau.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             text PRIMARY KEY,
  email          text NOT NULL UNIQUE,
  display_name   text NOT NULL,
  default_locale text NOT NULL DEFAULT 'vi' CHECK (default_locale IN ('vi', 'en')),
  created_at     timestamptz NOT NULL
);

CREATE TABLE workspaces (
  id             text PRIMARY KEY,
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  owner_user_id  text NOT NULL REFERENCES users (id),
  created_at     timestamptz NOT NULL
);

CREATE TABLE workspace_members (
  id            text PRIMARY KEY,
  workspace_id  text NOT NULL REFERENCES workspaces (id),
  user_id       text NOT NULL REFERENCES users (id),
  -- 4 role MVP, khong hon (owner decision Q-04).
  role          text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at    timestamptz NOT NULL,
  UNIQUE (workspace_id, user_id)
);
CREATE INDEX workspace_members_user_idx ON workspace_members (user_id);

CREATE TABLE projects (
  id                  text PRIMARY KEY,
  workspace_id        text NOT NULL REFERENCES workspaces (id),
  name                text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  created_by_user_id  text NOT NULL REFERENCES users (id),
  created_at          timestamptz NOT NULL,
  -- Cho phep khoa ngoai ghep tu asset: asset khong the tro toi project cua workspace khac.
  UNIQUE (id, workspace_id)
);
CREATE INDEX projects_workspace_idx ON projects (workspace_id, created_at);

CREATE TABLE assets (
  id              text PRIMARY KEY,
  workspace_id    text NOT NULL REFERENCES workspaces (id),
  project_id      text NOT NULL,
  media_type      text NOT NULL CHECK (media_type IN ('image', 'video')),
  source_file_id  text NOT NULL,
  created_at      timestamptz NOT NULL,
  FOREIGN KEY (project_id, workspace_id) REFERENCES projects (id, workspace_id),
  UNIQUE (id, workspace_id)
);
CREATE INDEX assets_project_idx ON assets (workspace_id, project_id, created_at);

CREATE TABLE source_files (
  id                  text PRIMARY KEY,
  workspace_id        text NOT NULL REFERENCES workspaces (id),
  asset_id            text NOT NULL,
  -- Khoa object store. KHONG luu byte media trong database.
  storage_key         text NOT NULL UNIQUE,
  original_filename   text NOT NULL,
  declared_mime_type  text NOT NULL,
  declared_byte_size  bigint NOT NULL CHECK (declared_byte_size > 0),
  upload_state        text NOT NULL CHECK (upload_state IN ('pending', 'stored')),
  -- Cac cot do THAT SU tu byte; NULL = chua do duoc (khong dien 0 thay cho "chua biet").
  mime_type           text,
  byte_size           bigint CHECK (byte_size IS NULL OR byte_size > 0),
  checksum_sha256     text,
  duration_seconds    numeric,
  width_px            integer,
  height_px           integer,
  has_audio_stream    boolean,
  corrupt             boolean,
  created_at          timestamptz NOT NULL,
  uploaded_at         timestamptz,
  FOREIGN KEY (asset_id, workspace_id) REFERENCES assets (id, workspace_id),
  UNIQUE (id, workspace_id),
  -- Da 'stored' thi bat buoc co so do that; chua 'stored' thi khong duoc co.
  CONSTRAINT source_files_stored_has_measurements CHECK (
    (upload_state = 'stored' AND byte_size IS NOT NULL AND checksum_sha256 IS NOT NULL AND uploaded_at IS NOT NULL)
    OR (upload_state = 'pending' AND byte_size IS NULL AND checksum_sha256 IS NULL AND uploaded_at IS NULL)
  )
);

CREATE TABLE validation_results (
  id              text PRIMARY KEY,
  workspace_id    text NOT NULL REFERENCES workspaces (id),
  asset_id        text NOT NULL,
  source_file_id  text NOT NULL,
  state           text NOT NULL CHECK (state IN ('passed', 'failed')),
  error_codes     text[] NOT NULL DEFAULT '{}',
  validated_at    timestamptz NOT NULL,
  FOREIGN KEY (asset_id, workspace_id) REFERENCES assets (id, workspace_id)
);
CREATE INDEX validation_results_asset_idx ON validation_results (workspace_id, asset_id, validated_at DESC);

CREATE TABLE rights_attestations (
  id                 text PRIMARY KEY,
  workspace_id       text NOT NULL REFERENCES workspaces (id),
  -- MVP chi co scope 'asset' (owner decision Q-09).
  scope              text NOT NULL DEFAULT 'asset' CHECK (scope = 'asset'),
  asset_id           text NOT NULL,
  source_file_id     text NOT NULL,
  status             text NOT NULL CHECK (status IN ('active', 'blocked')),
  attested_by_user_id text NOT NULL REFERENCES users (id),
  statement_id       text NOT NULL,
  statement_version  integer NOT NULL CHECK (statement_version >= 1),
  locale_shown       text NOT NULL,
  -- Day la LOI KHAI cua nguoi dung, khong phai bang chung so huu.
  attestation_type   text NOT NULL CHECK (attestation_type = 'user_self_declared'),
  attested_at        timestamptz NOT NULL,
  FOREIGN KEY (asset_id, workspace_id) REFERENCES assets (id, workspace_id)
);
CREATE INDEX rights_attestations_asset_idx ON rights_attestations (workspace_id, asset_id, attested_at DESC);

CREATE TABLE processing_jobs (
  id                 text PRIMARY KEY,
  workspace_id       text NOT NULL REFERENCES workspaces (id),
  project_id         text NOT NULL,
  asset_id           text NOT NULL,
  source_file_id     text NOT NULL,
  media_type         text NOT NULL CHECK (media_type IN ('image', 'video')),
  state              text NOT NULL CHECK (state IN (
    'uploaded', 'validating', 'queued', 'processing', 'review_required',
    'completed', 'failed', 'blocked', 'cancelled'
  )),
  operations         text[] NOT NULL CHECK (array_length(operations, 1) >= 1),
  preserve_original_metadata boolean NOT NULL DEFAULT true CHECK (preserve_original_metadata),
  preserve_ai_provenance     boolean NOT NULL DEFAULT true CHECK (preserve_ai_provenance),
  preset_id          text,
  output_asset_id    text,
  reason_code        text,
  block_reason_kind  text CHECK (block_reason_kind IS NULL OR block_reason_kind IN ('policy_block', 'validation_block', 'provider_block')),
  idempotency_key    text NOT NULL,
  attempt_count      integer NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  created_at         timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL,
  FOREIGN KEY (asset_id, workspace_id) REFERENCES assets (id, workspace_id),
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (id, workspace_id),
  -- Invariant I-2 o tang du lieu: 'completed' bat buoc phai co output.
  CONSTRAINT processing_jobs_completed_requires_output CHECK (state <> 'completed' OR output_asset_id IS NOT NULL),
  -- 'blocked' bat buoc co ly do va phan loai ly do.
  CONSTRAINT processing_jobs_blocked_requires_reason CHECK (state <> 'blocked' OR (reason_code IS NOT NULL AND block_reason_kind IS NOT NULL))
);
CREATE INDEX processing_jobs_asset_idx ON processing_jobs (workspace_id, asset_id, created_at DESC);

CREATE TABLE usage_ledger_entries (
  id               text PRIMARY KEY,
  workspace_id     text NOT NULL REFERENCES workspaces (id),
  job_id           text NOT NULL,
  unit_type        text NOT NULL CHECK (unit_type IN ('image_unit', 'video_minute_unit')),
  quantity         integer NOT NULL CHECK (quantity > 0),
  entry_type       text NOT NULL CHECK (entry_type IN ('reserve', 'commit', 'release')),
  reason_code      text,
  idempotency_key  text NOT NULL UNIQUE,
  recorded_at      timestamptz NOT NULL,
  FOREIGN KEY (job_id, workspace_id) REFERENCES processing_jobs (id, workspace_id),
  -- Chan double-charge o tang du lieu: moi job chi mot entry cho moi loai.
  UNIQUE (job_id, entry_type)
);
CREATE INDEX usage_ledger_workspace_idx ON usage_ledger_entries (workspace_id, recorded_at);

CREATE TABLE audit_events (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces (id),
  actor_user_id  text REFERENCES users (id),
  event_type     text NOT NULL,
  subject_type   text NOT NULL CHECK (subject_type IN (
    'workspace', 'project', 'membership', 'asset', 'job', 'output',
    'attestation', 'usage', 'audit', 'provider_run'
  )),
  subject_id     text NOT NULL,
  -- CHI metadata phi nhay cam. Cam ghi byte media, API key, token, PII.
  detail         jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at    timestamptz NOT NULL
);
CREATE INDEX audit_events_workspace_idx ON audit_events (workspace_id, occurred_at DESC);

INSERT INTO schema_migrations (version) VALUES ('0001_phase1_init')
ON CONFLICT (version) DO NOTHING;

COMMIT;
