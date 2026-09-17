'use client';

import { ASSET_VIEW_SCHEMA, RETENTION_VIEW_SCHEMA, SIGNED_URL_SCHEMA } from '@mediaclear/contracts';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetchChecked, translate } from '../../_lib/api';
import { friendlyType } from '../../_lib/media-format';
import { useResource } from '../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Loading, PageTitle, ValueOrUnknown, LinkButton } from '../../_components/Ui';
import { RightsDialog } from '../../_components/RightsDialog';

export default function AssetDetailPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;
  const [dialogOpen, setDialogOpen] = useState(false);
  const resource = useResource(() => apiFetchChecked(`/v1/assets/${assetId}`, ASSET_VIEW_SCHEMA), [assetId]);
  const retention = useResource(() => apiFetchChecked(`/v1/assets/${assetId}/retention`, RETENTION_VIEW_SCHEMA), [assetId]);

  async function download() {
    const result = await apiFetchChecked(`/v1/assets/${assetId}/download-url`, SIGNED_URL_SCHEMA);
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
        <DefinitionRow label={translate('field.file_name')}>{view.sourceFile.originalFilename}</DefinitionRow>
        <DefinitionRow label={translate('field.file_format')}>
          <ValueOrUnknown value={view.sourceFile.measured ? friendlyType(view.sourceFile.measured.mimeType) : null} />
        </DefinitionRow>
        <DefinitionRow label={translate('field.frame_size')}>
          <ValueOrUnknown value={view.sourceFile.measured?.widthPx ?? null} /> ×{' '}
          <ValueOrUnknown value={view.sourceFile.measured?.heightPx ?? null} /> px
        </DefinitionRow>
        <DefinitionRow label={translate('field.file_fingerprint')}>
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

      {/*
        * P2-MCP-33: han luu giu. Truoc day luat luu giu chay o tang duoi ma nguoi dung KHONG
        * co cach nao biet tep cua ho se duoc giu toi bao gio.
        */}
      {retention.data ? (
        <Card title={translate('screen.asset_detail.retention_title')}>
          <DefinitionRow label={translate('screen.asset_detail.retention_state')}>
            {translate(`retention_state.${retention.data.retentionState}`)}
          </DefinitionRow>
          <DefinitionRow label={translate('screen.asset_detail.retention_until')}>
            <ValueOrUnknown
              value={retention.data.retainUntil ? new Date(retention.data.retainUntil).toLocaleDateString('vi-VN') : null}
            />
          </DefinitionRow>
          <DefinitionRow label={translate('screen.asset_detail.retention_last_access')}>
            <ValueOrUnknown
              value={retention.data.lastAccessedAt ? new Date(retention.data.lastAccessedAt).toLocaleString('vi-VN') : null}
            />
          </DefinitionRow>
          {/*
            * Noi ro he thong CHUA xoa gi. Hien "da toi han" ma khong noi tiep se khien nguoi dung
            * tuong tep da mat.
            */}
          <p style={{ color: retention.data.deletionCandidate ? 'var(--mcp-warning)' : 'var(--mcp-text-secondary)' }}>
            {retention.data.deletionCandidate
              ? translate('screen.asset_detail.retention_candidate')
              : translate('screen.asset_detail.retention_safe')}
          </p>
        </Card>
      ) : null}

      <Card title={translate('screen.asset_detail.rights_title')}>
        <p>{rightsLabel}</p>
        {view.rightsAttestation.status !== 'active' ? (
          <Button onClick={() => setDialogOpen(true)}>{translate('rights.attestation.v2.title')}</Button>
        ) : null}
      </Card>

      <Card>
        {/*
          * Video di duong RIENG (P3-MCP-30…34): no can ban xem truoc, chon vung va chon khung hinh
          * — nhung thu man hinh tao job cua anh khong co.
          */}
        {view.validation.state === 'passed' && view.rightsAttestation.status === 'active' ? (
          <LinkButton href={view.asset.mediaType === 'video' ? `/assets/${assetId}/video` : `/assets/${assetId}/new-job`}>
            {view.asset.mediaType === 'video'
              ? translate('screen.video.title')
              : translate('screen.asset_detail.create_job_cta')}
          </LinkButton>
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
