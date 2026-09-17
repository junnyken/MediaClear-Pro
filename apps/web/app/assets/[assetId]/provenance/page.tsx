'use client';

/**
 * `P5-MCP-50` — lich su cua mot tep.
 *
 * Man hinh nay co MOT viec kho: hien du su that ma khong lam nguoi doc tuong rang he thong biet
 * nhieu hon thuc te. Nen moi muc deu mang mot nhan bang chung, va hai thu KHONG BAO GIO bi giau:
 * muc mo coi (tro toi mot buoc khong con trong lich su) va danh sach gioi han.
 */
import { PROVENANCE_TIMELINE_SCHEMA } from '@mediaclear/contracts';
import { useParams } from 'next/navigation';
import { PRIMITIVE_COLORS } from '@mediaclear/design-tokens';
import { apiFetchChecked, translate } from '../../../_lib/api';
import { useResource } from '../../../_lib/use-resource';
import { Card, DefinitionRow, ErrorNotice, EvidenceBadge, Loading, PageTitle } from '../../../_components/Ui';


/**
 * Nhan cho MOT o so lieu trong dong thoi gian.
 *
 * `translate()` tra ve CHINH KHOA khi thieu ban dich, nen mot khoa moi chua duoc dich se hien
 * nguyen `provenance.detail.<gi do>` ra man hinh. Duong lui nay bien no thanh chinh ten truong —
 * xau, nhung con doc duoc, va no LO RA de nguoi lam nhin thay ma bo sung.
 */
function detailLabel(key: string): string {
  const full = `provenance.detail.${key}`;
  const text = translate(full);
  return text === full ? key : text;
}

export default function AssetProvenancePage() {
  const params = useParams<{ assetId: string }>();
  const assetId = params.assetId;
  const resource = useResource(
    () => apiFetchChecked(`/v1/assets/${encodeURIComponent(assetId)}/provenance`, PROVENANCE_TIMELINE_SCHEMA),
    [assetId],
  );

  if (resource.status === 'loading') return <Loading />;
  if (resource.status === 'error' && resource.error) {
    return (
      <>
        <PageTitle>{translate('screen.provenance.history_title')}</PageTitle>
        <ErrorNotice error={resource.error} onRetry={resource.reload} />
      </>
    );
  }
  const view = resource.data;
  if (!view) return null;

  const orphans = new Set(view.orphanIds);

  return (
    <>
      <PageTitle>{translate('screen.provenance.history_title')}</PageTitle>

      {view.nodes.length === 0 ? (
        <Card><p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.provenance.empty')}</p></Card>
      ) : null}

      {/*
        Muc MO COI len dau, khong nam lan trong danh sach. Mot canh bao nam giua dong thoi gian se
        bi luot qua — va do dung la thu nguoi doc can biet truoc khi tin phan con lai.
      */}
      {view.orphanIds.length > 0 ? (
        <Card title={translate('screen.provenance.orphan')}>
          <p role="alert" style={{ color: PRIMITIVE_COLORS.warning }}>
            {translate('screen.provenance.orphan_note')}
          </p>
          <p>{view.orphanIds.join(' · ')}</p>
        </Card>
      ) : null}

      {view.limitationKeys.length > 0 ? (
        <Card title={translate('screen.provenance.limitations')}>
          <ul style={{ margin: 0, paddingLeft: 'var(--mcp-space-5)' }}>
            {view.limitationKeys.map((k) => (
              <li key={k} style={{ color: PRIMITIVE_COLORS.warning }}>{translate(k)}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {view.nodes.map((node) => (
        <Card key={node.id} title={translate(node.labelKey)}>
          <div style={{ marginBottom: 'var(--mcp-space-3)' }}>
            <EvidenceBadge status={node.evidenceStatus} />
            {orphans.has(node.id) ? (
              <span style={{ color: PRIMITIVE_COLORS.warning, marginLeft: 'var(--mcp-space-3)' }}>
                {translate('screen.provenance.orphan')}
              </span>
            ) : null}
          </div>
          {node.detail.map((d) => (
            /*
              `wordBreak: break-all` la BAT BUOC o day, khong phai trang tri: ma kiem tra tep dai 64
              ky tu lien khong co cho ngat, va o kho 390px no day ca the ra ngoai man hinh. Bam tay
              o kho dien thoai moi thay — o 1280px moi thu trong van binh thuong.
            */
            <DefinitionRow key={d.key} label={detailLabel(d.key)}>
              {/*
                `valueKey` do MAY CHU quyet dinh, khong phai giao dien doan. Mot so gia tri la enum
                (`provider_blocked`) hoac chinh la khoa i18n (`disclosure.limitation.*`) — de giao
                dien tu doan thi phep doan se sai va khoa THO lot ra man hinh. Da xay ra that.
              */}
              <span style={{ wordBreak: 'break-all' }}>
                {d.value === null
                  ? translate('common.unknown_value')
                  : d.valueKey !== null ? translate(d.valueKey) : d.value}
              </span>
            </DefinitionRow>
          ))}
        </Card>
      ))}
    </>
  );
}
