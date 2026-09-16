'use client';

import { ASSET_LIST_SCHEMA, PROJECT_DETAIL_SCHEMA } from '@mediaclear/contracts';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetchChecked, translate } from '../../_lib/api';
import { useResource } from '../../_lib/use-resource';
import { Card, Empty, ErrorNotice, Loading, PageTitle, LinkButton } from '../../_components/Ui';


export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const project = useResource(() => apiFetchChecked(`/v1/projects/${projectId}`, PROJECT_DETAIL_SCHEMA), [projectId]);
  const assets = useResource(() => apiFetchChecked(`/v1/projects/${projectId}/assets`, ASSET_LIST_SCHEMA), [projectId]);

  return (
    <>
      <PageTitle
        action={
          <LinkButton href={`/projects/${projectId}/upload`}>{translate('screen.project_detail.upload_cta')}</LinkButton>
        }
      >
        {project.status === 'ready' && project.data ? project.data.name : translate('screen.project_detail.title')}
      </PageTitle>

      {project.status === 'loading' ? <Loading /> : null}
      {project.status === 'error' && project.error ? <ErrorNotice error={project.error} onRetry={project.reload} /> : null}

      <Card title={translate('screen.project_detail.assets_title')}>
        {assets.status === 'loading' ? <Loading /> : null}
        {assets.status === 'error' && assets.error ? <ErrorNotice error={assets.error} onRetry={assets.reload} /> : null}
        {assets.status === 'ready' && assets.data ? (
          assets.data.items.length === 0 ? (
            <Empty message={translate('screen.project_detail.empty_assets')} />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {assets.data.items.map((asset) => (
                <li key={asset.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <Link href={`/assets/${asset.id}`} style={{ color: 'var(--mcp-primary)' }}>
                    {asset.id}
                  </Link>
                  <span style={{ color: 'var(--mcp-text-secondary)', marginLeft: 'var(--mcp-space-3)' }}>
                    {asset.mediaType === 'image' ? translate('usage.image_unit') : translate('usage.video_minute_unit')}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Card>
    </>
  );
}
