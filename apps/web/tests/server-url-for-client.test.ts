/**
 * `D-079` — moi duong do MAY CHU TRA VE phai duoc keo ve dung goc truoc khi trinh duyet dung.
 *
 * BOI CANH THAT: nguoi dung chon mot tep de tai len, giao dien bao "Khong ket noi duoc may chu".
 * `apiBaseUrl()` da duoc sua tu truoc va moi loi goi API deu chay dung — rieng duong TAI LEN thi
 * khong, vi no khong di qua `apiBaseUrl()`: no la mot dia chi TUYET DOI do may chu tu dat ra
 * (`MEDIACLEAR_PUBLIC_BASE_URL` = `http://127.0.0.1:3301`).
 *
 * Bai hoc de ghim: sua mot duong khong dong nghia da sua ca LOP loi. Sau khi tim ra loi o duong
 * tai len, viec dung la di tim moi cho khac cung nhan URL tu may chu — tim duoc them BA cho, trong
 * do co nut "Tai tep ket qua", tuc la nguoi dung se gap lai dung loi nay o buoc cuoi cung.
 *
 * Vi vay bo kiem nay co HAI phan: phep kiem hanh vi cua ham, va mot phep QUET MA NGUON de lop loi
 * khong quay lai qua mot man hinh moi.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serverUrlForClient } from '../app/_lib/api';

const g = globalThis as { __MCP_API_BASE__?: string; __MCP_SAME_ORIGIN__?: boolean; window?: unknown };

/* Nhu `api-base-url.test.ts`: khong co `window` gia thi moi phep kiem duoi day chay nham duong lui. */
beforeEach(() => {
  g.window = globalThis;
});
afterEach(() => {
  delete g.__MCP_API_BASE__;
  delete g.__MCP_SAME_ORIGIN__;
  delete g.window;
});

describe('serverUrlForClient', () => {
  it('cung goc => bo host cua may chu, giu nguyen duong dan', () => {
    g.__MCP_SAME_ORIGIN__ = true;
    const r = serverUrlForClient('http://127.0.0.1:3301/v1/storage/upload/eyJidWNrZXQiOiJ4In0');
    expect(r).toBe('/v1/storage/upload/eyJidWNrZXQiOiJ4In0');
  });

  it('giu nguyen chuoi truy van — chu ky va han dung nam o do', () => {
    g.__MCP_SAME_ORIGIN__ = true;
    const r = serverUrlForClient('http://127.0.0.1:3301/v1/storage/download/abc?sig=zz&exp=12');
    expect(r).toBe('/v1/storage/download/abc?sig=zz&exp=12');
  });

  /**
   * Phep kiem GIU RANH GIOI. Khi he thong dung kho doi tuong that (S3/R2), may chu se tra mot
   * duong da ky tro toi MOT DICH VU KHAC. Viet lai duong do se lam hong that: trinh duyet se hoi
   * API cua chinh minh mot duong dan khong ton tai o do.
   */
  it('duong KHONG phai `/v1/` (kho doi tuong ngoai) => de nguyen, khong viet lai', () => {
    g.__MCP_SAME_ORIGIN__ = true;
    const s3 = 'https://buckets.example.com/mediaclear/abc.png?X-Amz-Signature=deadbeef';
    expect(serverUrlForClient(s3)).toBe(s3);
  });

  it('khong bat cung goc => ghep vao dia chi da nhung', () => {
    g.__MCP_SAME_ORIGIN__ = false;
    g.__MCP_API_BASE__ = 'https://api.mediaclear.example';
    expect(serverUrlForClient('http://127.0.0.1:3301/v1/storage/download/a')).toBe(
      'https://api.mediaclear.example/v1/storage/download/a',
    );
  });

  it('chuoi rac => tra nguyen ban chu khong nem loi', () => {
    g.__MCP_SAME_ORIGIN__ = true;
    expect(serverUrlForClient('::khong-phai-url::')).toBe('::khong-phai-url::');
  });
});

/* ------------------------------------------------------------------ */

function tsxFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsxFiles(p, acc);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) acc.push(p);
  }
  return acc;
}

describe('D-079 — quet ma nguon: khong con duong tuyet doi nao di thang toi trinh duyet', () => {
  const appDir = join(__dirname, '..', 'app');
  const files = tsxFiles(appDir).filter((f) => !f.endsWith(join('_lib', 'api.ts')));

  /*
   * Bat cu cho nao doc `.url` tu ket qua API roi dua thang cho trinh duyet (`fetch`, `window.open`,
   * `window.location.href`, thuoc tinh `src`) deu la mot ca cua lop loi nay.
   */
  const offenders: string[] = [];
  let scanned = 0;
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/\bdata\.url\b/.test(line)) return;
      scanned += 1;
      if (!line.includes('serverUrlForClient')) {
        offenders.push(`${file.slice(appDir.length + 1)}:${i + 1}: ${line.trim()}`);
      }
    });
  }

  /**
   * DOI CHUNG AM cho chinh phep quet.
   *
   * Mot bieu thuc khong khop gi se lam phep kiem duoi "xanh" ma khong canh gi ca. Neu ma nguon doi
   * cach dat ten (`data.url` -> mot ten khac) thi con so nay ve 0 va phep kiem nay do TRUOC, buoc
   * nguoi sua phai cap nhat lai phep quet thay vi im lang mat tac dung.
   */
  it('phep quet co thuc su cham toi ma nguon', () => {
    expect(files.length, 'khong tim thay tep nao trong app/').toBeGreaterThan(10);
    expect(scanned, 'khong thay cho nao dung `data.url` — phep quet da mat tac dung').toBeGreaterThanOrEqual(3);
  });

  it('moi `data.url` di toi trinh duyet deu qua `serverUrlForClient`', () => {
    expect(offenders, `con duong tuyet doi chua duoc keo ve dung goc:\n${offenders.join('\n')}`).toEqual([]);
  });
});
