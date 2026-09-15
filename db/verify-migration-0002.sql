-- Kiem chung 0002 tren DB sach: rang buoc phai CHAN that su.
\set ON_ERROR_STOP on

-- Du lieu nen (dung lai bo cua 0001).
INSERT INTO users (id, email, display_name, created_at) VALUES ('usr_r', 'r@matbao.com', 'R', now());
INSERT INTO workspaces (id, name, owner_user_id, created_at) VALUES ('wsp_r', 'W', 'usr_r', now());
INSERT INTO projects (id, workspace_id, name, created_by_user_id, created_at) VALUES ('prj_r', 'wsp_r', 'P', 'usr_r', now());
INSERT INTO assets (id, workspace_id, project_id, media_type, source_file_id, created_at) VALUES ('ast_r', 'wsp_r', 'prj_r', 'image', 'src_r', now());
INSERT INTO source_files (id, workspace_id, asset_id, storage_key, original_filename, declared_mime_type,
  declared_byte_size, upload_state, mime_type, byte_size, checksum_sha256, created_at, uploaded_at)
VALUES ('src_r', 'wsp_r', 'ast_r', 'k_r', 'a.png', 'image/png', 10, 'stored', 'image/png', 10, 'h', now(), now());
INSERT INTO processing_jobs (id, workspace_id, project_id, asset_id, source_file_id, media_type, state,
  operations, idempotency_key, created_at, updated_at)
VALUES ('job_r', 'wsp_r', 'prj_r', 'ast_r', 'src_r', 'image', 'queued', ARRAY['blur'], 'k', now(), now());

-- 1) Cot moi ton tai va co gia tri mac dinh hop le.
DO $$
DECLARE s text;
BEGIN
  SELECT retention_state INTO s FROM source_files WHERE id = 'src_r';
  IF s <> 'active' THEN RAISE EXCEPTION 'FAIL: retention_state mac dinh sai: %', s; END IF;
  RAISE NOTICE 'OK 1: retention_state mac dinh = active';
END $$;

-- 2) reserve co han: hop le.
INSERT INTO usage_ledger_entries (id, workspace_id, job_id, unit_type, quantity, entry_type, idempotency_key, recorded_at, expires_at)
VALUES ('usg_r1', 'wsp_r', 'job_r', 'image_unit', 1, 'reserve', 'job_r:reserve', now(), now() + interval '30 minutes');

-- 3) but toan KHONG phai reserve ma co han => bi chan.
DO $$ BEGIN
  BEGIN
    INSERT INTO usage_ledger_entries (id, workspace_id, job_id, unit_type, quantity, entry_type, idempotency_key, recorded_at, expires_at)
    VALUES ('usg_bad', 'wsp_r', 'job_r', 'image_unit', 1, 'release', 'job_r:bad', now(), now());
    RAISE EXCEPTION 'FAIL: release ma co expires_at van qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 2: chan expires_at tren but toan khong phai reserve';
  END;
END $$;

-- 4) ly do hoan tra la 'expired' => hop le (moi o P1.1).
INSERT INTO usage_ledger_entries (id, workspace_id, job_id, unit_type, quantity, entry_type, reason_code, idempotency_key, recorded_at)
VALUES ('usg_r2', 'wsp_r', 'job_r', 'image_unit', 1, 'release', 'expired', 'job_r:release', now());

-- 5) ly do hoan tra la khong ro => bi chan.
DO $$ BEGIN
  BEGIN
    INSERT INTO usage_ledger_entries (id, workspace_id, job_id, unit_type, quantity, entry_type, reason_code, idempotency_key, recorded_at)
    VALUES ('usg_r3', 'wsp_r', 'job_r', 'image_unit', 1, 'commit', 'ly_do_bia', 'job_r:commit', now());
    RAISE EXCEPTION 'FAIL: reason_code la khong qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 3: chan reason_code khong nam trong danh sach';
  END;
END $$;

-- 6) retention_state la khong ton tai => bi chan.
DO $$ BEGIN
  BEGIN
    UPDATE source_files SET retention_state = 'xoa_het' WHERE id = 'src_r';
    RAISE EXCEPTION 'FAIL: retention_state bia van qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 4: chan retention_state khong hop le';
  END;
END $$;

-- 7) 'legal_hold' ma khong co moc thoi gian => bi chan.
DO $$ BEGIN
  BEGIN
    UPDATE source_files SET retention_state = 'legal_hold' WHERE id = 'src_r';
    RAISE EXCEPTION 'FAIL: legal_hold khong co moc van qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 5: chan legal_hold thieu moc thoi gian';
  END;
END $$;

-- 8) legal_hold kem moc => hop le.
UPDATE source_files SET retention_state = 'legal_hold', legal_hold_at = now() WHERE id = 'src_r';

SELECT 'migrations=' || string_agg(version, ',' ORDER BY version) FROM schema_migrations;
