import { ScreenPlaceholder } from './_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.dashboard.title"
      contractKeys={[
        'screen.dashboard.contract.1',
        'screen.dashboard.contract.2',
        'screen.dashboard.contract.3',
      ]}
    />
  );
}
