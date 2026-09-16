/**
 * P2-MCP-26: doc chuoi ket noi co so du lieu.
 *
 * Nen tang trien khai (Vibe Host, va hau het nen tang khac) TU TIEM `DATABASE_URL` khi gan mot
 * co so du lieu vao ung dung, va KHONG cho doc lai gia tri do qua API quan tri. Neu he thong chi
 * doc ten rieng cua minh thi khong co cach nao noi hai thu lai voi nhau.
 */
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

const BASE = { MEDIACLEAR_UPLOAD_SECRET: 'x'.repeat(32) } as NodeJS.ProcessEnv;

describe('P2-MCP-26 — chuoi ket noi co so du lieu', () => {
  it('khong co bien nao => null, chay in-memory nhu cu', () => {
    expect(loadConfig({ ...BASE }).databaseUrl).toBeNull();
  });

  it('doc duoc ten rieng cua he thong', () => {
    const c = loadConfig({ ...BASE, MEDIACLEAR_DATABASE_URL: 'postgresql://a/b' });
    expect(c.databaseUrl).toBe('postgresql://a/b');
  });

  it('doc duoc DATABASE_URL do nen tang tu tiem', () => {
    const c = loadConfig({ ...BASE, DATABASE_URL: 'postgresql://nen-tang/c' });
    expect(c.databaseUrl).toBe('postgresql://nen-tang/c');
  });

  it('co ca hai thi ten RIENG thang - nguoi van hanh dat tay phai de len tu dong', () => {
    const c = loadConfig({
      ...BASE,
      MEDIACLEAR_DATABASE_URL: 'postgresql://dat-tay/x',
      DATABASE_URL: 'postgresql://nen-tang/c',
    });
    expect(c.databaseUrl).toBe('postgresql://dat-tay/x');
  });

  it('chuoi RONG bi coi nhu khong dat - khong tao ket noi toi hu khong', () => {
    expect(loadConfig({ ...BASE, MEDIACLEAR_DATABASE_URL: '', DATABASE_URL: '' }).databaseUrl).toBeNull();
  });
});
