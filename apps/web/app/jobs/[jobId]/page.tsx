'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DEFAULT_LOCALE, formatBytes } from '@mediaclear/i18n';
import { apiFetch, translate, type ApiErrorShape } from '../../_lib/api';
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

interface JobOutput {
  outputAssetId: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  validated: boolean;
  createdAt: string;
}

interface OutputDownload {
  url: string;
  expiresAt: string;
  checksumSha256: string;
  byteSize: number;
}

export default function JobStatusPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const resource = useResource(() => apiFetch<JobView>(`/v1/jobs/${jobId}`), [jobId]);
  const [downloadError, setDownloadError] = useState<ApiErrorShape | null>(null);
  const jobState = resource.data?.job.state ?? null;
  /*
   * Chi hoi ban ket qua khi job DA xong. Hoi som hon thi chac chan 404 va se do mot loi
   * khong co that len man hinh cua nguoi dung.
   */
  const output = useResource<JobOutput | null>(
    async () => (jobState === 'completed' ? apiFetch<JobOutput>(`/v1/jobs/${jobId}/output`) : { ok: true, data: null }),
    [jobId, jobState],
  );

  async function cancel() {
    await apiFetch(`/v1/jobs/${jobId}/cancel`, { method: 'POST' });
    resource.reload();
  }

  /*
   * URL tai ve duc ra khi NGUOI DUNG BAM, khong phai khi mo trang. URL nay co han rat ngan:
   * duc san luc mo trang thi den luc bam co the da het han, va moi lan mo trang lai ghi mot
   * su kien "da phat quyen tai" khong co ai that su tai gi.
   */
  async function download() {
    setDownloadError(null);
    const result = await apiFetch<OutputDownload>(`/v1/jobs/${jobId}/output/download-url`);
    if (!result.ok) {
      // Noi that vi sao khong tai duoc, khong im lang khong lam gi.
      setDownloadError(result.error);
      return;
    }
    window.location.href = result.data.url;
  }

  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error' && resource.error) return <ErrorNotice error={resource.error} onRetry={resource.reload} />;
  if (!resource.data) return null;

  const view = resource.data;
  const isBlocked = view.job.state === 'blocked';
  const isCompleted = view.job.state === 'completed';

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
      ) : isCompleted ? (
        /*
         * Job da xong THAT. Truoc P2-MCP-29, man hinh nay van hien canh bao "chua bat xu ly"
         * cho ca job da xong, va khong co duong nao dan toi tep ket qua - tep nam trong kho ma
         * nguoi dung khong bao gio thay.
         */
        <Card title={translate('screen.job_status.result_title')}>
          <p>{translate('screen.job_status.result_ready')}</p>
          {output.data ? (
            <>
              <DefinitionRow label={translate('screen.job_status.result_size')}>
                {formatBytes(DEFAULT_LOCALE, output.data.byteSize)}
              </DefinitionRow>
              <DefinitionRow label={translate('screen.job_status.result_checksum')}>
                <code style={{ fontSize: 'var(--mcp-font-size-sm)', wordBreak: 'break-all' }}>
                  {output.data.checksumSha256}
                </code>
              </DefinitionRow>
              <p style={{ color: 'var(--mcp-text-secondary)' }}>
                {translate('screen.job_status.result_checksum_hint')}
              </p>
              {output.data.validated ? (
                <>
                  <Button onClick={download}>{translate('screen.job_status.download_cta')}</Button>
                  <p style={{ color: 'var(--mcp-text-secondary)' }}>
                    {translate('screen.job_status.download_expires')}
                  </p>
                </>
              ) : (
                /* Chua do lai byte thi khong phat tep: bat bien I-2 o dung cho cuoi cung. */
                <p style={{ color: 'var(--mcp-warning)' }}>
                  {translate('screen.job_status.result_not_verified')}
                </p>
              )}
            </>
          ) : output.status === 'loading' ? (
            <Loading />
          ) : output.error ? (
            <ErrorNotice error={output.error} onRetry={output.reload} />
          ) : null}
          {downloadError ? <ErrorNotice error={downloadError} onRetry={download} /> : null}
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
