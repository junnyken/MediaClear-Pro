import { ScreenPlaceholder } from '../../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.project_detail.title"
      contractKeys={[
        'screen.project_detail.contract.1',
        'screen.project_detail.contract.2',
        'screen.project_detail.contract.3',
      ]}
    />
  );
}
