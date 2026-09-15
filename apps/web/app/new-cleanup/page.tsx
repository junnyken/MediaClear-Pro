'use client';

import { translate } from '../_lib/api';
import { Card, PageTitle, LinkButton } from '../_components/Ui';

/** Diem vao theo workflow: chon du an -> tai tep -> kiem tra -> xac nhan quyen -> tao luot. */
export default function NewCleanupPage() {
  return (
    <>
      <PageTitle>{translate('screen.new_cleanup.title')}</PageTitle>
      <Card>
        <ol style={{ lineHeight: 2 }}>
          <li>{translate('screen.project_list.create_cta')}</li>
          <li>{translate('screen.project_detail.upload_cta')}</li>
          <li>{translate('screen.upload_validation.title')}</li>
          <li>{translate('rights.attestation.v2.title')}</li>
          <li>{translate('screen.job_review.submit')}</li>
        </ol>
        <LinkButton href="/projects">{translate('common.continue')}</LinkButton>
        <p style={{ color: 'var(--mcp-text-secondary)' }}>{translate('screen.asset_upload.original_kept')}</p>
      </Card>
    </>
  );
}
