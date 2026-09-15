'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch, apiUpload, fetchHealth, translate, type ApiErrorShape } from '../../../_lib/api';
import { useResource } from '../../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Loading, PageTitle, ValueOrUnknown, LinkButton } from '../../../_components/Ui';

interface UploadIntent {
  assetId: string;
  sourceFileId: string;
  uploadUrl: string;
}

interface ValidationResponse {
  assetId: string;
  valid: boolean;
  errors: ApiErrorShape[];
}

interface AssetView {
  sourceFile: {
    measured: null | { widthPx: number | null; heightPx: number | null; durationSeconds: number | null; byteSize: number };
  };
}

type Step = 'idle' | 'uploading' | 'checking' | 'done';

export default function UploadPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [measured, setMeasured] = useState<AssetView['sourceFile']['measured']>(null);

  // Gioi han hien thi LAY TU may chu (cung mot config), khong go tay o UI.
  const health = useResource(() => fetchHealth(), []);

  async function submit() {
    const file = fileInput.current?.files?.[0];
    setError(null);
    setValidation(null);
    if (!file) {
      setError({ code: 'UI_REQUIRED', messageKey: 'common.required_field' });
      return;
    }
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

    setStep('uploading');
    const intent = await apiFetch<UploadIntent>(`/v1/projects/${projectId}/assets/upload-intent`, {
      method: 'POST',
      body: { originalFilename: file.name, mimeType: file.type, mediaType, byteSize: file.size },
    });
    if (!intent.ok) {
      setStep('idle');
      setError(intent.error);
      return;
    }
    const uploaded = await apiUpload(intent.data.uploadUrl, file);
    if (!uploaded.ok) {
      setStep('idle');
      setError(uploaded.error);
      return;
    }

    setStep('checking');
    const checked = await apiFetch<ValidationResponse>(`/v1/assets/${intent.data.assetId}/validate`, { method: 'POST' });
    if (!checked.ok) {
      setStep('idle');
      setError(checked.error);
      return;
    }
    const view = await apiFetch<AssetView>(`/v1/assets/${intent.data.assetId}`);
    setAssetId(intent.data.assetId);
    setValidation(checked.data);
    setMeasured(view.ok ? view.data.sourceFile.measured : null);
    setStep('done');
  }

  const limits = health.status === 'ready' && health.data ? health.data.limits : null;

  return (
    <>
      <PageTitle>{translate('screen.asset_upload.title')}</PageTitle>

      <Card title={translate('screen.asset_upload.limits_title')}>
        {limits ? (
          <>
            <DefinitionRow label={translate('screen.asset_upload.limits_title')}>
              {Math.round(limits.maxFileBytes / (1024 * 1024))} MB
            </DefinitionRow>
            <DefinitionRow label="Video">
              {Math.floor(limits.maxVideoDurationSeconds / 60)}:
              {String(limits.maxVideoDurationSeconds % 60).padStart(2, '0')} · {limits.maxVideoWidthPx} × {limits.maxVideoHeightPx} px
            </DefinitionRow>
            <DefinitionRow label="MIME">{[...limits.imageMimeTypes, ...limits.videoMimeTypes].join(', ')}</DefinitionRow>
          </>
        ) : (
          <Loading />
        )}
      </Card>

      <Card>
        <label style={{ display: 'block', marginBottom: 'var(--mcp-space-4)' }}>
          <span style={{ display: 'block', marginBottom: 'var(--mcp-space-2)' }}>{translate('screen.asset_upload.choose_file')}</span>
          <input ref={fileInput} type="file" name="file" style={{ minHeight: 44 }} />
        </label>
        <Button onClick={submit} disabled={step === 'uploading' || step === 'checking'}>
          {step === 'uploading'
            ? translate('screen.asset_upload.uploading')
            : step === 'checking'
              ? translate('screen.asset_upload.checking')
              : translate('screen.asset_upload.submit')}
        </Button>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.asset_upload.original_kept')}</p>
        {error ? <ErrorNotice error={error} /> : null}
      </Card>

      {validation ? (
        <Card title={translate('screen.upload_validation.title')}>
          <p style={{ color: validation.valid ? 'var(--mcp-success)' : 'var(--mcp-danger)' }}>
            {validation.valid ? translate('screen.upload_validation.result_pass') : translate('screen.upload_validation.result_fail')}
          </p>

          {measured ? (
            <>
              <h3 style={{ fontSize: 'var(--mcp-font-size-md)' }}>{translate('screen.upload_validation.measured_title')}</h3>
              <DefinitionRow label="px">
                <ValueOrUnknown value={measured.widthPx} /> × <ValueOrUnknown value={measured.heightPx} />
              </DefinitionRow>
              <DefinitionRow label="giây">
                <ValueOrUnknown value={measured.durationSeconds === null ? null : Math.round(measured.durationSeconds)} />
              </DefinitionRow>
              <DefinitionRow label="byte">
                <ValueOrUnknown value={measured.byteSize} />
              </DefinitionRow>
            </>
          ) : null}

          {validation.errors.length > 0 ? (
            <ul>
              {validation.errors.map((item) => (
                <li key={item.code} style={{ color: 'var(--mcp-danger)' }}>
                  {translate(item.messageKey, item.params)}
                </li>
              ))}
            </ul>
          ) : null}

          <p>{validation.valid ? translate('screen.upload_validation.next_step_attest') : translate('screen.upload_validation.next_step_fix')}</p>
          {validation.valid && assetId ? (
            <LinkButton href={`/assets/${assetId}`}>{translate('common.continue')}</LinkButton>
          ) : null}
        </Card>
      ) : null}
    </>
  );
}
