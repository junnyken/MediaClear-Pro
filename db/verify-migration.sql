-- Kiem chung migration tren database SACH: rang buoc phai CHAN that su, khong chi ton tai tren giay.
\set ON_ERROR_STOP on

INSERT INTO users (id, email, display_name, created_at) VALUES
  ('usr_a', 'a@matbao.com', 'A', now()), ('usr_b', 'b@matbao.com', 'B', now());
INSERT INTO workspaces (id, name, owner_user_id, created_at) VALUES
  ('wsp_a', 'Cua A', 'usr_a', now()), ('wsp_b', 'Cua B', 'usr_b', now());
INSERT INTO projects (id, workspace_id, name, created_by_user_id, created_at) VALUES
  ('prj_a', 'wsp_a', 'Du an A', 'usr_a', now());
INSERT INTO assets (id, workspace_id, project_id, media_type, source_file_id, created_at) VALUES
  ('ast_a', 'wsp_a', 'prj_a', 'image', 'src_a', now());
INSERT INTO source_files (id, workspace_id, asset_id, storage_key, original_filename, declared_mime_type,
  declared_byte_size, upload_state, mime_type, byte_size, checksum_sha256, created_at, uploaded_at)
VALUES ('src_a', 'wsp_a', 'ast_a', 'workspaces/wsp_a/projects/prj_a/assets/ast_a/source/src_a.png',
  'anh.png', 'image/png', 139, 'stored', 'image/png', 139, 'abc', now(), now());
INSERT INTO processing_jobs (id, workspace_id, project_id, asset_id, source_file_id, media_type, state,
  operations, idempotency_key, created_at, updated_at)
VALUES ('job_a', 'wsp_a', 'prj_a', 'ast_a', 'src_a', 'image', 'queued', ARRAY['blur'], 'k1', now(), now());
INSERT INTO usage_ledger_entries (id, workspace_id, job_id, unit_type, quantity, entry_type, idempotency_key, recorded_at)
VALUES ('usg_a', 'wsp_a', 'job_a', 'image_unit', 1, 'reserve', 'job_a:reserve', now());

-- 1) Asset khong the tro toi project cua workspace khac.
DO $$ BEGIN
  BEGIN
    INSERT INTO assets (id, workspace_id, project_id, media_type, source_file_id, created_at)
    VALUES ('ast_cheo', 'wsp_b', 'prj_a', 'image', 'src_x', now());
    RAISE EXCEPTION 'FAIL: asset tro cheo workspace ma khong bi chan';
  EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'OK 1: chan asset tro cheo workspace';
  END;
END $$;

-- 2) 'completed' ma khong co output bi chan (I-2).
DO $$ BEGIN
  BEGIN
    UPDATE processing_jobs SET state = 'completed' WHERE id = 'job_a';
    RAISE EXCEPTION 'FAIL: completed khong co output ma van qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 2: chan completed khi chua co output';
  END;
END $$;

-- 3) 'blocked' phai co ly do.
DO $$ BEGIN
  BEGIN
    UPDATE processing_jobs SET state = 'blocked' WHERE id = 'job_a';
    RAISE EXCEPTION 'FAIL: blocked khong co reason ma van qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 3: chan blocked khong co ly do';
  END;
END $$;

-- 4) Khong the reserve hai lan cho cung mot job (chan double-charge).
DO $$ BEGIN
  BEGIN
    INSERT INTO usage_ledger_entries (id, workspace_id, job_id, unit_type, quantity, entry_type, idempotency_key, recorded_at)
    VALUES ('usg_b', 'wsp_a', 'job_a', 'image_unit', 1, 'reserve', 'khoa-khac', now());
    RAISE EXCEPTION 'FAIL: reserve hai lan ma van qua';
  EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'OK 4: chan reserve trung cho cung job';
  END;
END $$;

-- 5) source_files 'stored' ma thieu so do that bi chan.
DO $$ BEGIN
  BEGIN
    INSERT INTO source_files (id, workspace_id, asset_id, storage_key, original_filename, declared_mime_type,
      declared_byte_size, upload_state, created_at)
    VALUES ('src_thieu', 'wsp_a', 'ast_a', 'k2', 'x.png', 'image/png', 10, 'stored', now());
    RAISE EXCEPTION 'FAIL: stored ma khong co so do van qua';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 5: chan stored khi chua co so do that';
  END;
END $$;

-- 6) preserve_original_metadata khong the tat (I-9).
DO $$ BEGIN
  BEGIN
    UPDATE processing_jobs SET preserve_original_metadata = false WHERE id = 'job_a';
    RAISE EXCEPTION 'FAIL: tat duoc preserve metadata';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'OK 6: khong tat duoc preserve metadata';
  END;
END $$;

SELECT 'tables=' || count(*)::text FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
