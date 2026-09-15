/**
 * P1.1-Q22-MCP-21: o tick phai hien THANG cau duoc ky.
 *
 * Loi ma bo test nay chan: hop thoai hien 4 doan van, o tick ghi "xac nhan noi dung tren",
 * nhung he thong chi luu DUNG MOT CAU lam bang chung. Nhan mo ho khien nguoi dung tick vao
 * mot loi hua rong hon thu ho thuc su ky.
 *
 * Day la test TINH tren ma nguon (web chua co trinh chay test component). Phan hien thi that
 * duoc bam tay tren trinh duyet - ghi o TEST_LOG.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@mediaclear/i18n';
import { RIGHTS_STATEMENT } from '@mediaclear/contracts';

const DIALOG = readFileSync(join(import.meta.dirname, '../app/_components/RightsDialog.tsx'), 'utf8');
const OPEN_QUESTIONS = readFileSync(join(import.meta.dirname, '../../../docs/OPEN_QUESTIONS.md'), 'utf8');

/** Cau owner duyet - go nguyen van o day de test doc duoc mot minh no la du. */
const CANONICAL_VI = 'Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này.';

/** Lay dung khoi <label> co chua o tick. */
function checkboxLabelBlock(): string {
  const start = DIALOG.indexOf('<label');
  expect(start, 'hop thoai khong con the <label> nao').toBeGreaterThan(-1);
  const end = DIALOG.indexOf('</label>', start);
  expect(end, 'the <label> khong dong').toBeGreaterThan(start);
  const block = DIALOG.slice(start, end);
  expect(block, 'khoi <label> dau tien khong chua o tick').toContain('type="checkbox"');
  return block;
}

describe('Q-22 — nhan o tick tro dung pham vi', () => {
  it('nhan o tick tra ra dung cau canonical owner duyet', () => {
    const block = checkboxLabelBlock();
    const keys = [...block.matchAll(/translate\(\s*'([a-z0-9_.]+)'/g)].map((m) => m[1] as string);
    expect(keys, 'nhan o tick phai di qua dung mot khoa dich').toHaveLength(1);
    const labelKey = keys[0] as string;
    expect(MESSAGES.vi[labelKey]).toBe(CANONICAL_VI);
  });

  it('nhan o tick dung lai CHINH khoa cua van ban duoc ky', () => {
    const block = checkboxLabelBlock();
    expect(block).toContain(`translate('${RIGHTS_STATEMENT.i18nKey}')`);
  });

  it('cau duoc ky chi xuat hien DUNG MOT LAN trong hop thoai', () => {
    const occurrences = DIALOG.split(`translate('${RIGHTS_STATEMENT.i18nKey}')`).length - 1;
    expect(occurrences, 'cau duoc ky bi lap - nhan tick va doan van co the lech nhau').toBe(1);
  });

  it('khong con goi nhan mo ho cu', () => {
    expect(DIALOG).not.toContain('rights.attestation.v2.checkbox');
  });

  it('nhan mo ho cu da bi go khoi ca hai locale', () => {
    for (const locale of ['vi', 'en'] as const) {
      expect(MESSAGES[locale]['rights.attestation.v2.checkbox'], `con o locale ${locale}`).toBeUndefined();
    }
  });

  it('khoa lich su cua hop thoai v1 van con lam dau vet', () => {
    expect(MESSAGES.vi['rights.attestation.v1.checkbox']).toBeTruthy();
    expect(MESSAGES.en['rights.attestation.v1.checkbox']).toBeTruthy();
  });

  it('KHONG tao version moi: van la v2 va tro dung khoa v2', () => {
    expect(RIGHTS_STATEMENT.version).toBe(2);
    expect(RIGHTS_STATEMENT.i18nKey).toBe('rights.attestation.v2.statement');
    expect(MESSAGES.vi['rights.attestation.v3.statement']).toBeUndefined();
  });

  it('Q-21 van o trang thai unconfirmed - khong tu y dong ho', () => {
    const row = OPEN_QUESTIONS.split('\n').find((l) => l.includes('| Q-21 |'));
    expect(row, 'mat dong Q-21').toBeDefined();
    expect(row).toContain('`unconfirmed`');
  });

  it('Q-22 khong con nam o bang cau hoi dang mo', () => {
    const openSection = OPEN_QUESTIONS.split(/^##\s+2\. Đã giải quyết/m)[0] as string;
    expect(openSection.includes('| Q-22 |'), 'Q-22 da duoc dong trong luot nay').toBe(false);
  });
});
