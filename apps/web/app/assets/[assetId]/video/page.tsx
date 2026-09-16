'use client';

/**
 * Man hinh lam sach VIDEO (P3-MCP-30…34).
 *
 * Moi phan hoi tu may chu deu di qua `apiFetchChecked` — kiem LUC CHAY bang chinh lich kiem ma
 * may chu dung (D-051). Khong co `interface` nao tu khai lai o day: kieu den tu `@mediaclear/contracts`.
 */
import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  PRESET_LIST_SCHEMA,
  VIDEO_OPERATION_MODES,
  VIDEO_PROXY_SCHEMA,
  validateRegion,
  type ExportPreset,
  type Region,
  type VideoOperationMode,
} from '@mediaclear/contracts';
import { apiFetch, apiFetchChecked, translate, type ApiErrorShape } from '../../../_lib/api';
import { useResource } from '../../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Field, Loading, PageTitle } from '../../../_components/Ui';

/** Thao tac cua he thong tuong ung voi tung che do. `mask` = `brand_overlay` (Q-15). */
const OPERATION_OF: Record<VideoOperationMode, string> = {
  mask: 'brand_overlay',
  blur: 'blur',
  crop: 'crop',
};

export default function VideoCleanupPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;

  const [mode, setMode] = useState<VideoOperationMode>('mask');
  const [presetId, setPresetId] = useState<string>('');
  const [region, setRegion] = useState<Region>({
    x: 0.05, y: 0.05, width: 0.3, height: 0.15, startSeconds: null, endSeconds: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [startedJobId, setStartedJobId] = useState<string | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);

  const proxy = useResource(
    () => apiFetchChecked(`/v1/assets/${assetId}/proxy`, VIDEO_PROXY_SCHEMA),
    [assetId],
  );
  const presets = useResource(() => apiFetchChecked('/v1/export-presets', PRESET_LIST_SCHEMA), []);

  const regionProblems = validateRegion(region);
  // `crop` cat theo ti le nen KHONG can vung; hai che do kia thi can.
  const regionRequired = mode !== 'crop';
  const canStart = !busy && proxy.data !== null && (!regionRequired || regionProblems.length === 0);

  /**
   * Lay URL DA KY roi moi gan vao <video>. URL nay co han ngan nen chi duc khi nguoi dung muon
   * xem — duc san luc mo trang thi den luc bam co the da het han.
   */
  async function loadPlayUrl() {
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ url: string }>(`/v1/assets/${assetId}/proxy/download-url`);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPlayUrl(result.data.url);
  }

  async function createProxy() {
    setBusy(true);
    setError(null);
    const result = await apiFetchChecked(`/v1/assets/${assetId}/proxy`, VIDEO_PROXY_SCHEMA, { method: 'POST' });
    setBusy(false);
    if (!result.ok) setError(result.error);
    else {
      setPlayUrl(null);
      proxy.reload();
    }
  }

  async function startJob() {
    setBusy(true);
    setError(null);
    const result = await apiFetch<{ job: { id: string } }>(`/v1/assets/${assetId}/jobs`, {
      method: 'POST',
      body: {
        operations: [OPERATION_OF[mode]],
        regions: regionRequired ? [region] : [],
        presetId: presetId.length > 0 ? presetId : null,
        idempotencyKey: `video-${assetId}-${mode}-${Date.now()}`,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStartedJobId(result.data.job.id);
  }

  function updateRegion(field: 'x' | 'y' | 'width' | 'height', raw: string) {
    const value = Number(raw);
    setRegion((current) => ({ ...current, [field]: Number.isFinite(value) ? value / 100 : 0 }));
  }

  const percent = (n: number): string => String(Math.round(n * 100));

  return (
    <>
      <PageTitle>{translate('screen.video.title')}</PageTitle>

      <Card title={translate('screen.video.proxy_title')}>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.video.proxy_note')}</p>
        {proxy.status === 'loading' ? <Loading /> : null}
        {proxy.data ? (
          <>
            <DefinitionRow label={translate('screen.video.region_title')}>
              {proxy.data.widthPx}×{proxy.data.heightPx}
            </DefinitionRow>
            <p>
              {proxy.data.hasAudio
                ? translate('screen.video.audio_kept')
                : translate('screen.video.audio_none')}
            </p>
            {/*
              * Dung <video> voi `controls` de nguoi dung NGHE duoc: xem truoc ma khong nghe thi
              * khong kiem duoc tieng con nguyen hay khong.
              *
              * `src` phai la URL DA KY tra ve tu `/proxy/download-url`, KHONG phai chinh duong dan
              * do. Ban dau toi tro thang vao route va trinh duyet bao "Unable to play media" — vi
              * route do tra JSON chua URL, khong tra byte video. Chi bam tay moi thay.
              */}
            {playUrl ? (
              <video
                controls
                preload="metadata"
                src={playUrl}
                style={{ maxWidth: '100%', borderRadius: 'var(--mcp-radius-sm)' }}
                aria-label={translate('screen.video.proxy_title')}
              />
            ) : (
              <Button variant="secondary" onClick={loadPlayUrl} disabled={busy}>
                {translate('screen.video.proxy_play')}
              </Button>
            )}
          </>
        ) : (
          <>
            <p>{translate('screen.video.proxy_missing')}</p>
            <Button onClick={createProxy} disabled={busy}>
              {translate('screen.video.proxy_create')}
            </Button>
          </>
        )}
      </Card>

      <Card title={translate('screen.video.mode_title')}>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.video.mode_note')}</p>
        {/* `radiogroup` de trinh doc man hinh doc duoc day la MOT lua chon trong ba. */}
        <div role="radiogroup" aria-label={translate('screen.video.mode_title')}>
          {VIDEO_OPERATION_MODES.map((option) => (
            <label
              key={option}
              style={{ display: 'block', padding: '6px 0', cursor: 'pointer' }}
            >
              <input
                type="radio"
                name="video-mode"
                value={option}
                checked={mode === option}
                onChange={() => setMode(option)}
                style={{ marginRight: 'var(--mcp-space-2)' }}
              />
              {translate(`screen.video.mode_${option}`)}
            </label>
          ))}
        </div>
        <DefinitionRow label={translate('screen.video.mode_selected')}>
          {translate(`screen.video.mode_${mode}`)}
        </DefinitionRow>
        {mode === 'mask' ? (
          // Noi thang gioi han that: static mask KHONG bam chuyen dong.
          <p style={{ color: 'var(--mcp-warning)' }}>{translate('screen.video.mask_limit')}</p>
        ) : null}
      </Card>

      {regionRequired ? (
        <Card title={translate('screen.video.region_title')}>
          <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.video.region_note')}</p>
          <Field name="region-x" type="number" label={translate('screen.video.region_x')} value={percent(region.x)} onChange={(v) => updateRegion('x', v)} />
          <Field name="region-y" type="number" label={translate('screen.video.region_y')} value={percent(region.y)} onChange={(v) => updateRegion('y', v)} />
          <Field name="region-width" type="number" label={translate('screen.video.region_w')} value={percent(region.width)} onChange={(v) => updateRegion('width', v)} />
          <Field name="region-height" type="number" label={translate('screen.video.region_h')} value={percent(region.height)} onChange={(v) => updateRegion('height', v)} />
          {regionProblems.length > 0 ? (
            <p role="alert" style={{ color: 'var(--mcp-danger)' }}>
              {translate('screen.video.region_invalid')}
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card title={translate('screen.video.preset_title')}>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.video.preset_note')}</p>
        <div role="radiogroup" aria-label={translate('screen.video.preset_title')}>
          <label style={{ display: 'block', padding: '6px 0', cursor: 'pointer' }}>
            <input
              type="radio"
              name="video-preset"
              checked={presetId === ''}
              onChange={() => setPresetId('')}
              style={{ marginRight: 'var(--mcp-space-2)' }}
            />
            {translate('screen.video.preset_none')}
          </label>
          {(presets.data?.presets ?? []).map((preset: ExportPreset) => (
            <label key={preset.id} style={{ display: 'block', padding: '6px 0', cursor: 'pointer' }}>
              <input
                type="radio"
                name="video-preset"
                checked={presetId === preset.id}
                onChange={() => setPresetId(preset.id)}
                style={{ marginRight: 'var(--mcp-space-2)' }}
              />
              {translate(preset.label)} · {preset.aspectRatio}{' '}
              {/* Trang thai bang chung hien THANG canh preset: khong giau la chua kiem duoc. */}
              <span style={{ color: 'var(--mcp-text-secondary)' }}>
                ({translate(`evidence.${preset.status}`)})
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        {error ? <ErrorNotice error={error} /> : null}
        {startedJobId ? (
          <p role="status">
            <a href={`/jobs/${startedJobId}`}>{translate('screen.job_status.title')}</a>
          </p>
        ) : (
          <Button onClick={startJob} disabled={!canStart}>
            {translate('screen.video.start')}
          </Button>
        )}
      </Card>
    </>
  );
}
