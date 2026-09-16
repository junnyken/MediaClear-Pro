/**
 * P1.1-Q21-MCP-21: cau English cua pham vi ho tro VAN CHUA duoc owner duyet.
 *
 * Prompt owner bi cat o "identifying ma". Repo dung dung chu owner viet o phan doc duoc va
 * hoan thanh chu cuoi thanh "marks" - chu do la SUY RA, khong phai owner duyet.
 *
 * Truoc luot nay, trang thai "chua duoc duyet" chi ton tai duoi dang MOT DONG CHU trong
 * OPEN_QUESTIONS.md. Bo test nay bien no thanh rang buoc HAI CHIEU:
 *   - doi chuoi ma quen cap nhat Q-21  => do
 *   - dong Q-21 ma chuoi khong doi     => do
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@mediaclear/i18n';

const OPEN_QUESTIONS = readFileSync(join(import.meta.dirname, '../../../docs/OPEN_QUESTIONS.md'), 'utf8');

/** Ban SUY RA dang nam trong repo. Khong phai ban owner duyet. */
const DERIVED_EN_SCOPE = 'MediaClear Pro only supports processing visible logos, trademarks, and identifying marks';

/** Dung chuoi ma prompt owner bi cat - bang chung vi sao cau tren dang ngo. */
const TRUNCATION_POINT = 'identifying ma';

/** Khoa duoc phep giong het nhau o hai locale, kem ly do. */
const SAME_IN_BOTH_LOCALES: Record<string, string> = {
  'app.name': 'ten san pham, khong dich',
};

function q21Row(): string {
  const row = OPEN_QUESTIONS.split('\n').find((l) => l.includes('| Q-21 |'));
  expect(row, 'mat dong Q-21 trong OPEN_QUESTIONS.md').toBeDefined();
  return row as string;
}

describe('Q-21 — cau English chua duoc duyet', () => {
  it('chuoi English van dung ban suy ra, khong ai tu sua them', () => {
    expect(MESSAGES.en['policy.visible_identity_scope']).toBe(DERIVED_EN_SCOPE);
  });

  it('Q-21 van o trang thai unconfirmed', () => {
    expect(q21Row()).toContain('`unconfirmed`');
  });

  it('RANG BUOC HAI CHIEU: chuoi va trang thai cau hoi phai di cung nhau', () => {
    const laBanSuyRa = MESSAGES.en['policy.visible_identity_scope'] === DERIVED_EN_SCOPE;
    const conDangNgo = q21Row().includes('`unconfirmed`');
    expect(
      laBanSuyRa,
      conDangNgo
        ? 'Q-21 ghi unconfirmed nhung chuoi English da doi: owner da duyet thi phai dong Q-21, chua duyet thi khong duoc sua chuoi'
        : 'Q-21 khong con unconfirmed nhung chuoi English van la ban SUY RA: khong duoc tuyen bo owner da duyet khi chu van do agent tu hoan thanh',
    ).toBe(conDangNgo);
  });

  it('diem bi cat cua prompt owner con nguyen trong ho so', () => {
    expect(q21Row()).toContain(TRUNCATION_POINT);
  });

  it('khong tu viet tiep phan cau bi cat', () => {
    const en = MESSAGES.en['policy.visible_identity_scope'] as string;
    // Ban suy ra ket thuc ngay sau "identifying ma|rks". Dai hon nghia la co nguoi doan them.
    expect(en.length, 'cau English dai hon ban suy ra: co nguoi viet tiep phan owner chua gui').toBe(
      DERIVED_EN_SCOPE.length,
    );
  });

  it('giao dien English chi duoc ghi partially_verified, khong duoc ghi confirmed', () => {
    const closure = readFileSync(join(import.meta.dirname, '../../../docs/PHASE_1_1_Q21_Q22_CLOSURE.md'), 'utf8');
    const row = closure.split('\n').find((l) => l.includes('Bản English') && l.includes('giao diện'));
    expect(row, 'bao cao closure phai co dong trang thai bang chung cua giao dien English').toBeDefined();
    expect(row).toContain('partially_verified');
    expect(row).not.toContain('`confirmed`');
  });
});

describe('Q-21 — parity ban dich', () => {
  it('vi va en co dung cung bo khoa', () => {
    expect(Object.keys(MESSAGES.vi).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });

  it('khong gia tri nao trong en con dau tieng Viet (quen dich)', () => {
    const dau = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
    const offenders = Object.entries(MESSAGES.en)
      .filter(([, value]) => dau.test(value))
      .map(([key]) => key);
    expect(offenders, 'gia tri en van con nguyen van tieng Viet').toEqual([]);
  });

  it('khong khoa nao co vi === en ngoai danh sach mien tru da ghi ro', () => {
    const offenders = Object.keys(MESSAGES.vi).filter(
      (k) => MESSAGES.vi[k] === MESSAGES.en[k] && SAME_IN_BOTH_LOCALES[k] === undefined,
    );
    expect(offenders, 'khoa chua dich: chep nguyen ban vi sang en').toEqual([]);
  });

  it('danh sach mien tru khong chua khoa da bien mat', () => {
    const stale = Object.keys(SAME_IN_BOTH_LOCALES).filter((k) => MESSAGES.vi[k] === undefined);
    expect(stale, 'mien tru cho khoa khong con ton tai').toEqual([]);
  });
});

describe('Q-21 khong duoc lam hong thu Q-22 vua chot', () => {
  it('nhan o tick van la cau duoc ky', () => {
    const dialog = readFileSync(
      join(import.meta.dirname, '../../../apps/web/app/_components/RightsDialog.tsx'),
      'utf8',
    );
    expect(dialog).toContain("translate('rights.attestation.v2.statement')");
    expect(dialog).not.toContain('rights.attestation.v2.checkbox');
  });
});
