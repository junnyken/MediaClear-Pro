import { ScreenPlaceholder } from '../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.rights.title"
      contractKeys={[
        'screen.rights.contract.1',
        'screen.rights.contract.2',
        'screen.rights.contract.3',
      ]}
    />
  );
}
