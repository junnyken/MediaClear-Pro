'use client';

/**
 * `P5-MCP-53` — bo nhan dien thuong hieu.
 *
 * Man hinh nay phai noi ro MOT dieu de nguoi dung khong hieu nham: tao mot bo nhan dien KHONG lam
 * ban xuat tu dong mang lop phu. Lop phu la opt-in tung lan xuat (`P5-MCP-54`).
 *
 * Va: sua KHONG ghi de. Moi lan luu la mot PHIEN BAN moi, va lich su phien ban hien ngay tren man
 * hinh — de nguoi dung thay rang ban xuat cu van tro toi dung cai da duoc ap dung.
 */
import { BRAND_KIT_LIST_SCHEMA, BRAND_KIT_SCHEMA, OVERLAY_POSITIONS, validateBrandKitDraft } from '@mediaclear/contracts';
import { useState } from 'react';
import { PRIMITIVE_COLORS } from '@mediaclear/design-tokens';
import { apiFetchChecked, translate, type ApiErrorShape } from '../_lib/api';
import { useResource } from '../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, Field, Loading, PageTitle } from '../_components/Ui';

type Position = (typeof OVERLAY_POSITIONS)[number];

export default function BrandKitsPage() {
  const resource = useResource(() => apiFetchChecked('/v1/brand-kits', BRAND_KIT_LIST_SCHEMA), []);
  const [name, setName] = useState('');
  const [colorsText, setColorsText] = useState('');
  const [position, setPosition] = useState<Position>('bottom_right');
  const [opacity, setOpacity] = useState('0.5');
  const [includeDisclosure, setIncludeDisclosure] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);

  /*
   * Tach theo DAU PHAY hoac KHOANG TRANG.
   *
   * Ban dau o day tach theo xuong dong, va cau huong dan noi "moi mau mot dong" — nhung o nhap la
   * mot dong DUY NHAT, nen ky tu xuong dong bi bo va hai ma mau dinh lien thanh `#5B8CFF#35D0A1`.
   * Nut luu khoa vinh vien ma nguoi dung khong hieu vi sao. Chi bam tay moi lo ra.
   */
  const colors = colorsText.split(/[\s,]+/).map((c) => c.trim()).filter((c) => c.length > 0);
  const draft = {
    name,
    colors,
    overlayDefaults: { position, opacity: Number(opacity), includeDisclosure },
  };
  /* Dung CHINH ham kiem cua may chu — hai ben tu kiem lay se lech nhau (`D-047`). */
  const errors = validateBrandKitDraft(draft);
  const valid = errors.length === 0;

  async function save(): Promise<void> {
    if (!valid) return;
    setSaving(true);
    setError(null);
    const result = await apiFetchChecked('/v1/brand-kits', BRAND_KIT_SCHEMA, {
      method: 'POST',
      body: { ...draft, logoAssetId: null },
    });
    setSaving(false);
    if (!result.ok) { setError(result.error); return; }
    setName('');
    setColorsText('');
    resource.reload();
  }

  async function setState(id: string, state: 'active' | 'archived'): Promise<void> {
    const result = await apiFetchChecked(
      `/v1/brand-kits/${encodeURIComponent(id)}/state`, BRAND_KIT_SCHEMA,
      { method: 'POST', body: { state } },
    );
    if (!result.ok) { setError(result.error); return; }
    resource.reload();
  }

  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error' && resource.error) {
    return (
      <>
        <PageTitle>{translate('screen.brand.title')}</PageTitle>
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
      </>
    );
  }
  const items = resource.data?.items ?? [];

  return (
    <>
      <PageTitle>{translate('screen.brand.title')}</PageTitle>

      <Card title={translate('screen.brand.create')}>
        {/* Cau nay phai o NGAY cho tao, khong nam cuoi trang: no sua mot hieu nham co that. */}
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.brand.not_applied')}</p>

        <Field name="brand-name" label={translate('screen.brand.name')} value={name} onChange={setName} />
        <Field
          name="brand-colors"
          label={translate('screen.brand.colors')}
          value={colorsText}
          onChange={setColorsText}
        />
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.brand.colors_hint')}</p>

        <label style={{ display: 'block', marginTop: 'var(--mcp-space-3)' }}>
          <span style={{ display: 'block', color: 'var(--mcp-text-secondary)' }}>
            {translate('screen.brand.position')}
          </span>
          <select
            value={position}
            onChange={(e) => setPosition(e.target.value as Position)}
            style={{
              minHeight: 44, width: '100%', background: PRIMITIVE_COLORS.surface,
              color: PRIMITIVE_COLORS.textPrimary, border: `1px solid ${PRIMITIVE_COLORS.textSecondary}`,
              borderRadius: 'var(--mcp-radius-sm)', padding: 'var(--mcp-space-2)',
            }}
          >
            {OVERLAY_POSITIONS.map((p) => (
              <option key={p} value={p}>{translate(`overlay.position.${p}`)}</option>
            ))}
          </select>
        </label>

        <Field name="brand-opacity" label={translate('screen.brand.opacity')} value={opacity} onChange={setOpacity} />

        <label style={{ display: 'flex', gap: 'var(--mcp-space-2)', alignItems: 'center', minHeight: 44 }}>
          <input
            type="checkbox"
            checked={includeDisclosure}
            onChange={(e) => setIncludeDisclosure(e.target.checked)}
          />
          <span>{translate('screen.brand.include_disclosure')}</span>
        </label>

        {!valid ? <p style={{ color: PRIMITIVE_COLORS.danger }}>{translate('screen.brand.invalid')}</p> : null}
        {error ? <ErrorNotice error={error} /> : null}

        <Button onClick={save} disabled={!valid || saving}>
          {saving ? translate('screen.brand.saving') : translate('screen.brand.create')}
        </Button>
      </Card>

      {items.length === 0 ? (
        <Card><p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.brand.empty')}</p></Card>
      ) : null}

      {items.map((kit) => (
        <Card key={kit.id} title={kit.versions[kit.versions.length - 1]?.name ?? kit.id}>
          <DefinitionRow label={translate('screen.brand.current_version')}>{kit.currentVersion}</DefinitionRow>
          <DefinitionRow label={translate('screen.brand.state')}>
            {translate(`brand_kit.state.${kit.state}`)}
          </DefinitionRow>

          {/*
            Lich su phien ban hien NGAY tren man hinh. Day khong phai chi tiet ky thuat: no la thu
            cho nguoi dung thay rang sua mot bo nhan dien khong lam doi ban xuat da phat hanh.
          */}
          <h3 style={{ fontSize: 'var(--mcp-font-size-md)' }}>{translate('screen.brand.versions')}</h3>
          <ul style={{ margin: 0, paddingLeft: 'var(--mcp-space-5)' }}>
            {kit.versions.map((v) => (
              <li key={v.version}>
                {v.version} · {v.name} · {translate(`overlay.position.${v.overlayDefaults.position}`)}
                {v.colors.length > 0 ? ` · ${v.colors.join(' ')}` : ''}
              </li>
            ))}
          </ul>

          <Button
            variant="secondary"
            onClick={() => setState(kit.id, kit.state === 'active' ? 'archived' : 'active')}
          >
            {translate(kit.state === 'active' ? 'screen.brand.archive' : 'screen.brand.activate')}
          </Button>
        </Card>
      ))}
    </>
  );
}
