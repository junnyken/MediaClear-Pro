-- 0005_phase2_output_assets
--
-- P2-MCP-27 (owner decision Q-06: lam thao tac TAT DINH truoc, chua chon provider AI).
--
-- Vi sao can: `processing_jobs` co rang buoc
--   CHECK (state <> 'completed' OR output_asset_id IS NOT NULL)
-- nen KHONG job nao toi duoc `completed` chung nao chua co cho luu ket qua. Tu truoc toi gio
-- moi job deu dung o `queued` - mot phan vi chua co provider, mot phan vi chua co bang nay.
--
-- CHI THEM. Khong xoa, khong doi kieu.

BEGIN;

CREATE TABLE IF NOT EXISTS output_assets (
  id               text PRIMARY KEY,
  workspace_id     text NOT NULL REFERENCES workspaces (id),
  job_id           text NOT NULL REFERENCES processing_jobs (id),
  -- Bat bien I-1: ket qua LUON tro ve nguon. Khong nullable - mot ban ket qua khong co
  -- nguon goc thi khong chung minh duoc no la ban moi chu khong phai ban thay the.
  source_asset_id  text NOT NULL REFERENCES assets (id),
  storage_key      text NOT NULL UNIQUE,
  mime_type        text NOT NULL,
  byte_size        bigint NOT NULL CHECK (byte_size > 0),
  checksum_sha256  text NOT NULL,
  -- Bat bien I-2: chi true SAU KHI do lai ket qua that su. Mac dinh false.
  validated        boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Moi job sinh ra dung mot ket qua. Chay lai job => job MOI (D-005).
  CONSTRAINT output_assets_one_per_job UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS output_assets_workspace_idx ON output_assets (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS output_assets_source_idx    ON output_assets (source_asset_id);

COMMENT ON TABLE output_assets IS
  'P2-MCP-27: ban ket qua. LUON la ban moi, khong bao gio ghi de tep goc (bat bien I-1).';
COMMENT ON COLUMN output_assets.validated IS
  'Bat bien I-2: chi true sau khi doc lai byte va do that. Job chi duoc `completed` khi cot nay true.';

-- Vung xu ly do nguoi dung chon. Truoc day duoc KIEM roi VUT DI: `ProcessingJobRequest` khong
-- co cho luu, nen lua chon cua nguoi dung bien mat trong im lang va worker khong biet che o dau.
ALTER TABLE processing_jobs
  ADD COLUMN IF NOT EXISTS regions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN processing_jobs.regions IS
  'P2-MCP-27: toa do CHUAN HOA 0..1 nen doc lap do phan giai. Rong = ap dung toan anh.';

INSERT INTO schema_migrations (version) VALUES ('0005_phase2_output_assets')
ON CONFLICT (version) DO NOTHING;

COMMIT;
