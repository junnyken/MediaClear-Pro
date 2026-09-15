import { ScreenPlaceholder } from '../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.usage.title"
      contractKeys={[
        'screen.usage.contract.1',
        'screen.usage.contract.2',
        'screen.usage.contract.3',
      ]}
    />
  );
}
