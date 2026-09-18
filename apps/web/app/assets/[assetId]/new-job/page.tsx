'use client';

import { ASSET_VIEW_SCHEMA, BRAND_KIT_LIST_SCHEMA, JOB_CREATED_SCHEMA } from '@mediaclear/contracts';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetchChecked, translate, type ApiErrorShape } from '../../../_lib/api';
import { useResource } from '../../../_lib/use-resource';
import { Button, Card, DefinitionRow, ErrorNotice, LinkButton, Loading, PageTitle } from '../../../_components/Ui';

const OPERATIONS = ['visible_logo_cleanup', 'visible_text_cleanup', 'object_cleanup', 'crop', 'blur', 'brand_overlay'] as const;

export default function CreateJobPage() {
  const params = useParams<{ assetId: string }>();
  const router = useRouter();
  const assetId = params.assetId;
  const [selected, setSelected] = useState<string[]>(['visible_logo_cleanup']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [blockedJobId, setBlockedJobId] = useState<string | null>(null);

  /*
   * `D-077` — lop phu la OPT-IN. Ba o duoi day mac dinh la "khong dan gi", va chi khi nguoi dung
   * bat tuong minh thi yeu cau moi mang truong `branding`.
   */
  const [brandKitId, setBrandKitId] = useState<string>('');
  const [applyLogo, setApplyLogo] = useState(false);
  const [applyDisclosure, setApplyDisclosure] = useState(false);

  const asset = useResource(() => apiFetchChecked(`/v1/assets/${assetId}`, ASSET_VIEW_SCHEMA), [assetId]);
  const brandKits = useResource(() => apiFetchChecked('/v1/brand-kits', BRAND_KIT_LIST_SCHEMA), []);
  const kits = (brandKits.status === 'ready' && brandKits.data ? brandKits.data.items : []).filter((k) => k.state === 'active');
  const chosen = kits.find((k) => k.id === brandKitId) ?? null;
  const chosenVersion = chosen?.versions.find((v) => v.version === chosen.currentVersion) ?? null;

  /*
   * `branding` chi khac `null` khi CO bo nhan dien VA co it nhat mot o duoc bat.
   *
   * Phien ban duoc GHIM tai thoi diem gui: neu gui "phien ban dang hieu luc", mot lan sua bo nhan
   * dien giua luc nguoi dung bam se lam ban xuat mang noi dung khac voi cai ho vua xem truoc.
   */
  const branding = chosen && chosenVersion && (applyLogo || applyDisclosure)
    ? {
      brandKitId: chosen.id,
      brandKitVersion: chosenVersion.version,
      applyLogo,
      applyDisclosure,
    }
    : null;

  function toggle(operation: string) {
    setSelected((current) =>
      current.includes(operation) ? current.filter((item) => item !== operation) : [...current, operation],
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setBlockedJobId(null);
    const result = await apiFetchChecked(`/v1/assets/${assetId}/jobs`, JOB_CREATED_SCHEMA, {
      method: 'POST',
      body: {
        operations: selected,
        regions: [],
        presetId: null,
        // `null` = khong dan lop phu. Giao dien KHONG BAO GIO gui mot gia tri suy ra.
        branding,
        // Khoa chong gui trung: gui lai cung khoa se tra dung job cu.
        idempotencyKey: `${assetId}:${selected.join('+')}:${Date.now()}`,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      const jobId = result.error.params?.jobId;
      if (typeof jobId === 'string') setBlockedJobId(jobId);
      return;
    }
    router.push(`/jobs/${result.data.job.id}`);
  }

  const gates = asset.status === 'ready' && asset.data ? asset.data : null;

  return (
    <>
      <PageTitle>{translate('screen.job_review.title')}</PageTitle>

      <Card title={translate('screen.job_review.gates_title')}>
        {asset.status === 'loading' ? <Loading /> : null}
        {gates ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li>
              {gates.validation.state === 'passed' ? '✓' : '✗'} {translate('screen.job_review.gate_validation')}
            </li>
            <li>
              {gates.rightsAttestation.status === 'active' ? '✓' : '✗'} {translate('screen.job_review.gate_rights')}
            </li>
          </ul>
        ) : null}
      </Card>

      <Card title={translate('screen.job_review.operations_label')}>
        {OPERATIONS.map((operation) => (
          <label key={operation} style={{ display: 'flex', gap: 'var(--mcp-space-3)', alignItems: 'center', padding: '6px 0' }}>
            <input
              type="checkbox"
              name={operation}
              checked={selected.includes(operation)}
              onChange={() => toggle(operation)}
              style={{ width: 20, height: 20 }}
            />
            <span>{translate(`operation.${operation}`)}</span>
          </label>
        ))}
      </Card>

      {/* ---------------- `D-077`: lop phu nhan dien / cong bo AI (OPT-IN) ---------------- */}
      <Card title={translate('screen.brand.title')}>
        {/* Cau nay o NGAY dau the: no sua mot hieu nham co that ve viec he thong tu dan lop phu. */}
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.brand.not_applied')}</p>

        {kits.length === 0 ? (
          <>
            <p>{translate('screen.brand.empty')}</p>
            <LinkButton href="/brand-kits">{translate('screen.brand.create')}</LinkButton>
          </>
        ) : (
          <>
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', color: 'var(--mcp-text-secondary)' }}>
                {translate('screen.brand.title')}
              </span>
              <select
                name="brand-kit"
                value={brandKitId}
                onChange={(e) => setBrandKitId(e.target.value)}
                style={{
                  minHeight: 44, width: '100%', background: 'var(--mcp-surface)',
                  color: 'var(--mcp-text-primary)', border: '1px solid var(--mcp-text-secondary)',
                  borderRadius: 'var(--mcp-radius-sm)', padding: 'var(--mcp-space-2)',
                }}
              >
                <option value="">{translate('screen.brand.none')}</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.versions[k.versions.length - 1]?.name ?? k.id}
                  </option>
                ))}
              </select>
            </label>

            {chosenVersion ? (
              <>
                {/*
                  Hien PHIEN BAN se duoc dan, khong chi ten bo. Nguoi dung phai thay dung con so ma
                  bien nhan se ghi — neu khong, "ban xuat nay dung bo nao" tro thanh mot cau doan.
                */}
                <DefinitionRow label={translate('screen.brand.current_version')}>
                  {chosenVersion.version}
                </DefinitionRow>
                <DefinitionRow label={translate('screen.brand.position')}>
                  {translate(`overlay.position.${chosenVersion.overlayDefaults.position}`)}
                </DefinitionRow>
                <DefinitionRow label={translate('screen.brand.logo')}>
                  {chosenVersion.logoAssetId === null
                    ? translate('screen.brand.no_logo')
                    : translate('screen.brand.has_logo')}
                </DefinitionRow>

                <label style={{ display: 'flex', gap: 'var(--mcp-space-2)', alignItems: 'center', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    name="apply-logo"
                    checked={applyLogo}
                    onChange={(e) => setApplyLogo(e.target.checked)}
                    disabled={chosenVersion.logoAssetId === null}
                  />
                  <span>{translate('screen.brand.apply_logo')}</span>
                </label>
                <label style={{ display: 'flex', gap: 'var(--mcp-space-2)', alignItems: 'center', minHeight: 44 }}>
                  <input
                    type="checkbox"
                    name="apply-disclosure"
                    checked={applyDisclosure}
                    onChange={(e) => setApplyDisclosure(e.target.checked)}
                  />
                  <span>{translate('screen.brand.apply_disclosure')}</span>
                </label>

                {/*
                  XEM TRUOC bang chu: noi CHINH XAC cai se duoc gui di. Mot o xem truoc bang hinh se
                  phai ve lai logic dan o phia giao dien — va hai ban ve se lech nhau. Cau nay lay
                  thang tu `branding`, tuc la tu dung thu sap duoc gui.
                */}
                <p role="status" style={{ color: 'var(--mcp-warning)' }}>
                  {branding === null
                    ? translate('screen.brand.preview_none')
                    : translate('screen.brand.preview_summary', {
                      version: branding.brandKitVersion,
                      logo: translate(branding.applyLogo ? 'common.yes' : 'common.no'),
                      disclosure: translate(branding.applyDisclosure ? 'common.yes' : 'common.no'),
                    })}
                </p>
              </>
            ) : null}
          </>
        )}
      </Card>

      <Card>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.job_review.usage_note')}</p>
        <p style={{ color: 'var(--mcp-warning)' }}>{translate('screen.job_status.no_production_engine')}</p>
        <Button onClick={submit} disabled={busy || selected.length === 0}>
          {translate('screen.job_review.submit')}
        </Button>
        {error ? <ErrorNotice error={error} /> : null}
        {blockedJobId ? (
          <p style={{ marginTop: 'var(--mcp-space-3)' }}>
            <a href={`/jobs/${blockedJobId}`} style={{ color: 'var(--mcp-primary)' }}>
              {translate('screen.blocked.title')}
            </a>
          </p>
        ) : null}
      </Card>
    </>
  );
}
