'use client';

import { useParams } from 'next/navigation';
import { apiFetch, translate } from '../../_lib/api';
import { useResource } from '../../_lib/use-resource';
import {
  Button,
  Card,
  DefinitionRow,
  ErrorNotice,
  EvidenceBadge,
  Loading,
  PageTitle,
  StateBadge,
  ValueOrUnknown,
  LinkButton,
} from '../../_components/Ui';

interface JobView {
  job: {
    id: string;
    assetId: string;
    state: string;
    reasonCode: string | null;
    blockReasonKind: string | null;
    request: { operations: string[] };
    outputAssetId: string | null;
  };
  providerCapability: string;
  productionProcessingEnabled: boolean;
  usage: { unitType: string; quantity: number; state: string; expiresAt: string | null };
}

export default function JobStatusPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const resource = useResource(() => apiFetch<JobView>(`/v1/jobs/${jobId}`), [jobId]);

  async function cancel() {
    await apiFetch(`/v1/jobs/${jobId}/cancel`, { method: 'POST' });
    resource.reload();
  }

  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error' && resource.error) return <ErrorNotice error={resource.error} onRetry={resource.reload} />;
  if (!resource.data) return null;

  const view = resource.data;
  const isBlocked = view.job.state === 'blocked';

  return (
    <>
      <PageTitle>{isBlocked ? translate('screen.blocked.title') : translate('screen.job_status.title')}</PageTitle>

      <Card>
        <DefinitionRow label={translate('screen.job_status.title')}>
          <StateBadge state={view.job.state} />
        </DefinitionRow>
        <DefinitionRow label={translate('screen.job_review.operations_label')}>
          {view.job.request.operations.map((operation) => translate(`operation.${operation}`)).join(', ')}
        </DefinitionRow>
        <DefinitionRow label={translate('screen.job_status.usage_state')}>
          {view.usage.quantity} {translate(`usage.${view.usage.unitType}`)} · {translate(`usage.state.${view.usage.state}`)}
        </DefinitionRow>
        <DefinitionRow label={translate('screen.job_status.provider_capability')}>
          <EvidenceBadge status={view.providerCapability} />
        </DefinitionRow>
        {/* Han giu muc dung: noi ro khoan giu khong ton tai vinh vien. */}
        {view.usage.expiresAt && view.usage.state !== 'released' && view.usage.state !== 'none' ? (
          <DefinitionRow label={translate('screen.job_status.reservation_hold_until')}>
            <ValueOrUnknown value={new Date(view.usage.expiresAt).toLocaleString('vi-VN')} />
          </DefinitionRow>
        ) : null}
      </Card>

      {isBlocked ? (
        <Card title={translate('screen.blocked.reason')}>
          <p style={{ color: 'var(--mcp-danger)' }}>
            {view.job.reasonCode ? translate(`errors.${view.job.reasonCode.toLowerCase()}`) : translate('common.unknown_value')}
          </p>
          <p>{translate('screen.blocked.terminal_note')}</p>
          <h3 style={{ fontSize: 'var(--mcp-font-size-md)' }}>{translate('screen.blocked.next_action')}</h3>
          <LinkButton href={`/assets/${view.job.assetId}`}>{translate('screen.blocked.new_job_cta')}</LinkButton>
        </Card>
      ) : (
        <Card>
          {/* Noi dung bat buoc: da tiep nhan, chua bat xu ly production, khong hien ket qua gia. */}
          <p>{translate('screen.job_status.accepted')}</p>
          <p style={{ color: 'var(--mcp-warning)' }}>{translate('screen.job_status.no_production_engine')}</p>
          <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_status.no_fake_result')}</p>
          {view.job.state === 'queued' || view.job.state === 'processing' ? (
            <Button variant="danger" onClick={cancel}>
              {translate('screen.job_status.cancel_cta')}
            </Button>
          ) : null}
        </Card>
      )}
    </>
  );
}
