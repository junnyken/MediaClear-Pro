-- 0004_phase2_password_auth_sessions
--
-- P2-MCP-25 (owner decision Q-14): xac thuc that + PHIEN LUU TRONG DATABASE.
--
-- Vi sao can: o P2-MCP-23, du lieu da ben vung nhung PHIEN DANG NHAP van mat moi lan khoi
-- dong lai, vi DevIdentityProvider giu phien trong mot mang bo nho. Khong co bang `sessions`
-- nao ton tai. Day la thu va cho do.
--
-- CHI THEM. Khong xoa cot, khong doi kieu, khong dung du lieu cu.

BEGIN;

-- Nguoi dung cu (tao boi DevIdentityProvider) KHONG co mat khau => cot nay nullable.
-- Khong dat mat khau mac dinh cho ho: mot mat khau ai cung doan duoc con te hon la khong co.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS password_set_at timestamptz;

COMMENT ON COLUMN users.password_hash IS
  'P2-MCP-25: scrypt. Dinh dang "scrypt$<N>$<r>$<p>$<salt b64>$<hash b64>". NULL = tai khoan
   tao o thoi dev, chua dat mat khau, KHONG dang nhap bang mat khau duoc.';

CREATE TABLE IF NOT EXISTS sessions (
  id           text PRIMARY KEY,
  user_id      text NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  -- CHI luu hash cua token. Dump database khong lam lo token dung duoc.
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  -- Thu hoi la GHI MOC, khong xoa dong: con dau vet de audit.
  revoked_at   timestamptz,
  CONSTRAINT sessions_expires_after_created CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx  ON sessions (expires_at) WHERE revoked_at IS NULL;

COMMENT ON TABLE sessions IS
  'P2-MCP-25: phien dang nhap. Truoc day phien nam trong bo nho tien trinh nen mat khi restart.';

INSERT INTO schema_migrations (version) VALUES ('0004_phase2_password_auth_sessions')
ON CONFLICT (version) DO NOTHING;

COMMIT;
