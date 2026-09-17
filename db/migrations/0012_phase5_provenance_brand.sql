-- 0012_phase5_provenance_brand
--
-- Phase 5 (`P5-MCP-51`, `P5-MCP-52`, `P5-MCP-53`, `P5-MCP-54`).
--
-- CHI THEM. Khong xoa bang nao, khong doi kieu cot nao, khong dung toi lich su migration.
-- Khong bang nao o day co duong UPDATE hay DELETE trong ma — tat ca deu APPEND-ONLY.

BEGIN;

-- ---------------------------------------------------------------- P5-MCP-51
--
-- Anh chup metadata TRUOC va SAU mot luot xu ly.
--
-- Vi sao mot dong moi anh chup chu khong phai mot cot tren bien nhan: `before` phai KHONG BAO GIO
-- bi sua sau khi ghi. De chung mot dong voi `after` thi mot lenh UPDATE se dong vao ca hai, va ban
-- goc — thu duy nhat cho phep doi chieu — bien mat.
--
-- `readable` tach rieng khoi `fields`: mot anh chup RONG ("da doc, khong co truong nao") khac han
-- mot phep do THAT BAI ("khong biet gi ca"). Gop hai cai la lap lai loi `D-044`.
CREATE TABLE job_metadata_snapshots (
  id            text PRIMARY KEY,
  job_id        text NOT NULL REFERENCES processing_jobs (id),
  workspace_id  text NOT NULL REFERENCES workspaces (id),
  phase         text NOT NULL CHECK (phase IN ('before', 'after')),
  readable      boolean NOT NULL,
  fields        jsonb NOT NULL DEFAULT '[]'::jsonb,
  detector_id   text NOT NULL,
  recorded_at   timestamptz NOT NULL
);

CREATE UNIQUE INDEX job_metadata_snapshots_job_phase_idx
  ON job_metadata_snapshots (job_id, phase);

-- ---------------------------------------------------------------- P5-MCP-52 + 54
--
-- Bien nhan mang them ket luan metadata, cong bo AI va bo nhan dien da ap dung.
--
-- `NULL` o moi cot duoi day nghia la "khong do duoc / khong ap dung", KHONG phai mot gia tri mac
-- dinh am tham. Dong bien nhan ghi truoc Phase 5 giu `NULL` va do la su that ve chung.
ALTER TABLE processing_receipts
  ADD COLUMN metadata_verdict text CHECK (
    metadata_verdict IS NULL OR metadata_verdict IN ('preserved', 'partially_preserved', 'changed', 'unknown')
  ),
  ADD COLUMN metadata_evidence text CHECK (
    metadata_evidence IS NULL OR metadata_evidence IN ('verified', 'partially_verified', 'unknown', 'unconfirmed', 'blocked')
  ),
  ADD COLUMN metadata_stripped_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN disclosure_state text CHECK (
    disclosure_state IS NULL OR disclosure_state IN (
      'ai_used', 'ai_not_used', 'ai_status_unknown', 'ai_detection_only', 'provider_unknown', 'provider_blocked'
    )
  ),
  ADD COLUMN disclosure_limitation_key text,
  -- Bo nhan dien DA AP DUNG. Phai ghi CA phien ban: sua bo nhan dien khong duoc lam doi ho so
  -- cua mot ban xuat da phat hanh.
  ADD COLUMN brand_kit_id text,
  ADD COLUMN brand_kit_version integer,
  ADD COLUMN schema_version integer NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------- P5-MCP-53
--
-- Bo nhan dien thuong hieu, pham vi WORKSPACE.
--
-- `state` chi co 'active'/'archived' — KHONG co 'deleted'. Phase 5 khong mo duong xoa nao;
-- bo khong dung nua thi luu tru lai, ban ghi o lai lam bia mo.
CREATE TABLE brand_kits (
  id             text PRIMARY KEY,
  workspace_id   text NOT NULL REFERENCES workspaces (id),
  state          text NOT NULL CHECK (state IN ('active', 'archived')),
  -- Phien ban dang hieu luc. Tro toi mot dong trong `brand_kit_versions`.
  current_version integer NOT NULL CHECK (current_version >= 1),
  created_at     timestamptz NOT NULL,
  updated_at     timestamptz NOT NULL,
  created_by_user_id text REFERENCES users (id)
);

CREATE INDEX brand_kits_workspace_idx ON brand_kits (workspace_id, created_at DESC);

-- Phien ban: BAT BIEN. Sua mot bo nhan dien = ghi them mot dong o day, khong bao gio UPDATE.
CREATE TABLE brand_kit_versions (
  brand_kit_id   text NOT NULL REFERENCES brand_kits (id),
  workspace_id   text NOT NULL REFERENCES workspaces (id),
  version        integer NOT NULL CHECK (version >= 1),
  name           text NOT NULL CHECK (length(trim(name)) > 0),
  colors         text[] NOT NULL DEFAULT '{}',
  -- Tep logo nam trong kho doi tuong qua dung tang truu tuong san co, khong co duong rieng.
  logo_asset_id  text,
  overlay_position text NOT NULL CHECK (
    overlay_position IN ('top_left', 'top_right', 'bottom_left', 'bottom_right')
  ),
  overlay_opacity  double precision NOT NULL CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1),
  -- Lop phu cong bo AI MAC DINH TAT: `P5-MCP-54` la opt-in.
  overlay_include_disclosure boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL,
  created_by_user_id text REFERENCES users (id),
  PRIMARY KEY (brand_kit_id, version)
);

CREATE INDEX brand_kit_versions_workspace_idx ON brand_kit_versions (workspace_id, brand_kit_id, version DESC);

-- ---------------------------------------------------------------- nhat ky
--
-- Nhat ky ghi su kien ve bo nhan dien. Rang buoc phai noi rong ra, neu khong PostgreSQL tu choi
-- va viec ghi nhat ky se hong IM LANG o mot so duong goi — dung kieu loi `D-066`.
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_events_subject_type_check;

ALTER TABLE audit_events
  ADD CONSTRAINT audit_events_subject_type_check CHECK (subject_type IN (
    'workspace', 'project', 'membership', 'asset', 'job', 'output',
    'attestation', 'usage', 'audit', 'provider_run',
    'source_file', 'upload_session',
    -- Moi tu Phase 5:
    'brand_kit'
  ));

COMMIT;
