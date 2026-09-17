'use client';

import { ASSET_VIEW_SCHEMA, UPLOAD_INTENT_SCHEMA, VALIDATION_RESULT_SCHEMA } from '@mediaclear/contracts';
import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetchChecked, apiUpload, fetchHealth, translate, type ApiErrorShape } from '../../../_lib/api';
import { friendlyTypeList } from '../../../_lib/media-format';
import { FilePicker } from '../../../_components/FilePicker';
import { DEFAULT_LOCALE, formatBytes, formatDuration } from '@mediaclear/i18n';
import { useResource } from '../../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Loading, PageTitle, ValueOrUnknown, LinkButton } from '../../../_components/Ui';


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
    const intent = await apiFetchChecked(`/v1/projects/${projectId}/assets/upload-intent`, UPLOAD_INTENT_SCHEMA, {
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
    const checked = await apiFetchChecked(`/v1/assets/${intent.data.assetId}/validate`, VALIDATION_RESULT_SCHEMA, { method: 'POST' });
    if (!checked.ok) {
      setStep('idle');
      setError(checked.error);
      return;
    }
    const view = await apiFetchChecked(`/v1/assets/${intent.data.assetId}`, ASSET_VIEW_SCHEMA);
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
            <DefinitionRow label={translate('field.max_file_size')}>
              {Math.round(limits.maxFileBytes / (1024 * 1024))} MB
            </DefinitionRow>
            <DefinitionRow label={translate('field.video_limits')}>
              {Math.floor(limits.maxVideoDurationSeconds / 60)}:
              {String(limits.maxVideoDurationSeconds % 60).padStart(2, '0')} · {limits.maxVideoWidthPx} × {limits.maxVideoHeightPx} px
            </DefinitionRow>
            {/* Ten dinh dang cho NGUOI DOC, khong phai chuoi may `image/jpeg`. */}
            <DefinitionRow label={translate('field.accepted_types')}>
              {friendlyTypeList([...limits.imageMimeTypes, ...limits.videoMimeTypes])}
            </DefinitionRow>
          </>
        ) : (
          <Loading />
        )}
      </Card>

      <Card>
        <label style={{ display: 'block', marginBottom: 'var(--mcp-space-4)' }}>
          <span style={{ display: 'block', marginBottom: 'var(--mcp-space-2)' }}>{translate('screen.asset_upload.choose_file')}</span>
          <FilePicker
            inputRef={fileInput}
            accept={limits ? [...limits.imageMimeTypes, ...limits.videoMimeTypes].join(',') : undefined}
          />
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
              <DefinitionRow label={translate('field.frame_size')}>
                <ValueOrUnknown value={measured.widthPx} /> × <ValueOrUnknown value={measured.heightPx} /> px
              </DefinitionRow>
              <DefinitionRow label={translate('field.duration')}>
                {measured.durationSeconds === null
                  ? <ValueOrUnknown value={null} />
                  : formatDuration(DEFAULT_LOCALE, measured.durationSeconds)}
              </DefinitionRow>
              {/* `formatBytes` da co san; hien so byte tho la bat nguoi dung tu doi don vi. */}
              <DefinitionRow label={translate('field.file_size')}>
                {measured.byteSize === null
                  ? <ValueOrUnknown value={null} />
                  : formatBytes(DEFAULT_LOCALE, measured.byteSize)}
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
