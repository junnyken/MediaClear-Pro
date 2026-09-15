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
        <p>{translate('rights.attestation.v2.ownership_note')}</p>
        <p>{translate('rights.attestation.v2.declaration_note')}</p>
        <p>{translate('policy.visible_identity_scope')}</p>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('provenance.invisible_identity_disclaimer')}</p>
        <p>{translate('rights.attestation.v2.statement')}</p>
        {statement ? (
          <p style={{ color: 'var(--mcp-text-secondary)' }}>
            {translate('rights.attestation.v2.policy_version')}: {statement.id} v{statement.version} ·{' '}
            {translate('rights.attestation.v2.validity_note', { days: statement.validityDays })}
          </p>
        ) : null}

        <label style={{ display: 'flex', gap: 'var(--mcp-space-3)', alignItems: 'flex-start', margin: 'var(--mcp-space-4) 0' }}>
          <input
            type="checkbox"
            name="accepted"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            style={{ width: 20, height: 20, marginTop: 2 }}
          />
          <span>{translate('rights.attestation.v2.checkbox')}</span>
        </label>

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
