-- 0011_p4_correction_neighbours
--
-- `D-074` / `Q-P4-05`: ho so mot lan sua keyframe phai du de DUNG LAI, khong chi du de biet.
--
-- Truoc day bang chi giu `reinterpolated integer[]` — mot danh sach chi so. Biet "frame 3 bi tinh
-- lai" ma khong biet no tu gia tri nao thanh gia tri nao thi khong doi chieu duoc quyet dinh nao.
-- Te hon nua: duong API luon ghi `[]` du no khong he tinh gi, nen chinh o do cung dang noi doi.
--
-- Cac cot moi tra loi ba cau: lan can doi tu gi sang gi · so doan nhay truoc/sau · cong chan noi gi
-- truoc/sau. Ba cau do la thu bien mot dong log thanh mot bang chung.
--
-- CHI THEM COT. Khong xoa dong nao, khong doi kieu cot nao, khong dung toi bang khac.
-- Bang nay van la APPEND-ONLY: khong co duong UPDATE hay DELETE nao trong toan bo ma.

BEGIN;

ALTER TABLE job_frame_corrections
  -- Mang cac frame lan can, moi phan tu giu CA hai ve (truoc va sau).
  ADD COLUMN neighbours jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- So doan mask nhay bat thuong, do ngay truoc va ngay sau lan sua. NULL = khong do duoc.
  ADD COLUMN flicker_before integer,
  ADD COLUMN flicker_after integer,
  -- Ket qua cong chan chat luong truoc/sau. NULL = khong do duoc, KHAC han 'failed'.
  ADD COLUMN gate_verdict_before text CHECK (
    gate_verdict_before IS NULL OR gate_verdict_before IN ('completed', 'review_required', 'failed')
  ),
  ADD COLUMN gate_verdict_after text CHECK (
    gate_verdict_after IS NULL OR gate_verdict_after IN ('completed', 'review_required', 'failed')
  );

-- Dong cu (ghi truoc `D-074`) giu `neighbours = '[]'` va bon cot con lai NULL.
-- `NULL` o day nghia la "khong do luc do", KHONG phai "bang khong" — dung quy uoc `D-044`.

COMMIT;
