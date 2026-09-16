/**
 * Chan lo hong D-047 mo lai.
 *
 * `D-051` dong lo hong cho cac endpoint Phase 3; `D-058` dong not phan con lai. Nhung "da sua mot
 * lan" khong giu duoc gi — chi can mot nguoi viet `apiFetch<T>(...)` moi la lo hong tro lai, va
 * `tsc` VAN XANH vi do chi la mot loi khang dinh kieu.
 *
 * Test nay la thu giu cho dieu do khong xay ra: no quet ma nguon giao dien va doi MOI loi goi doc
 * du lieu tu may chu deu di qua `apiFetchChecked`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(import.meta.dirname, '../app');
/** Tep dinh nghia chinh `apiFetch` — o day no duoc phep xuat hien. */
const HELPER = join(APP_DIR, '_lib/api.ts');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('Bien du lieu may chu -> giao dien (D-047 / D-058)', () => {
  const files = sourceFiles(APP_DIR).filter((f) => f !== HELPER);

  it('co du tep de quet', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('KHONG man hinh nao con doc phan hoi bang `apiFetch<T>` chua kiem', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      // `apiFetch<...>` la dang KHANG DINH kieu - khong ai kiem. Day la thu phai bien mat.
      for (const m of text.matchAll(/apiFetch<[^>]*>\s*\(/g)) {
        offenders.push(`${file.replace(APP_DIR, 'app')} :: ${m[0]}`);
      }
    }
    expect(offenders, 'con loi goi khang dinh kieu ma khong kiem luc chay').toEqual([]);
  });

  it('MOI loi goi `apiFetchChecked` deu truyen mot lich kiem', () => {
    /*
     * Phai QUET CAN BANG NGOAC, khong duoc dung mot bieu thuc chinh quy "toi dau phay dau tien".
     * Lan dau toi viet `/apiFetchChecked\(([\s\S]{0,200}?)\)/` va no bao DUONG TINH GIA ngay:
     * loi goi co `encodeURIComponent(...)` long ben trong lam bieu thuc dung o ngoac dong cua ham
     * long, nen phan chua lich kiem bi cat mat. Mot phep chan bao sai thi chang bao lau se bi bo qua.
     */
    const bad: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      let from = 0;
      for (;;) {
        const at = text.indexOf('apiFetchChecked(', from);
        if (at === -1) break;
        let depth = 1;
        let i = at + 'apiFetchChecked('.length;
        while (i < text.length && depth > 0) {
          const c = text[i];
          if (c === '(' || c === '[' || c === '{') depth += 1;
          else if (c === ')' || c === ']' || c === '}') depth -= 1;
          i += 1;
        }
        const args = text.slice(at + 'apiFetchChecked('.length, i - 1);
        if (!/[A-Z][A-Z0-9_]*_SCHEMA/.test(args)) {
          bad.push(`${file.replace(APP_DIR, 'app')} :: ${args.slice(0, 60)}`);
        }
        from = i;
      }
    }
    expect(bad, 'goi apiFetchChecked ma khong dua lich kiem nao').toEqual([]);
  });

  it('lich kiem den tu `@mediaclear/contracts`, khong tu khai tai cho', () => {
    const local: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (!/[A-Z][A-Z0-9_]*_SCHEMA/.test(text)) continue;
      // Khai mot `const ..._SCHEMA` ngay trong man hinh = lai tao nguon su that thu hai.
      if (/(const|let)\s+[A-Z][A-Z0-9_]*_SCHEMA\s*=/.test(text)) {
        local.push(file.replace(APP_DIR, 'app'));
      }
    }
    expect(local, 'lich kiem tu khai tai man hinh - lai hai nguon su that').toEqual([]);
  });
});
