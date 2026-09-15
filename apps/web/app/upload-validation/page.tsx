import { ScreenPlaceholder } from '../_components/ScreenPlaceholder';

export default function Page() {
  return (
    <ScreenPlaceholder
      titleKey="screen.upload_validation.title"
      contractKeys={[
        'screen.upload_validation.contract.1',
        'screen.upload_validation.contract.2',
        'screen.upload_validation.contract.3',
      ]}
    />
  );
}
