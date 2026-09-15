/**
 * P1.1-MCP-19: cau chu hien thi phai dung ban owner duyet, tung chu.
 * Test nay la cho chan: doi cau chu ma quen cap nhat se do ngay.
 */
import { describe, expect, it } from 'vitest';
import { RIGHTS_STATEMENT } from '../../contracts/src/policy.js';
import { MESSAGES } from '../src/index.js';

/** Ban owner duyet (Phase 1.1 prompt, muc Q-19). Khong duoc sua o day de "cho test xanh". */
const OWNER_APPROVED = {
  'policy.visible_identity_scope':
    'MediaClear Pro chỉ hỗ trợ xử lý logo, nhãn hiệu và dấu hiệu nhận diện nhìn thấy được',
  'rights.attestation.v2.statement':
    'Tôi xác nhận rằng tôi sở hữu nội dung này hoặc có quyền chỉnh sửa nội dung này.',
  'screen.asset_detail.create_job_cta': 'Làm sạch vùng nhận diện',
  'screen.job_review.submit': 'Xử lý vùng logo và dấu hiệu nhận diện',
} as const;

describe('Cau chu chinh thuc', () => {
  it('cau ve pham vi nang luc dung tung chu', () => {
    expect(MESSAGES.vi['policy.visible_identity_scope']).toBe(OWNER_APPROVED['policy.visible_identity_scope']);
  });

  it('cau xac nhan quyen (v2) dung tung chu', () => {
    expect(MESSAGES.vi['rights.attestation.v2.statement']).toBe(OWNER_APPROVED['rights.attestation.v2.statement']);
  });

  it('cau canh bao ve dau hieu nhan dien vo hinh khong cam ket dieu he thong khong lam duoc', () => {
    const text = MESSAGES.vi['provenance.invisible_identity_disclaimer'] ?? '';
    expect(text).toContain('không cam kết');
    expect(text).toContain('dấu hiệu nhận diện vô hình');
    // Khong duoc hua go bo bat ky thu gi.
    expect(text).not.toMatch(/sẽ (gỡ|xoá|xóa|loại bỏ)/i);
  });

  it('CTA dung ban uu tien cua owner', () => {
    expect(MESSAGES.vi['screen.asset_detail.create_job_cta']).toBe(OWNER_APPROVED['screen.asset_detail.create_job_cta']);
    expect(MESSAGES.vi['screen.job_review.submit']).toBe(OWNER_APPROVED['screen.job_review.submit']);
  });

  it('khong CTA nao dung cach noi bi cam', () => {
    const forbidden = /xóa\s+watermark|xoá\s+watermark|remove\s+watermark/i;
    const offenders = Object.entries(MESSAGES.vi)
      .filter(([key]) => /cta|submit|_button/.test(key))
      .filter(([, value]) => forbidden.test(value))
      .map(([key]) => key);
    expect(offenders).toEqual([]);
  });

  it('khong khoa nao trong CA HAI locale dung cach noi bi cam', () => {
    const forbidden = /xóa\s+watermark|xoá\s+watermark|remove\s+watermark/i;
    for (const locale of ['vi', 'en'] as const) {
      const offenders = Object.entries(MESSAGES[locale])
        .filter(([, value]) => forbidden.test(value))
        .map(([key]) => key);
      expect(offenders, `locale ${locale}`).toEqual([]);
    }
  });
});

describe('Phien ban noi dung xac nhan quyen', () => {
  it('RIGHTS_STATEMENT tro toi khoa co that o ca hai locale', () => {
    expect(MESSAGES.vi[RIGHTS_STATEMENT.i18nKey]).toBeTruthy();
    expect(MESSAGES.en[RIGHTS_STATEMENT.i18nKey]).toBeTruthy();
  });

  it('dang o phien ban 2 va tro dung khoa v2', () => {
    expect(RIGHTS_STATEMENT.version).toBe(2);
    expect(RIGHTS_STATEMENT.i18nKey).toBe('rights.attestation.v2.statement');
  });

  it('khoa v1 VAN CON lam dau vet lich su (khong duoc xoa)', () => {
    expect(MESSAGES.vi['rights.attestation.v1.statement']).toBeTruthy();
    expect(MESSAGES.en['rights.attestation.v1.statement']).toBeTruthy();
  });

  it('van ban v2 KHAC v1 - neu giong thi viec len phien ban la vo nghia', () => {
    expect(MESSAGES.vi['rights.attestation.v2.statement']).not.toBe(MESSAGES.vi['rights.attestation.v1.statement']);
  });

  // P1.1-Q22-MCP-21 (D-034): 'checkbox' bi go khoi danh sach nay. Nhan o tick khong con la
  // mot khoa rieng - no dung chinh 'statement'. Xem apps/web/tests/q22-checkbox.test.ts.
  it('bo khoa v2 day du cho hop thoai', () => {
    for (const suffix of ['title', 'statement', 'decline_note', 'ownership_note', 'declaration_note', 'policy_version', 'submit', 'validity_note']) {
      const key = `rights.attestation.v2.${suffix}`;
      expect(MESSAGES.vi[key], `thieu vi: ${key}`).toBeTruthy();
      expect(MESSAGES.en[key], `thieu en: ${key}`).toBeTruthy();
    }
  });

  it('nhan o tick khong con la khoa rieng (Q-22)', () => {
    expect(MESSAGES.vi['rights.attestation.v2.checkbox']).toBeUndefined();
    expect(MESSAGES.en['rights.attestation.v2.checkbox']).toBeUndefined();
  });
});
