/**
 * Bam mat khau (P2-MCP-25).
 *
 * Dung `scrypt` CO SAN trong Node, khong dung argon2.
 *
 * Ly do: argon2 manh hon ve ly thuyet, nhung moi ban hien thuc cho Node deu la NATIVE MODULE -
 * phai bien dich luc cai, va se lam hong build Docker tren nhung nen tang khong co toolchain C.
 * Mot ham bam tot ma CHAY DUOC o moi noi thi an toan hon mot ham bam tot hon ma build hong,
 * vi khi build hong nguoi ta se di tim duong tat.
 *
 * Tham so theo khuyen nghi cua Node cho scrypt tuong tac nguoi dung.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** `promisify` lam mat overload co tham so tuy chon cua scrypt, nen boc tay. */
function scryptAsync(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

/** N=2^15: nang hon mac dinh cua Node (2^14) nhung van duoi mot giay tren may thuong. */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
/** scrypt can bo nho ~ 128*N*r byte = 32 MB voi tham so tren. Phai noi ro cho Node. */
const MAX_MEM = 160 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 10;

/** Dinh dang: scrypt$N$r$p$<salt b64>$<hash b64> - tu mo ta, doi tham so sau van doc duoc ban cu. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAX_MEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * So sanh bang `timingSafeEqual`. Tra false cho moi dang hong thay vi nem loi:
 * chuoi bam hong khong duoc bien thanh duong dang nhap duoc.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4] as string, 'base64');
    expected = Buffer.from(parts[5] as string, 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, { N: n, r, p, maxmem: MAX_MEM });
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Yeu cau do dai toi thieu. Khong ep quy tac ky tu: do dai moi la thu thuc su co tac dung. */
export function passwordTooShort(password: string): boolean {
  return password.length < PASSWORD_MIN_LENGTH;
}
