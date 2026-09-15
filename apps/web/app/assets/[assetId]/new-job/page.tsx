'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch, translate, type ApiErrorShape } from '../../../_lib/api';
import { useResource } from '../../../_lib/use-resource';
import { Button, Card, ErrorNotice, Loading, PageTitle } from '../../../_components/Ui';

const OPERATIONS = ['visible_logo_cleanup', 'visible_text_cleanup', 'object_cleanup', 'crop', 'blur', 'brand_overlay'] as const;

interface AssetView {
  validation: { state: string };
  rightsAttestation: { status: string };
}

export default function CreateJobPage() {
  const params = useParams<{ assetId: string }>();
  const router = useRouter();
  const assetId = params.assetId;
  const [selected, setSelected] = useState<string[]>(['visible_logo_cleanup']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [blockedJobId, setBlockedJobId] = useState<string | null>(null);

  const asset = useResource(() => apiFetch<AssetView>(`/v1/assets/${assetId}`), [assetId]);

  function toggle(operation: string) {
    setSelected((current) =>
      current.includes(operation) ? current.filter((item) => item !== operation) : [...current, operation],
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setBlockedJobId(null);
    const result = await apiFetch<{ job: { id: string } }>(`/v1/assets/${assetId}/jobs`, {
      method: 'POST',
      body: {
        operations: selected,
        regions: [],
        presetId: null,
        // Khoa chong gui trung: gui lai cung khoa se tra dung job cu.
        idempotencyKey: `${assetId}:${selected.join('+')}:${Date.now()}`,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      const jobId = result.error.params?.jobId;
      if (typeof jobId === 'string') setBlockedJobId(jobId);
      return;
    }
    router.push(`/jobs/${result.data.job.id}`);
  }

  const gates = asset.status === 'ready' && asset.data ? asset.data : null;

  return (
    <>
      <PageTitle>{translate('screen.job_review.title')}</PageTitle>

      <Card title={translate('screen.job_review.gates_title')}>
        {asset.status === 'loading' ? <Loading /> : null}
        {gates ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>
              {gates.validation.state === 'passed' ? '✓' : '✗'} {translate('screen.job_review.gate_validation')}
            </li>
            <li>
              {gates.rightsAttestation.status === 'active' ? '✓' : '✗'} {translate('screen.job_review.gate_rights')}
            </li>
          </ul>
        ) : null}
      </Card>

      <Card title={translate('screen.job_review.operations_label')}>
        {OPERATIONS.map((operation) => (
          <label key={operation} style={{ display: 'flex', gap: 'var(--mcp-space-3)', alignItems: 'center', padding: '6px 0' }}>
            <input
              type="checkbox"
              name={operation}
              checked={selected.includes(operation)}
              onChange={() => toggle(operation)}
              style={{ width: 20, height: 20 }}
            />
            <span>{translate(`operation.${operation}`)}</span>
          </label>
        ))}
      </Card>

      <Card>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_review.usage_note')}</p>
        <p style={{ color: 'var(--mcp-warning)' }}>{translate('screen.job_status.no_production_engine')}</p>
        <Button onClick={submit} disabled={busy || selected.length === 0}>
          {translate('screen.job_review.submit')}
        </Button>
        {error ? <ErrorNotice error={error} /> : null}
        {blockedJobId ? (
          <p style={{ marginTop: 'var(--mcp-space-3)' }}>
            <a href={`/jobs/${blockedJobId}`} style={{ color: 'var(--mcp-primary)' }}>
              {translate('screen.blocked.title')}
            </a>
          </p>
        ) : null}
      </Card>
    </>
  );
}
