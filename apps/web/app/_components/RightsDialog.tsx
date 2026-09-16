'use client';

/**
 * Hop thoai xac nhan quyen su dung (MCP-13).
 *
 * BAT BUOC hien du 4 thong diep: pham vi so huu - day la tuyen bo cua nguoi dung -
 * chi xu ly phan nhin thay duoc - va gioi han ve dau hieu nhan dien vo hinh.
 * Co o tick va hien phien ban dieu khoan.
 *
 * P1.1 (Q-19): dung TRON BO khoa v2. Khoa v1 van con trong file dich lam dau vet
 * lich su cua van ban ma nguoi dung truoc day da dong y - khong xoa.
 *
 * P1.1 (Q-22): o tick hien THANG cau duoc ky, khong dung nhan tom tat "noi dung tren".
 * Phan biet: cau `rights.attestation.v2.statement` la BANG CHUNG (co version, duoc luu);
 * tieu de muc, cau pham vi ho tro va hai cau canh bao la NGU CANH (khong version, khong luu).
 */
import { useState } from 'react';
import { apiFetch, translate, type ApiErrorShape } from '../_lib/api';
import { Button, ErrorNotice } from './Ui';

interface StatementInfo {
  statement: { id: string; version: number; i18nKey: string; validityDays: number };
}

export function RightsDialog({
  assetId,
  onClose,
  onDone,
}: {
  assetId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [statement, setStatement] = useState<StatementInfo['statement'] | null>(null);

  if (statement === null && !busy) {
    void apiFetch<StatementInfo>(`/v1/assets/${assetId}/rights-attestation`).then((result) => {
      if (result.ok) setStatement(result.data.statement);
    });
  }

  async function submit() {
    if (!accepted || !statement) return;
    setBusy(true);
    const result = await apiFetch(`/v1/assets/${assetId}/rights-attestation`, {
      method: 'POST',
      body: {
        statementId: statement.id,
        statementVersion: statement.version,
        localeShown: 'vi',
        accepted: true,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={translate('rights.attestation.v2.title')}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3, 7, 18, 0.72)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--mcp-space-4)',
      }}
    >
      <div
        style={{
          background: 'var(--mcp-surface)',
          borderRadius: 'var(--mcp-radius-md)',
          padding: 'var(--mcp-space-5)',
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ marginTop: 0 }}>{translate('rights.attestation.v2.title')}</h2>

        {/* Muc 1: pham vi he thong lam duoc gi - cau canonical owner duyet (Q-20). */}
        <section aria-labelledby="rights-scope-heading">
          <h3 id="rights-scope-heading" style={{ fontSize: 'var(--mcp-font-size-md)', marginBottom: 'var(--mcp-space-2)' }}>
            {translate('rights.attestation.scope_heading')}
          </h3>
          <p>{translate('policy.visible_identity_scope')}</p>
          <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('provenance.retained_data_note')}</p>
          <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('provenance.invisible_identity_disclaimer')}</p>
        </section>

        {/* Muc 2: van ban duoc ky + o tick. Day moi la thu duoc luu lam bang chung. */}
        <section aria-labelledby="rights-confirm-heading">
          <h3 id="rights-confirm-heading" style={{ fontSize: 'var(--mcp-font-size-md)', marginBottom: 'var(--mcp-space-2)' }}>
            {translate('rights.attestation.v2.title')}
          </h3>
          <p>{translate('rights.attestation.v2.ownership_note')}</p>
          <p>{translate('rights.attestation.v2.declaration_note')}</p>

          {/*
            P1.1-Q22-MCP-22: nhan o tick CHINH LA cau duoc ky, khong phai mot cau tom tat.
            Cau nay chi duoc xuat hien DUNG MOT CHO trong hop thoai - neu tach ra mot the <p>
            rieng roi de nhan tick tro toi no bang chu "noi dung tren" thi nguoi dung dang tick
            vao mot loi hua rong hon thu he thong thuc su luu lam bang chung.
          */}
          <label style={{ display: 'flex', gap: 'var(--mcp-space-3)', alignItems: 'flex-start', margin: 'var(--mcp-space-4) 0' }}>
            <input
              type="checkbox"
              name="accepted"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              style={{ width: 20, height: 20, marginTop: 2 }}
            />
            <span>{translate('rights.attestation.v2.statement')}</span>
          </label>
        </section>

        {/* Muc 3: phien ban tuyen bo - de nguoi dung biet minh dang ky ban nao. */}
        {statement ? (
          <p style={{ color: 'var(--mcp-text-secondary)' }}>
            {translate('rights.attestation.statement_version_label')}: v{statement.version} ·{' '}
            {translate('rights.attestation.v2.validity_note', { days: statement.validityDays })}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--mcp-space-3)', flexWrap: 'wrap' }}>
          <Button onClick={submit} disabled={!accepted || busy || statement === null}>
            {translate('rights.attestation.v2.submit')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {translate('common.cancel')}
          </Button>
        </div>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('rights.attestation.v2.decline_note')}</p>
        {error ? <ErrorNotice error={error} /> : null}
      </div>
    </div>
  );
}
