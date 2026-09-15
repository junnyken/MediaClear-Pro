import type { ReactNode } from 'react';
import { DEFAULT_LOCALE, t } from '@mediaclear/i18n';
import '@mediaclear/design-tokens/tokens.css';
import { Shell } from './_components/Shell';

export const metadata = {
  title: t(DEFAULT_LOCALE, 'app.name'),
  description: t(DEFAULT_LOCALE, 'app.tagline'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Locale mac dinh tieng Viet; 'en' da san sang trong packages/i18n.
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
