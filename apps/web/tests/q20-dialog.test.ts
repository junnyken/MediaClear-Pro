/**
 * P1.1-Q20-MCP-20: cau truc hop thoai xac nhan quyen.
 *
 * Day la test TINH tren ma nguon (web chua co trinh chay test component).
 * Phan hien thi that duoc kiem bang cach bam tay tren trinh duyet - ghi o TEST_LOG.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@mediaclear/i18n';

const DIALOG = readFileSync(join(import.meta.dirname, '../app/_components/RightsDialog.tsx'), 'utf8');

describe('Q-20 — cau truc hop thoai', () => {
  it('co du ba muc: pham vi ho tro, xac nhan quyen, phien ban tuyen bo', () => {
    expect(DIALOG).toContain("translate('rights.attestation.scope_heading')");
    expect(DIALOG).toContain("translate('rights.attestation.v2.title')");
    expect(DIALOG).toContain("translate('rights.attestation.statement_version_label')");
  });

  it('muc pham vi ho tro dung cau canonical va hai cau gioi han', () => {
    expect(DIALOG).toContain("translate('policy.visible_identity_scope')");
    expect(DIALOG).toContain("translate('provenance.retained_data_note')");
    expect(DIALOG).toContain("translate('provenance.invisible_identity_disclaimer')");
  });

  // P1.1-Q22-MCP-22: nhan o tick khong con la khoa rieng - no LA cau duoc ky.
  // Chi tiet duoc kiem o apps/web/tests/q22-checkbox.test.ts.
  it('muc xac nhan quyen dung VAN BAN DUOC KY va co o tick', () => {
    expect(DIALOG).toContain("translate('rights.attestation.v2.statement')");
    expect(DIALOG).toContain('type="checkbox"');
  });

  it('van giu du bon thong diep bat buoc tu Phase 1', () => {
    for (const key of [
      'rights.attestation.v2.ownership_note',
      'rights.attestation.v2.declaration_note',
      'policy.visible_identity_scope',
      'provenance.invisible_identity_disclaimer',
    ]) {
      expect(DIALOG, `thieu ${key}`).toContain(key);
    }
  });

  it('hien so phien ban lay tu may chu, khong go cung trong giao dien', () => {
    expect(DIALOG).toContain('statement.version');
    expect(DIALOG).not.toMatch(/v2['"`]\s*\}/);
  });

  it('cac muc co tieu de gan nhan cho trinh doc man hinh', () => {
    expect(DIALOG).toContain('aria-labelledby="rights-scope-heading"');
    expect(DIALOG).toContain('aria-labelledby="rights-confirm-heading"');
  });

  it('nut xac nhan bi khoa cho toi khi nguoi dung tick', () => {
    expect(DIALOG).toMatch(/disabled=\{!accepted/);
  });

  it('moi khoa hop thoai goi deu co ban dich o ca hai locale', () => {
    const keys = [...DIALOG.matchAll(/translate\(\s*'([a-z0-9_.]+)'/g)].map((m) => m[1] as string);
    expect(keys.length).toBeGreaterThan(8);
    const missing = keys.filter((k) => MESSAGES.vi[k] === undefined || MESSAGES.en[k] === undefined);
    expect(missing, 'hop thoai se hien khoa tho').toEqual([]);
  });

  it('CTA mo hop thoai dung ban owner duyet', () => {
    expect(MESSAGES.vi['screen.asset_detail.create_job_cta']).toBe('Làm sạch vùng nhận diện');
    expect(MESSAGES.vi['screen.job_review.submit']).toBe('Xử lý vùng logo và dấu hiệu nhận diện');
  });
});
