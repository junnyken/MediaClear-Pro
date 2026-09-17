'use client';

import { JOB_OUTPUT_SCHEMA, JOB_PREVIEW_SCHEMA, JOB_RECEIPT_SCHEMA, JOB_VIEW_SCHEMA, SIGNED_URL_SCHEMA } from '@mediaclear/contracts';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DEFAULT_LOCALE, formatBytes } from '@mediaclear/i18n';
import { apiFetch, apiFetchChecked, translate, type ApiErrorShape } from '../../_lib/api';
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

interface JobOutput {
  outputAssetId: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  validated: boolean;
  createdAt: string;
}

interface JobPreview {
  mode: string;
  billable: boolean;
  operation: string;
  widthPx: number;
  heightPx: number;
  imageDataUri: string;
}

interface ProvenanceRow {
  originalMetadataPresence: string;
  aiProvenancePresence: string;
  limitationNote: string | null;
}

interface AudioRow {
  present: boolean;
  codec: string | null;
  durationSeconds: number | null;
  channelCount: number | null;
}

interface JobReceipt {
  receipt: {
    /* P5 (`D-075`). `null` = khong do duoc / khong ap dung. */
    metadataVerdict: string | null;
    metadataStrippedCategories: string[];
    disclosureState: string | null;
    disclosureLimitationKey: string | null;
    brandKitId: string | null;
    brandKitVersion: number | null;
    schemaVersion: number;
    operations: string[];
    evidenceStatus: string;
    /* P3: `null` voi bien nhan ANH cua Phase 2 — "khong ap dung", khong phai "chua do duoc". */
    operationMode: string | null;
    presetId: string | null;
    audioBefore: AudioRow | null;
    audioAfter: AudioRow | null;
    audioVerdict: string | null;
    outputVerified: boolean;
    reviewReason: string | null;
  };
  provenanceBefore: ProvenanceRow;
  provenanceAfter: ProvenanceRow | null;
}


export default function JobStatusPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const resource = useResource(() => apiFetchChecked(`/v1/jobs/${jobId}`, JOB_VIEW_SCHEMA), [jobId]);
  const [downloadError, setDownloadError] = useState<ApiErrorShape | null>(null);
  const [preview, setPreview] = useState<JobPreview | null>(null);
  const [previewError, setPreviewError] = useState<ApiErrorShape | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const jobState = resource.data?.job.state ?? null;
  /*
   * Chi hoi ban ket qua khi job DA xong. Hoi som hon thi chac chan 404 va se do mot loi
   * khong co that len man hinh cua nguoi dung.
   */
  const receipt = useResource<JobReceipt | null>(
    async () => (jobState === 'completed' ? apiFetchChecked(`/v1/jobs/${jobId}/receipt`, JOB_RECEIPT_SCHEMA) : { ok: true, data: null }),
    [jobId, jobState],
  );
  const output = useResource<JobOutput | null>(
    async () => (jobState === 'completed' ? apiFetchChecked(`/v1/jobs/${jobId}/output`, JOB_OUTPUT_SCHEMA) : { ok: true, data: null }),
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
  async function runPreview() {
    setPreviewError(null);
    setPreviewing(true);
    const result = await apiFetchChecked(`/v1/jobs/${jobId}/preview`, JOB_PREVIEW_SCHEMA, { method: 'POST' });
    setPreviewing(false);
    if (!result.ok) {
      setPreviewError(result.error);
      return;
    }
    setPreview(result.data);
  }

  async function download() {
    setDownloadError(null);
    const result = await apiFetchChecked(`/v1/jobs/${jobId}/output/download-url`, SIGNED_URL_SCHEMA);
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
  const needsReview = view.job.state === 'review_required';

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

      {/*
        * Xem truoc: chi co nghia khi job CHUA xong. Xong roi thi tep ket qua that co ich hon han
        * mot ban proxy do phan giai thap.
        */}
      {!isBlocked && !isCompleted ? (
        <Card title={translate('screen.job_status.preview_title')}>
          <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_status.preview_free')}</p>
          <Button variant="secondary" onClick={runPreview} disabled={previewing}>
            {translate('screen.job_status.preview_cta')}
          </Button>
          {previewError ? <ErrorNotice error={previewError} onRetry={runPreview} /> : null}
          {preview ? (
            <>
              {/*
                * Dung <img> chu khong phai next/image: anh nay la data URI nhung thang trong
                * response, khong co URL de Next toi uu. Quy tac `no-img-element` khong duoc nap
                * trong cau hinh eslint cua repo nen KHONG dat eslint-disable cho no - dat vao se
                * thanh loi "rule not found", da vap mot lan.
                */}
              <img
                src={preview.imageDataUri}
                alt={translate('screen.job_status.preview_title')}
                style={{ maxWidth: '100%', marginTop: 'var(--mcp-space-3)', borderRadius: 'var(--mcp-radius-sm)' }}
              />
              <p style={{ color: 'var(--mcp-text-secondary)' }}>
                {translate('screen.job_status.preview_proxy_note')} ({preview.widthPx}×{preview.heightPx})
              </p>
            </>
          ) : null}
        </Card>
      ) : null}

      {/*
        * `review_required`: da xu ly xong nhung KHONG khang dinh duoc ket qua dat. Phai noi ro
        * day KHONG phai "thanh cong" — de bai cam dung chu do cho truong hop nay.
        */}
      {needsReview ? (
        <Card title={translate('screen.job_status.review_required')}>
          <p role="alert" style={{ color: 'var(--mcp-warning)' }}>
            {translate('screen.job_status.review_note')}
          </p>
          {receipt.data?.receipt.audioVerdict && receipt.data.receipt.audioVerdict !== 'preserved' ? (
            <p style={{ color: 'var(--mcp-warning)' }}>{translate('screen.job_status.audio_warning')}</p>
          ) : null}
          {/*
            * `D-073` — bao "can ban xem lai" ma khong cho duong di den cho xem lai thi loi nhan do
            * vo dung. Man hinh `/jobs/:id/frames` (P4-MCP-42 + P4-MCP-44) da ton tai va chay dung,
            * nhung TRUOC dong nay khong mot lien ket nao trong ca ung dung tro toi no — chi go tay
            * URL moi vao duoc. Bam tay moi lo ra; toan bo test van xanh vi khong test nao hoi
            * "nguoi dung di toi day bang cach nao".
            */}
          <LinkButton href={`/jobs/${encodeURIComponent(jobId)}/frames`}>
            {translate('screen.job_status.review_cta')}
          </LinkButton>
        </Card>
      ) : null}

      {/*
        * Quay lai tep goc. O tang du lieu tep goc LUON con (I-1) va chay lai = job MOI (D-005),
        * nen day khong phai "hoan tac" — no la duong mo lai ban goc chua he bi dung toi.
        */}
      {/*
        ---------------- `P5-MCP-51` + `P5-MCP-54` ----------------

        Hai the rieng, khong gop vao bien nhan. Cong bo AI la thu nguoi dung di tim, va no co gioi
        han rieng PHAI noi ro — gop vao mot bang chung se lam cau gioi han do bien mat.
      */}
      {receipt.data?.receipt.metadataVerdict ? (
        <Card title={translate('screen.metadata.title')}>
          <DefinitionRow label={translate('screen.metadata.verdict')}>
            {translate(`metadata.verdict.${receipt.data.receipt.metadataVerdict}`)}
          </DefinitionRow>
          {receipt.data.receipt.metadataStrippedCategories.length > 0 ? (
            <>
              <DefinitionRow label={translate('screen.metadata.stripped')}>
                {receipt.data.receipt.metadataStrippedCategories
                  .map((c) => translate(`metadata.category.${c}`)).join(', ')}
              </DefinitionRow>
              <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.metadata.stripped_note')}</p>
            </>
          ) : null}
        </Card>
      ) : null}

      {receipt.data?.receipt.disclosureState ? (
        <Card title={translate('provenance.node.disclosure')}>
          <DefinitionRow label={translate('screen.job_status.title')}>
            {translate(`disclosure.state.${receipt.data.receipt.disclosureState}`)}
          </DefinitionRow>
          {/*
            Cau GIOI HAN luon hien, khong an sau mot nut "xem them". Mot ket luan ve AI ma nguoi doc
            khong thay gioi han cua no se duoc hieu la chac chan — va o day khong ket luan nao chac chan.
          */}
          {receipt.data.receipt.disclosureLimitationKey ? (
            <p style={{ color: 'var(--mcp-warning)' }}>
              {translate(receipt.data.receipt.disclosureLimitationKey)}
            </p>
          ) : null}
          {receipt.data.receipt.brandKitId ? (
            <DefinitionRow label={translate('screen.brand.title')}>
              {`${receipt.data.receipt.brandKitId} · ${receipt.data.receipt.brandKitVersion ?? '—'}`}
            </DefinitionRow>
          ) : (
            <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.brand.not_applied')}</p>
          )}
        </Card>
      ) : null}

      {/* Duong di toi lich su cua tep — mot man hinh khong co loi vao thi voi nguoi dung no khong ton tai. */}
      <Card title={translate('screen.provenance.history_title')}>
        <LinkButton href={`/assets/${encodeURIComponent(view.job.assetId)}/provenance`}>
          {translate('screen.provenance.history_title')}
        </LinkButton>
      </Card>

      <Card title={translate('screen.job_status.reset_title')}>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_status.reset_note')}</p>
        <LinkButton href={`/assets/${view.job.assetId}`}>{translate('screen.job_status.reset_cta')}</LinkButton>
      </Card>

      {/*
        * Bien nhan. Hien CA phan chua do duoc - giau di se khien nguoi dung tuong moi thu deu da
        * duoc kiem chung.
        */}
      {receipt.data ? (
        <Card title={translate('screen.job_status.receipt_title')}>
          <DefinitionRow label={translate('screen.job_status.receipt_operations')}>
            {receipt.data.receipt.operations.map((op) => translate(`operation.${op}`)).join(', ')}
          </DefinitionRow>
          <DefinitionRow label={translate('screen.job_status.receipt_evidence')}>
            <EvidenceBadge status={receipt.data.receipt.evidenceStatus} />
          </DefinitionRow>
          {/* P3: chi hien khi la luot xu ly VIDEO. Bien nhan anh khong co nhung dong nay. */}
          {receipt.data.receipt.operationMode ? (
            <DefinitionRow label={translate('screen.job_status.mode')}>
              {translate(`screen.video.mode_${receipt.data.receipt.operationMode}`)}
            </DefinitionRow>
          ) : null}
          {receipt.data.receipt.presetId ? (
            <DefinitionRow label={translate('screen.job_status.preset')}>
              {translate(`preset.${receipt.data.receipt.presetId}`)}
            </DefinitionRow>
          ) : null}
          {receipt.data.receipt.audioBefore ? (
            <DefinitionRow label={translate('screen.job_status.audio_before')}>
              {translate(receipt.data.receipt.audioBefore.present ? 'audio.present' : 'audio.absent')}
            </DefinitionRow>
          ) : null}
          {receipt.data.receipt.audioAfter ? (
            <DefinitionRow label={translate('screen.job_status.audio_after')}>
              {translate(receipt.data.receipt.audioAfter.present ? 'audio.present' : 'audio.absent')}
            </DefinitionRow>
          ) : null}
          <DefinitionRow label={translate('screen.job_status.receipt_metadata_before')}>
            {translate(`presence.${receipt.data.provenanceBefore.originalMetadataPresence}`)}
          </DefinitionRow>
          <DefinitionRow label={translate('screen.job_status.receipt_metadata_after')}>
            {receipt.data.provenanceAfter
              ? translate(`presence.${receipt.data.provenanceAfter.originalMetadataPresence}`)
              : translate('common.unknown_value')}
          </DefinitionRow>
          {receipt.data.provenanceBefore.limitationNote ? (
            <DefinitionRow label={translate('screen.job_status.receipt_limitation')}>
              {/* Truong nay chua KHOA i18n, khong phai cau chu. In thang se ra chuoi khong dau. */}
              <span style={{ color: 'var(--mcp-warning)' }}>
                {translate(receipt.data.provenanceBefore.limitationNote)}
              </span>
            </DefinitionRow>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
