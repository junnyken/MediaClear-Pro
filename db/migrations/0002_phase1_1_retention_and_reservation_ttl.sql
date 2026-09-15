-- MediaClear Pro - Phase 1.1 hardening (P1.1-MCP-17, P1.1-MCP-18).
--
-- AN TOAN DU LIEU:
--  * Migration nay CHI THEM cot va rang buoc. Khong DROP, khong DELETE, khong UPDATE
--    du lieu nguoi dung. Khong co cau lenh destructive nao.
--  * Cot moi deu NULL-able hoac co DEFAULT => ban ghi cu van hop le.
--
-- Trang thai: da chay thu tren PostgreSQL 16 SACH, sau 0001 (xem docs/TEST_LOG.md).

BEGIN;

-- ---------------------------------------------------------------- Q-17 ---
-- Han cua khoan giu muc dung. NULL = but toan cu, tao truoc khi co TTL.
ALTER TABLE usage_ledger_entries
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN usage_ledger_entries.expires_at IS
  'Han cua reservation (chi co nghia tren entry_type = reserve). NULL = but toan cu hoac khong phai reserve.';

-- Han chi co nghia tren but toan reserve.
ALTER TABLE usage_ledger_entries
  ADD CONSTRAINT usage_ledger_expires_only_on_reserve
  CHECK (expires_at IS NULL OR entry_type = 'reserve');

-- Ly do hoan tra: bo sung 'expired' (P1.1). Rang buoc nay truoc day khong ton tai.
ALTER TABLE usage_ledger_entries
  ADD CONSTRAINT usage_ledger_release_reason_known
  CHECK (
    reason_code IS NULL
    OR reason_code IN ('provider_error', 'user_error', 'validation_failed', 'cancelled', 'blocked', 'expired')
  );

CREATE INDEX IF NOT EXISTS usage_ledger_expiry_idx
  ON usage_ledger_entries (expires_at)
  WHERE entry_type = 'reserve';

-- ---------------------------------------------------------------- Q-18 ---
-- Luu giu du lieu. Moi cot mot vai tro, khong cot nao trung nghia cot cu.
ALTER TABLE source_files
  ADD COLUMN IF NOT EXISTS last_accessed_at        timestamptz,
  ADD COLUMN IF NOT EXISTS retention_state         text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS legal_hold_at           timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at   timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at              timestamptz,
  ADD COLUMN IF NOT EXISTS retention_policy_version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN source_files.last_accessed_at IS
  'Lan doc gan nhat. Luat 30 ngay tinh theo cot NAY, khong phai created_at.';

ALTER TABLE source_files
  ADD CONSTRAINT source_files_retention_state_known
  CHECK (retention_state IN ('active', 'scheduled_for_deletion', 'deleted', 'legal_hold'));

-- Trang thai phai di kem moc thoi gian tuong ung, neu khong thi trang thai vo nghia.
ALTER TABLE source_files
  ADD CONSTRAINT source_files_retention_state_has_timestamp
  CHECK (
    (retention_state <> 'scheduled_for_deletion' OR scheduled_deletion_at IS NOT NULL)
    AND (retention_state <> 'deleted' OR deleted_at IS NOT NULL)
    AND (retention_state <> 'legal_hold' OR legal_hold_at IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS source_files_retention_idx
  ON source_files (workspace_id, retention_state, last_accessed_at);

INSERT INTO schema_migrations (version) VALUES ('0002_phase1_1_retention_and_reservation_ttl')
ON CONFLICT (version) DO NOTHING;

COMMIT;
