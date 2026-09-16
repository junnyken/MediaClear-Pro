-- 0006_phase2_provenance_receipts
--
-- P2-MCP-30. Truoc muc nay `ProcessingReceipt` la BAT KHA THI ve mat cau truc: no bat buoc co
-- `provenanceBeforeId` (khong nhan null), ma trong repo KHONG co bang provenance nao va khong
-- cho nao ghi provenance ca. Dung dang loi ma `output_assets` tung mac truoc P2-MCP-27.
--
-- CHI THEM. Khong xoa, khong doi kieu.

BEGIN;

CREATE TABLE IF NOT EXISTS provenance_records (
  id                          text PRIMARY KEY,
  workspace_id                text NOT NULL REFERENCES workspaces (id),
  -- 'present' | 'absent' | 'unknown'. 'unknown' KHAC 'absent': mot ben la "da tim va khong
  -- thay", ben kia la "chua tung tim duoc". Gop hai cai nay chinh la loi D-044.
  original_metadata_presence  text NOT NULL CHECK (original_metadata_presence IN ('present', 'absent', 'unknown')),
  ai_provenance_presence      text NOT NULL CHECK (ai_provenance_presence IN ('present', 'absent', 'unknown')),
  preservation_requested      boolean NOT NULL,
  preservation_attempted      boolean NOT NULL,
  preservation_result         text NOT NULL,
  -- Gioi han THAT cua bo do, vd "chua co bo doc C2PA". Null chi khi khong con gioi han nao.
  limitation_note             text,
  evidence_status             text NOT NULL,
  recorded_at                 timestamptz NOT NULL DEFAULT now(),
  -- D-044 o tang du lieu: khong do duoc thi KHONG duoc dong dau da kiem chung.
  CONSTRAINT provenance_unknown_never_verified CHECK (
    evidence_status <> 'verified'
    OR (original_metadata_presence <> 'unknown' AND ai_provenance_presence <> 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS provenance_records_workspace_idx ON provenance_records (workspace_id, recorded_at DESC);

COMMENT ON TABLE provenance_records IS
  'P2-MCP-30: ket qua DO THAT tren byte, truoc va sau khi xu ly. Khong phai loi khai cua client.';
COMMENT ON CONSTRAINT provenance_unknown_never_verified ON provenance_records IS
  'D-044: mot phep do chua chay khong bao gio duoc thanh bang chung da kiem chung.';

CREATE TABLE IF NOT EXISTS processing_receipts (
  id                                  text PRIMARY KEY,
  workspace_id                        text NOT NULL REFERENCES workspaces (id),
  job_id                              text NOT NULL REFERENCES processing_jobs (id),
  source_asset_id                     text NOT NULL REFERENCES assets (id),
  output_asset_id                     text REFERENCES output_assets (id),
  operations                          jsonb NOT NULL,
  provider_run_ids                    jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Bat buoc: mot bien nhan khong co so do TRUOC thi khong so sanh duoc gi, tuc la khong
  -- chung minh duoc dieu gi.
  provenance_before_id                text NOT NULL REFERENCES provenance_records (id),
  provenance_after_id                 text REFERENCES provenance_records (id),
  invisible_watermark_disclaimer_key  text NOT NULL,
  evidence_status                     text NOT NULL,
  created_at                          timestamptz NOT NULL DEFAULT now(),
  -- Moi job dung mot bien nhan. Chay lai = job MOI (D-005).
  CONSTRAINT processing_receipts_one_per_job UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS processing_receipts_workspace_idx ON processing_receipts (workspace_id, created_at DESC);

COMMENT ON TABLE processing_receipts IS
  'P2-MCP-30: bien nhan mot luot xu ly - da lam gi, tren tep nao, va do duoc nhung gi.';

INSERT INTO schema_migrations (version) VALUES ('0006_phase2_provenance_receipts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
