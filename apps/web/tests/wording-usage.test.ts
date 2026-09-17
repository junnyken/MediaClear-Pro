/**
 * P1.1-MCP-19: man hinh phai dung dung bo khoa dang hieu luc.
 * Chan loi "doi cau chu nhung UI van goi khoa cu".
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(import.meta.dirname, '../app');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const SOURCES = tsxFiles(APP_DIR).map((file) => ({ file: file.replace(APP_DIR, 'app'), text: readFileSync(file, 'utf8') }));

describe('UI dung bo khoa dang hieu luc', () => {
  it('hop thoai xac nhan quyen chi dung khoa v2, khong con goi khoa v1', () => {
    const offenders = SOURCES.filter((s) => s.text.includes('rights.attestation.v1.')).map((s) => s.file);
    expect(offenders, 'con goi khoa v1 da bi thay the').toEqual([]);
  });

  it('hop thoai hien du bon thong diep bat buoc', () => {
    const dialog = SOURCES.find((s) => s.file.includes('RightsDialog'));
    expect(dialog).toBeDefined();
    for (const key of [
      'rights.attestation.v2.ownership_note',
      'rights.attestation.v2.declaration_note',
      'rights.attestation.v2.statement',
      'provenance.invisible_identity_disclaimer',
    ]) {
      expect(dialog?.text, `thieu ${key}`).toContain(key);
    }
  });

  it('khong man hinh nao go thang cau chu chinh sach vao JSX', () => {
    const offenders = SOURCES.filter((s) => /MediaClear Pro (chỉ|không)/.test(s.text)).map((s) => s.file);
    expect(offenders, 'cau chinh sach phai di qua translation key').toEqual([]);
  });

  /*
   * Chu VIET THANG vao JSX di vong qua MOI phep chan cau chu.
   *
   * Phep chan thuat ngu cua `D-059` soi GIA TRI trong tu dien i18n. Nhung `label="MIME"` va
   * `label="SHA-256"` khong bao gio di qua tu dien — chung nam thang trong `.tsx`. Tu dien co
   * dung 0 khoa chua hai tu do, nen phep chan VAN XANH trong khi ca hai hien ro ra man hinh
   * nguoi dung. Bam tay moi thay (`D-064`).
   *
   * Cung ly do do, chuoi viet thang khong bao gio dich duoc sang `en`.
   */
  it('khong man hinh nao viet thang nhan hien thi vao JSX', () => {
    const offenders: string[] = [];
    for (const s of SOURCES) {
      for (const m of s.text.matchAll(/\blabel="([^"]*)"/g)) {
        offenders.push(`${s.file}: label="${m[1]}"`);
      }
    }
    expect(
      offenders,
      'nhan hien thi phai di qua translate() — viet thang thi khong dich duoc va moi phep chan cau chu deu mu',
    ).toEqual([]);
  });
});
