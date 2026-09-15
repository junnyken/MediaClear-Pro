'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, translate, type ApiErrorShape } from '../../_lib/api';
import { useResource } from '../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Loading, PageTitle, ValueOrUnknown, LinkButton } from '../../_components/Ui';
import { RightsDialog } from '../../_components/RightsDialog';

interface AssetView {
  asset: { id: string; mediaType: string; projectId: string };
  sourceFile: {
    originalFilename: string;
    declaredMimeType: string;
    uploadState: string;
    measured: null | {
      mimeType: string;
      byteSize: number;
      widthPx: number | null;
      heightPx: number | null;
      durationSeconds: number | null;
      checksumSha256: string;
    };
  };
  validation: { state: string; errors: ApiErrorShape[]; validatedAt: string | null };
  rightsAttestation: { status: 'missing' | 'active' | 'blocked'; attestedAt: string | null; statementVersion: number | null };
}

export default function AssetDetailPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;
  const [dialogOpen, setDialogOpen] = useState(false);
  const resource = useResource(() => apiFetch<AssetView>(`/v1/assets/${assetId}`), [assetId]);

  async function download() {
    const result = await apiFetch<{ url: string }>(`/v1/assets/${assetId}/download-url`);
    if (result.ok && typeof window !== 'undefined') window.open(result.data.url, '_blank');
  }

  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error' && resource.error) return <ErrorNotice error={resource.error} onRetry={resource.reload} />;
  if (!resource.data) return null;

  const view = resource.data;
  const rightsLabel =
    view.rightsAttestation.status === 'active'
      ? translate('screen.asset_detail.rights_active')
      : view.rightsAttestation.status === 'blocked'
        ? translate('screen.asset_detail.rights_blocked')
        : translate('screen.asset_detail.rights_missing');

  return (
    <>
      <PageTitle>{translate('screen.asset_detail.title')}</PageTitle>

      <Card title={translate('screen.asset_detail.source_title')}>
        <DefinitionRow label={translate('screen.asset_detail.source_title')}>{view.sourceFile.originalFilename}</DefinitionRow>
        <DefinitionRow label="MIME">
          <ValueOrUnknown value={view.sourceFile.measured?.mimeType ?? null} />
        </DefinitionRow>
        <DefinitionRow label="px">
          <ValueOrUnknown value={view.sourceFile.measured?.widthPx ?? null} /> ×{' '}
          <ValueOrUnknown value={view.sourceFile.measured?.heightPx ?? null} />
        </DefinitionRow>
        <DefinitionRow label="SHA-256">
          <ValueOrUnknown value={view.sourceFile.measured?.checksumSha256.slice(0, 16) ?? null} />
        </DefinitionRow>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('common.original_file_safe')}</p>
        <Button variant="secondary" onClick={download}>
          {translate('screen.asset_detail.download_cta')}
        </Button>
      </Card>

      <Card title={translate('screen.asset_detail.validation_title')}>
        <p style={{ color: view.validation.state === 'passed' ? 'var(--mcp-success)' : 'var(--mcp-warning)' }}>
          {view.validation.state === 'passed'
            ? translate('screen.upload_validation.result_pass')
            : view.validation.state === 'failed'
              ? translate('screen.upload_validation.result_fail')
              : translate('common.unknown_value')}
        </p>
        {view.validation.errors.length > 0 ? (
          <ul>
            {view.validation.errors.map((item) => (
              <li key={item.code} style={{ color: 'var(--mcp-danger)' }}>
                {translate(item.messageKey, item.params)}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title={translate('screen.asset_detail.rights_title')}>
        <p>{rightsLabel}</p>
        {view.rightsAttestation.status !== 'active' ? (
          <Button onClick={() => setDialogOpen(true)}>{translate('rights.attestation.v2.title')}</Button>
        ) : null}
      </Card>

      <Card>
        {view.validation.state === 'passed' && view.rightsAttestation.status === 'active' ? (
          <LinkButton href={`/assets/${assetId}/new-job`}>{translate('screen.asset_detail.create_job_cta')}</LinkButton>
        ) : (
          <p style={{ color: 'var(--mcp-text-secondary)' }}>
            {view.validation.state !== 'passed'
              ? translate('screen.upload_validation.next_step_fix')
              : translate('screen.upload_validation.next_step_attest')}
          </p>
        )}
      </Card>

      {dialogOpen ? (
        <RightsDialog
          assetId={assetId}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            setDialogOpen(false);
            resource.reload();
          }}
        />
      ) : null}
    </>
  );
}
