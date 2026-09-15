import { ScreenPlaceholder } from '../../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.image_workspace.title"
      contractKeys={[
        'screen.image_workspace.contract.1',
        'screen.image_workspace.contract.2',
        'screen.image_workspace.contract.3',
      ]}
    />
  );
}
