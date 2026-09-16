/**
 * Trang Nhat ky khong duoc de lot RAW TRANSLATION KEY ra man hinh.
 *
 * `D-061` noi nhan loai su kien vao `translate()`. Phep chan i18n bat buoc moi gia tri trong
 * `AUDIT_EVENTS` phai co nhan — nhung no soi danh sach DANG co trong ma, con `recordAudit` thi
 * nhan `eventType: string`. Mot dong audit cu trong co so du lieu (vi du `rights.attested`, dang
 * ten co dau cham, hien dang duoc dung lam fixture trong `p2-persistence-contract.test.ts`) se
 * lam `t()` tra ve chinh khoa va man hinh hien `audit_event.rights.attested`.
 *
 * Day dung la dieu guardrail cua owner cam: "Khong raw translation key".
 */
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@mediaclear/i18n';
import { AUDIT_EVENTS } from '../../api/src/services/audit.js';
import { auditEventLabel } from '../app/_lib/api';

describe('nhan loai su kien o trang Nhat ky', () => {
  it('loai su kien DA BIET hien dung nhan that, khong phai duong lui', () => {
    const nhan = auditEventLabel(AUDIT_EVENTS.PROCESSING_JOB_COMPLETED);
    expect(nhan).toBe(MESSAGES.vi['audit_event.processing_job_completed']);
    expect(nhan).not.toBe(MESSAGES.vi['audit_event.unknown']);
  });

  it('loai su kien LA khong bao gio lam lo khoa tho ra man hinh', () => {
    for (const la of ['rights.attested', 'legacy_event_v0', '', 'khong_ton_tai']) {
      const nhan = auditEventLabel(la);
      expect(nhan, `lot khoa tho voi "${la}"`).not.toContain('audit_event.');
      expect(nhan).toBe(MESSAGES.vi['audit_event.unknown']);
    }
  });

  it('moi loai su kien trong AUDIT_EVENTS deu co nhan that (khong roi ve duong lui)', () => {
    const roi = Object.values(AUDIT_EVENTS).filter(
      (t) => auditEventLabel(t) === MESSAGES.vi['audit_event.unknown'],
    );
    expect(roi, 'loai su kien roi ve nhan chung => nguoi dung khong biet chuyen gi xay ra').toEqual([]);
  });
});
