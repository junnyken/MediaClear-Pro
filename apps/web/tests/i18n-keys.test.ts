/**
 * Chan loi "man hinh hien khoa dich tho".
 *
 * Tim thay khi BAM TAY o Phase 1.1: doi tien to khoa v1 -> v2 hang loat, nhung mot
 * cau da chuyen sang khoa khac nen UI hien nguyen chuoi `rights.attestation.v2.
 * visible_scope_note`. Khong test nao truoc do bat duoc vi chung chi kiem tung khoa
 * da biet, khong kiem TAT CA khoa ma UI thuc su goi.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@mediaclear/i18n';

const APP_DIR = join(import.meta.dirname, '../app');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

/** Moi khoa duoc goi bang translate('...') voi chuoi tinh trong ma nguon. */
function referencedKeys(): Array<{ key: string; file: string }> {
  const found: Array<{ key: string; file: string }> = [];
  for (const file of tsxFiles(APP_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/translate\(\s*'([a-z0-9_.]+)'/g)) {
      found.push({ key: match[1] as string, file: file.replace(APP_DIR, 'app') });
    }
  }
  return found;
}

describe('Khoa dich ma UI goi', () => {
  const keys = referencedKeys();

  it('co du khoa de kiem', () => {
    expect(keys.length).toBeGreaterThan(40);
  });

  it('MOI khoa UI goi deu ton tai o ca vi va en', () => {
    const missing = keys
      .filter(({ key }) => MESSAGES.vi[key] === undefined || MESSAGES.en[key] === undefined)
      .map(({ key, file }) => `${key} (${file})`);
    expect(missing, 'UI se hien khoa tho thay vi cau chu').toEqual([]);
  });

  it('khong khoa nao tra ve chuoi rong', () => {
    const empty = keys.filter(({ key }) => (MESSAGES.vi[key] ?? '').trim() === '').map(({ key }) => key);
    expect(empty).toEqual([]);
  });
});

/**
 * P3: chan khoa dich THO lot ra man hinh tu phia MAY CHU.
 *
 * Test o tren chi quet `translate('...')` trong ma nguon giao dien. Nhung mot so khoa duoc MAY CHU
 * sinh ra roi giao dien dich lai (vd `limitationNote` cua bien nhan) — chung khong xuat hien duoi
 * dang chuoi tinh trong `apps/web`, nen khong test nao o tren cham toi.
 *
 * Bam tay moi thay: man hinh hien nguyen `provenance.limitation.no_video_metadata_reader`.
 */
import { readFileSync as readServerFile } from 'node:fs';
import { join as joinServer } from 'node:path';

describe('Khoa dich do MAY CHU sinh ra', () => {
  it('moi khoa `provenance.limitation.*` trong ma may chu deu co ban dich', () => {
    const apiSrc = joinServer(import.meta.dirname, '../../api/src');
    const files = [
      joinServer(apiSrc, 'media/provenance-probe.ts'),
      joinServer(apiSrc, 'services/run-video-job.ts'),
    ];
    const keys = new Set<string>();
    for (const file of files) {
      for (const m of readServerFile(file, 'utf8').matchAll(/'(provenance\.limitation\.[a-z0-9_.]+)'/g)) {
        keys.add(m[1] as string);
      }
    }
    expect(keys.size, 'khong tim thay khoa nao de kiem').toBeGreaterThan(0);
    const missing = [...keys].filter((k) => MESSAGES.vi[k] === undefined || MESSAGES.en[k] === undefined);
    expect(missing, 'khoa do may chu sinh ra nhung khong co ban dich').toEqual([]);
  });
});
