import { ScreenPlaceholder } from '../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.provenance.title"
      contractKeys={[
        'screen.provenance.contract.1',
        'screen.provenance.contract.2',
        'screen.provenance.contract.3',
      ]}
    />
  );
}
