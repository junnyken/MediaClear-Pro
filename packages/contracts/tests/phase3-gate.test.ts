/**
 * Phep chan GOVERNANCE cho gate Phase 3.
 *
 * Truoc muc nay, gate chi la CHU trong `docs/PHASE_3_CLOSURE.md`: khong co gi ngan mot luot lam
 * viec sau nay sua cau van thanh "READY_FOR_PHASE_4" hoac "GO_LIVE" ma khong ai nhan ra. Follow-up
 * cua owner yeu cau dung cac doi chung am nay ("test do neu co guard") — truoc lượt nay repo
 * KHONG co guard nao cho Q-23, cho gate, hay cho go-live.
 *
 * Moi phep o day la HAI CHIEU (bai hoc tu `Q-21`): sai theo chieu nao cung do.
 *   - nang gate trong ma ma quen sua tai lieu  => do
 *   - sua tai lieu ma khong doi gate trong ma  => do
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GO_LIVE_GATES,
  ONLINE_VERIFICATIONS,
  PHASE_3_GATE,
  TECHNICAL_GATES,
  gateViolations,
  type Phase3Gate,
} from '../src/phase3-gate.js';

const DOCS = join(import.meta.dirname, '../../../docs');
const read = (name: string) => readFileSync(join(DOCS, name), 'utf8');

/*
 * Doc DUNG khoi khai bao gate, khong quet ca tai lieu.
 *
 * Quet ca tai lieu la sai: §17 co cau trung thuc "khong khai `READY_FOR_PHASE_4` tran" — mot cau
 * NOI VE token do chu khong phai mot loi khai. Phep chan quet theo tu khoa se bat oan chinh cau
 * dang lam dung. Day la lan thu ba du an nay gap dang loi "liet ke tu khoa cung bi tinh la vi pham".
 */
function khaiBaoGate(): { technical: string; online: string; goLive: string } {
  const closure = read('PHASE_3_CLOSURE.md');
  const lay = (nhan: string): string => {
    const m = closure.match(new RegExp(`^${nhan}:\\s*(\\S+)\\s*$`, 'm'));
    expect(m, `PHASE_3_CLOSURE.md thieu dong khai bao "${nhan}:"`).not.toBeNull();
    return m?.[1] ?? '';
  };
  return { technical: lay('Technical gate'), online: lay('Online verification'), goLive: lay('Go-live') };
}

/** Lay dung mot hang cua bang cau hoi mo. */
function row(id: string): string {
  const line = read('OPEN_QUESTIONS.md')
    .split('\n')
    .find((l) => l.includes(`| ${id} |`));
  expect(line, `mat hang ${id} trong OPEN_QUESTIONS.md`).toBeDefined();
  return line as string;
}

describe('gate Phase 3 — tai lieu phai khop MA, khong phai nguoc lai', () => {
  it('khoi khai bao gate trong tai lieu khop DUNG voi ma', () => {
    const khai = khaiBaoGate();
    expect(khai.technical).toBe(PHASE_3_GATE.technical);
    expect(khai.online).toBe(PHASE_3_GATE.onlineVerification);
    expect(khai.goLive).toBe(PHASE_3_GATE.goLive);
  });

  it('to hop gate hien tai khong vi pham luat nao', () => {
    expect(gateViolations(PHASE_3_GATE)).toEqual([]);
  });

  it('CHAN: khong the dat GO_LIVE khi xac minh online chua VERIFIED', () => {
    const lieu: Phase3Gate = { ...PHASE_3_GATE, goLive: 'GO_LIVE' };
    expect(gateViolations(lieu).length, 'go-live tu mo ma khong ai chan').toBeGreaterThan(0);
  });

  it('CHAN: khong the khai READY_FOR_PHASE_4 tran khi online chua VERIFIED', () => {
    const lieu: Phase3Gate = { ...PHASE_3_GATE, technical: 'READY_FOR_PHASE_4' };
    expect(gateViolations(lieu)).toContain(
      'READY_FOR_PHASE_4 tran khi xac minh online chua VERIFIED: phai la _EXCEPT_ONLINE',
    );
  });

  it('khi online chua VERIFIED, KHOI KHAI BAO khong duoc ghi READY_FOR_PHASE_4 tran', () => {
    if (PHASE_3_GATE.onlineVerification === 'VERIFIED') return;
    expect(khaiBaoGate().technical).not.toBe('READY_FOR_PHASE_4');
  });

  /*
   * Q-23 hai chieu. Chua co kho object dung chung thi xac minh online phai la `BLOCKED_BY_Q23`,
   * VA hang Q-23 phai con mo. Dong mot ben mà quen ben kia => do.
   */
  it('Q-23 va trang thai xac minh online khop nhau (hai chieu)', () => {
    const q23 = row('Q-23');
    const conMo = q23.includes('`unknown`') || q23.includes('`blocked`');
    expect(
      conMo,
      'Q-23 da dong trong OPEN_QUESTIONS nhung onlineVerification van BLOCKED_BY_Q23',
    ).toBe(PHASE_3_GATE.onlineVerification === 'BLOCKED_BY_Q23');
  });

  /*
   * Q-P3-08 hai chieu. Owner quy dinh ro trong follow-up: ra soat KHAC duyet, va chua duyet thi
   * phai giu `owner_decision_required`.
   */
  it('Q-P3-08 giu `owner_decision_required` chung nao owner chua duyet (hai chieu)', () => {
    const cho = row('Q-P3-08').includes('owner_decision_required');
    expect(
      cho,
      'cau chu chua duoc owner duyet nhung tai lieu khong con ghi owner_decision_required',
    ).toBe(!PHASE_3_GATE.wordingOwnerApproved);
  });

  it('Q-P3-09 chi duoc ghi la da chot khi co dan xac nhan cua owner', () => {
    const q = row('Q-P3-09');
    const daChot = q.includes('D-059');
    if (daChot) {
      expect(q, 'Q-P3-09 ghi da chot ma khong dan nguon xac nhan cua owner').toContain(
        'Owner xác nhận',
      );
    }
  });

  it('danh sach gia tri CO THE co duoc khai bao rieng, khong suy tu gia tri dang dung', () => {
    // D-046: "gia tri co the co" bi dinh nghia bang "gia tri dang co" la loi da gap ba lan.
    expect(TECHNICAL_GATES).toContain('READY_FOR_PHASE_4');
    expect(ONLINE_VERIFICATIONS).toContain('VERIFIED');
    expect(GO_LIVE_GATES).toContain('GO_LIVE');
  });
});
