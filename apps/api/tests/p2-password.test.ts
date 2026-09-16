/**
 * P2-MCP-25: bam mat khau.
 *
 * Day la lop chan duy nhat giua mot email va toan bo du lieu cua nguoi do, nen moi dang
 * hong deu phai tra FALSE - khong duoc nem loi roi de tang tren bat nham thanh "cho qua".
 */
import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN_LENGTH, hashPassword, passwordTooShort, verifyPassword } from '../src/auth/password.js';

describe('P2-MCP-25 — bam mat khau', () => {
  it('mat khau dung thi qua', async () => {
    const stored = await hashPassword('mat-khau-du-dai-1');
    expect(await verifyPassword('mat-khau-du-dai-1', stored)).toBe(true);
  });

  it('mat khau sai thi khong qua', async () => {
    const stored = await hashPassword('mat-khau-du-dai-1');
    expect(await verifyPassword('mat-khau-du-dai-2', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('KHONG luu mat khau thuong - chuoi bam khong chua mat khau', async () => {
    const stored = await hashPassword('ChuoiRatDacBiet-12345');
    expect(stored).not.toContain('ChuoiRatDacBiet');
    expect(stored.startsWith('scrypt$')).toBe(true);
  });

  it('hai lan bam cung mot mat khau ra hai chuoi KHAC nhau (co muoi)', async () => {
    const a = await hashPassword('mat-khau-du-dai-1');
    const b = await hashPassword('mat-khau-du-dai-1');
    expect(a).not.toBe(b);
    // Nhung ca hai deu phai kiem dung.
    expect(await verifyPassword('mat-khau-du-dai-1', a)).toBe(true);
    expect(await verifyPassword('mat-khau-du-dai-1', b)).toBe(true);
  });

  it('tai khoan CHUA dat mat khau thi khong dang nhap bang mat khau duoc', async () => {
    expect(await verifyPassword('bat-ky-thu-gi', null)).toBe(false);
    expect(await verifyPassword('', null)).toBe(false);
  });

  it('chuoi bam HONG tra false, KHONG nem loi', async () => {
    for (const hong of [
      '',
      'khong-phai-dinh-dang',
      'scrypt$abc$8$1$bbb$ccc',      // tham so khong phai so
      'scrypt$32768$8$1$$',           // muoi va hash rong
      'bcrypt$32768$8$1$AAAA$BBBB',   // thuat toan khac
      'scrypt$32768$8$1$AAAA',        // thieu doan
    ]) {
      await expect(verifyPassword('bat-ky', hong)).resolves.toBe(false);
    }
  });

  it('chan mat khau qua ngan', () => {
    expect(passwordTooShort('a'.repeat(PASSWORD_MIN_LENGTH - 1))).toBe(true);
    expect(passwordTooShort('a'.repeat(PASSWORD_MIN_LENGTH))).toBe(false);
  });
});
