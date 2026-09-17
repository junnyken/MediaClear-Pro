/**
 * Trang thai gate cua Phase 3, dat trong MA chu khong chi trong tai lieu.
 *
 * Vi sao can: truoc muc nay, gate chi ton tai duoi dang CHU trong `docs/PHASE_3_CLOSURE.md`. Mot
 * dong chu thi sua luc nao cung duoc va khong co gi do lai — dung dang lo hong ma `Q-21` da phai
 * dung mot phep chan hai chieu de bit. Dat o day thi tai lieu phai KHOP voi ma, va viec nang gate
 * tro thanh mot thay doi ma co test soi, khong phai mot cau van duoc sua am tham.
 */

/*
 * Cac gia tri CO THE co, khai bao RIENG.
 *
 * Khong suy ra tu gia tri DANG dung. Day la lan thu ba du an nay gap dung mot dang loi do:
 * `ApiRouteStatus` (D-046) mat 'planned' khi khong con route planned nao, roi regex canonical ID
 * ghim cung `0|1|1.1|2`. "Gia tri co the co" khac han "gia tri dang co".
 */
export const TECHNICAL_GATES = [
  'NOT_READY',
  'READY_FOR_PHASE_4_EXCEPT_ONLINE',
  'READY_FOR_PHASE_4',
] as const;
export type TechnicalGate = (typeof TECHNICAL_GATES)[number];

export const ONLINE_VERIFICATIONS = [
  'BLOCKED_BY_Q23',
  'PARTIALLY_VERIFIED',
  'VERIFIED',
] as const;
export type OnlineVerification = (typeof ONLINE_VERIFICATIONS)[number];

export const GO_LIVE_GATES = ['NOT_READY_FOR_GO_LIVE', 'GO_LIVE'] as const;
export type GoLiveGate = (typeof GO_LIVE_GATES)[number];

export interface Phase3Gate {
  technical: TechnicalGate;
  onlineVerification: OnlineVerification;
  goLive: GoLiveGate;
  /**
   * Cau chu Phase 3 da duoc owner duyet chua.
   *
   * Rieng biet voi viec RA SOAT: agent ra duoc (`D-059`), nhung DUYET la tham quyen cua owner/BA.
   * Owner da duyet 100 khoa va 11 khoa them cua `D-064` vao `2026-09-17` (`D-065`).
   *
   * Them khoa cau chu MOI sau moc do => phai xin duyet lai va dat lai `false`.
   */
  wordingOwnerApproved: boolean;
}

/**
 * Trang thai THAT o thoi diem hien tai.
 *
 * Doi gia tri o day la mot quyet dinh, khong phai mot thao tac don tep: cac phep kiem trong
 * `phase3-gate.test.ts` se doi tai lieu duoc cap nhat theo, va chan cac to hop khong duoc phep.
 */
export const PHASE_3_GATE: Phase3Gate = {
  technical: 'READY_FOR_PHASE_4_EXCEPT_ONLINE',
  onlineVerification: 'BLOCKED_BY_Q23',
  goLive: 'NOT_READY_FOR_GO_LIVE',
  wordingOwnerApproved: true,
};

/**
 * Cac to hop BI CAM, kem ly do.
 *
 * Tra ve danh sach rong = hop le. Viet duoi dang ham thay vi rai rac trong test de mot noi duy
 * nhat giu luat, va de goi duoc tu cho khac neu can.
 */
export function gateViolations(gate: Phase3Gate): string[] {
  const out: string[] = [];
  if (gate.goLive === 'GO_LIVE' && gate.onlineVerification !== 'VERIFIED') {
    out.push('GO_LIVE khi xac minh online chua VERIFIED: khong duoc tu dong blocker go-live');
  }
  if (gate.technical === 'READY_FOR_PHASE_4' && gate.onlineVerification !== 'VERIFIED') {
    out.push('READY_FOR_PHASE_4 tran khi xac minh online chua VERIFIED: phai la _EXCEPT_ONLINE');
  }
  if (gate.onlineVerification === 'VERIFIED' && gate.goLive === 'NOT_READY_FOR_GO_LIVE') {
    /*
     * KHONG phai loi - chi la cho de quen. Go-live con blocker khac ngoai Q-23 (cau chu chua
     * duyet, dau vet AI `unknown`, chua don du lieu lan nao), nen day khong bi cam.
     */
  }
  if (gate.goLive === 'GO_LIVE' && !gate.wordingOwnerApproved) {
    out.push('GO_LIVE khi cau chu chua duoc owner duyet');
  }
  return out;
}
