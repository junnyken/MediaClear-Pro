import { ScreenPlaceholder } from '../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.activity.title"
      contractKeys={[
        'screen.activity.contract.1',
        'screen.activity.contract.2',
        'screen.activity.contract.3',
      ]}
    />
  );
}
