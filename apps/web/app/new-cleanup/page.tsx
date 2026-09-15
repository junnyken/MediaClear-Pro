import { ScreenPlaceholder } from '../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.new_cleanup.title"
      contractKeys={[
        'screen.new_cleanup.contract.1',
        'screen.new_cleanup.contract.2',
        'screen.new_cleanup.contract.3',
      ]}
    />
  );
}
