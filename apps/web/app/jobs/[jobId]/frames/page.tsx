'use client';

/**
 * Man hinh Phase 4 — gop CA HAI workstream giao dien:
 *
 *  - `P4-MCP-42`: chon khung hinh can xem lai va sua vung che bang tay.
 *  - `P4-MCP-44`: hien RO vi sao yeu cau chua tai ve duoc, va khoa nut tai ve khi chua qua cong.
 *
 * De chung mot man hinh co chu dinh: hai viec do la MOT viec doi voi nguoi dung — "vi sao chua
 * xong, va toi phai sua gi". Tach thanh hai trang se bat ho nho so lieu o trang nay de hieu trang kia.
 */
import { FRAME_TRACKING_VIEW_SCHEMA, type FrameTrackingView } from '@mediaclear/contracts';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PRIMITIVE_COLORS } from '@mediaclear/design-tokens';
import { apiFetchChecked, translate, type ApiErrorShape } from '../../../_lib/api';
import { useResource } from '../../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Field, Loading, PageTitle, StateBadge } from '../../../_components/Ui';

type Frame = FrameTrackingView['frames'][number];

/** Mau theo trang thai. Khong dung mau duy nhat: mat phai phan biet duoc ngay cai nao can sua. */
function frameColor(state: Frame['state']): string {
  if (state === 'frame_failed') return PRIMITIVE_COLORS.danger;
  if (state === 'frame_low_confidence' || state === 'frame_review_required') return PRIMITIVE_COLORS.warning;
  if (state === 'frame_correction_applied') return PRIMITIVE_COLORS.primary;
  return PRIMITIVE_COLORS.success;
}

/** Toa do chuan hoa [0,1] — CUNG he voi may chu, khong doi don vi o giao dien. */
function boxValid(b: { x: number; y: number; width: number; height: number }): boolean {
  const ok = [b.x, b.y, b.width, b.height].every((n) => Number.isFinite(n));
  return ok && b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1 && b.y + b.height <= 1;
}

export default function FrameReviewPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId;
  const resource = useResource(
    () => apiFetchChecked(`/v1/jobs/${encodeURIComponent(jobId)}/frames`, FRAME_TRACKING_VIEW_SCHEMA),
    [jobId],
  );

  const [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState({ x: '0', y: '0', width: '0.2', height: '0.2' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  const view = resource.status === 'ready' ? resource.data : null;
  const frame = view?.frames.find((f) => f.index === selected) ?? null;

  // Khi doi khung hinh, nap lai vung che HIEN CO de nguoi dung sua tu do, khong go lai tu dau.
  useEffect(() => {
    if (!frame?.box) return;
    setDraft({
      x: String(frame.box.x), y: String(frame.box.y),
      width: String(frame.box.width), height: String(frame.box.height),
    });
  }, [frame?.index, frame?.box]);

  const parsed = {
    x: Number(draft.x), y: Number(draft.y), width: Number(draft.width), height: Number(draft.height),
  };
  const valid = boxValid(parsed);

  async function save(): Promise<void> {
    if (!frame || !valid) return;
    setSaving(true);
    setError(null);
    const result = await apiFetchChecked(
      `/v1/jobs/${encodeURIComponent(jobId)}/frames/${frame.index}/correction`,
      FRAME_TRACKING_VIEW_SCHEMA,
      { method: 'POST', body: { box: parsed } },
    );
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    resource.reload();
  }

  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error' && resource.error) {
    return (
      <>
        <PageTitle>{translate('screen.frames.title')}</PageTitle>
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
      </>
    );
  }
  if (!view) {
    return (
      <>
        <PageTitle>{translate('screen.frames.title')}</PageTitle>
        <Card><p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.frames.empty')}</p></Card>
      </>
    );
  }

  const t = view.timeline;
  // Cong chan: chi cho tai ve khi gate noi `completed`. Khong bao gio suy tu "trong co ve xong".
  const canExport = view.gate.verdict === 'completed';

  return (
    <>
      <PageTitle>{translate('screen.frames.title')}</PageTitle>

      {/* ---------------- P4-MCP-44: vi sao chua xong ---------------- */}
      <Card title={translate('screen.quality.title')}>
        <div style={{ marginBottom: 'var(--mcp-space-3)' }}><StateBadge state={view.jobState} /></div>

        <DefinitionRow label={translate('screen.frames.total')}>{t.expectedFrameCount}</DefinitionRow>
        <DefinitionRow label={translate('screen.frames.tracked')}>{t.ok}</DefinitionRow>
        <DefinitionRow label={translate('screen.frames.low_confidence')}>{t.lowConfidence}</DefinitionRow>
        <DefinitionRow label={translate('screen.frames.review')}>{t.reviewRequired}</DefinitionRow>
        <DefinitionRow label={translate('screen.frames.failed')}>{t.failed}</DefinitionRow>
        {/*
          Hien SO khung hinh con thieu, khong chi mot nhan chung. "Thieu 3 khung hinh" la thu nguoi
          dung lam duoc gi do voi no; "co loi" thi khong.
        */}
        <DefinitionRow label={translate('screen.frames.missing')}>{t.missing}</DefinitionRow>

        {view.gate.reasons.length > 0 ? (
          <ul aria-label={translate('screen.quality.export_blocked')} style={{ marginTop: 'var(--mcp-space-4)' }}>
            {view.gate.reasons.map((reason) => (
              <li key={reason} style={{ color: PRIMITIVE_COLORS.warning }}>
                {translate(`gate_reason.${reason}`)} — {view.gate.counts[reason]}
              </li>
            ))}
          </ul>
        ) : null}

        <div style={{ marginTop: 'var(--mcp-space-4)' }}>
          <Button
            variant="primary"
            disabled={!canExport}
            onClick={() => { window.location.href = `/jobs/${encodeURIComponent(jobId)}`; }}
          >
            {canExport ? translate('screen.quality.export') : translate('screen.quality.export_blocked')}
          </Button>
        </div>
      </Card>

      {/* ---------------- P4-MCP-42: chon va sua khung hinh ---------------- */}
      <Card title={translate('screen.frames.pick')}>
        <ul
          style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mcp-space-2)', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {view.frames.map((f) => (
            <li key={f.index}>
              <button
                type="button"
                onClick={() => setSelected(f.index)}
                aria-pressed={selected === f.index}
                /* Nhan cho trinh doc man hinh: so khung hinh + trang thai, khong chi mot con so. */
                aria-label={`${translate('screen.frames.frame_label')} ${f.index} — ${translate(`frame_state.${f.state}`)}`}
                style={{
                  minWidth: 44, minHeight: 44,
                  background: selected === f.index ? PRIMITIVE_COLORS.surface : 'transparent',
                  color: PRIMITIVE_COLORS.textPrimary,
                  border: `2px solid ${frameColor(f.state)}`,
                  borderRadius: 'var(--mcp-radius-sm)',
                  cursor: 'pointer',
                }}
              >
                {f.index}
              </button>
            </li>
          ))}
        </ul>

        {frame ? (
          <div style={{ marginTop: 'var(--mcp-space-5)' }}>
            <DefinitionRow label={translate('screen.frames.review')}>
              {translate(`frame_state.${frame.state}`)}
            </DefinitionRow>
            <DefinitionRow label={translate('screen.frames.source')}>
              {translate(`mask_source.${frame.source}`)}
            </DefinitionRow>
            <DefinitionRow label={translate('screen.frames.confidence')}>
              {frame.confidence === null ? translate('evidence.unknown') : frame.confidence.toFixed(2)}
            </DefinitionRow>
            <DefinitionRow label={translate('screen.frames.before')}>
              {frame.box
                ? `${frame.box.x.toFixed(3)} · ${frame.box.y.toFixed(3)} · ${frame.box.width.toFixed(3)} · ${frame.box.height.toFixed(3)}`
                : translate('evidence.unknown')}
            </DefinitionRow>

            {/*
              Khung hinh KHONG doc duoc tu tep goc: noi that. Sua tay chi ghi lai vung nguoi dung
              chon, no khong khoi phuc duoc hinh anh da hong — giao dien khong duoc de nguoi dung
              tuong minh vua "sua xong" mot khung hinh khong ton tai.
            */}
            {frame.state === 'frame_failed' ? (
              <p style={{ color: PRIMITIVE_COLORS.warning }}>{translate('screen.frames.decode_failed_note')}</p>
            ) : null}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--mcp-space-3)' }}>
              {(['x', 'y', 'width', 'height'] as const).map((key) => (
                <Field
                  key={key}
                  name={`box-${key}`}
                  /* Nhan cho NGUOI DOC, khong phai ten truong trong ma. */
                  label={translate(`field.box_${key}`)}
                  value={draft[key]}
                  onChange={(v) => setDraft((d) => ({ ...d, [key]: v }))}
                />
              ))}
            </div>

            {!valid ? <p style={{ color: PRIMITIVE_COLORS.danger }}>{translate('screen.frames.invalid')}</p> : null}
            {error ? <ErrorNotice error={error} /> : null}

            {/* Nut bi KHOA khi so nhap khong hop le — chan loi ngay tai cho nhap, khong doi may chu. */}
            <Button onClick={save} disabled={!valid || saving}>
              {saving ? translate('screen.frames.saving') : translate('screen.frames.save')}
            </Button>
          </div>
        ) : null}
      </Card>
    </>
  );
}
