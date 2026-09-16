-- 0007_phase2_resumable_upload
--
-- P2-MCP-35. Truoc muc nay mot luot tai len la MOT request PUT duy nhat: mat ket noi giua chung
-- la mat toan bo, va voi tran 199 MB tren duong truyen keu thi do la chuyen xay ra thuong xuyen.
--
-- CHI THEM. Khong xoa, khong doi kieu.

BEGIN;

CREATE TABLE IF NOT EXISTS upload_sessions (
  id                   text PRIMARY KEY,
  workspace_id         text NOT NULL REFERENCES workspaces (id),
  project_id           text NOT NULL REFERENCES projects (id),
  asset_id             text NOT NULL REFERENCES assets (id),
  source_file_id       text NOT NULL REFERENCES source_files (id),
  -- Khoa CUOI CUNG cua tep nguon. Manh khong ghi vao day; chi ban da ghep moi ghi.
  storage_key          text NOT NULL,
  content_type         text NOT NULL,
  declared_byte_size   bigint NOT NULL CHECK (declared_byte_size > 0),
  chunk_size_bytes     integer NOT NULL CHECK (chunk_size_bytes > 0),
  total_chunks         integer NOT NULL CHECK (total_chunks > 0),
  -- Danh sach chi so manh DA nhan. Day la thu duy nhat cho phep "tai tiep tu cho dut".
  received_chunks      jsonb NOT NULL DEFAULT '[]'::jsonb,
  state                text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'completed', 'aborted')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- Phien bo do giua chung khong duoc giu manh mai mai.
  expires_at           timestamptz NOT NULL,
  -- Moi tep nguon dung mot phien: khong the mo hai phien cung ghi vao mot khoa.
  CONSTRAINT upload_sessions_one_per_source UNIQUE (source_file_id)
);

CREATE INDEX IF NOT EXISTS upload_sessions_workspace_idx ON upload_sessions (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upload_sessions_expiry_idx ON upload_sessions (expires_at) WHERE state = 'open';

COMMENT ON TABLE upload_sessions IS
  'P2-MCP-35: luot tai len nhieu manh, noi lai duoc sau khi mat ket noi.';
COMMENT ON COLUMN upload_sessions.received_chunks IS
  'Chi so cac manh DA nhan. Client hoi cot nay de biet tai tiep tu dau.';

INSERT INTO schema_migrations (version) VALUES ('0007_phase2_resumable_upload')
ON CONFLICT (version) DO NOTHING;

COMMIT;
