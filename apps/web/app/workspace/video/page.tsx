import { ScreenPlaceholder } from '../../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.video_workspace.title"
      contractKeys={[
        'screen.video_workspace.contract.1',
        'screen.video_workspace.contract.2',
        'screen.video_workspace.contract.3',
      ]}
    />
  );
}
