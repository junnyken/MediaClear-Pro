-- 0008_phase3_video_proxy_and_receipt
--
-- P3-MCP-30 (ban proxy de xem truoc) va P3-MCP-31…34 (bien nhan video).
--
-- KHONG tao bang bien nhan thu hai. `processing_receipts` da la bang canonical tu P2-MCP-30;
-- Phase 3 THEM COT vao do. Tao ban sao se lam ra hai nguon su that cho cung mot khai niem — dung
-- thu ma `MINI_SPEC_INDEX` va `D-047` ton tai de chan.
--
-- CHI THEM. Khong xoa, khong doi kieu.

BEGIN;

CREATE TABLE IF NOT EXISTS video_proxies (
  id                text PRIMARY KEY,
  workspace_id      text NOT NULL REFERENCES workspaces (id),
  -- Quan he RO RANG toi asset goc. Proxy khong bao gio thay the no.
  asset_id          text NOT NULL REFERENCES assets (id),
  source_file_id    text NOT NULL REFERENCES source_files (id),
  storage_key       text NOT NULL UNIQUE,
  mime_type         text NOT NULL,
  byte_size         bigint NOT NULL CHECK (byte_size > 0),
  width_px          integer,
  height_px         integer,
  duration_seconds  double precision,
  -- DA DO va thay/khong thay. Khac han "chua do duoc" (D-044).
  has_audio         boolean NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Moi asset dung mot ban proxy. Tao lai = thay the ban cu o tang ung dung, khong sinh ban thu hai.
  CONSTRAINT video_proxies_one_per_asset UNIQUE (asset_id)
);

CREATE INDEX IF NOT EXISTS video_proxies_workspace_idx ON video_proxies (workspace_id, created_at DESC);

COMMENT ON TABLE video_proxies IS
  'P3-MCP-30: ban do phan giai thap de xem truoc. KHONG thay the tep goc (I-1).';

-- Bien nhan: them cac truong Phase 3 doi hoi. Tat ca NULLABLE vi bien nhan cua Phase 2 (anh)
-- khong co chung — them cot NOT NULL se lam hong cac dong da ton tai.
ALTER TABLE processing_receipts
  ADD COLUMN IF NOT EXISTS operation_mode   text,
  ADD COLUMN IF NOT EXISTS preset_id        text,
  ADD COLUMN IF NOT EXISTS input_checksum   text,
  ADD COLUMN IF NOT EXISTS output_checksum  text,
  ADD COLUMN IF NOT EXISTS audio_before     jsonb,
  ADD COLUMN IF NOT EXISTS audio_after      jsonb,
  ADD COLUMN IF NOT EXISTS audio_verdict    text,
  ADD COLUMN IF NOT EXISTS output_verified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failure_reason   text,
  ADD COLUMN IF NOT EXISTS review_reason    text;

COMMENT ON COLUMN processing_receipts.output_verified IS
  'I-2: chi true SAU KHI doc lai byte da ghi va do lai. Mac dinh false.';
COMMENT ON COLUMN processing_receipts.audio_verdict IS
  'P3-MCP-33: preserved | absent_by_design | lost | duration_drift | changed_by_preset | unknown.
   `lost` va `duration_drift` KHONG cho phep job di toi completed.';

INSERT INTO schema_migrations (version) VALUES ('0008_phase3_video_proxy_and_receipt')
ON CONFLICT (version) DO NOTHING;

COMMIT;
