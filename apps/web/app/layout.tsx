import type { ReactNode } from 'react';
import { DEFAULT_LOCALE, t } from '@mediaclear/i18n';
import '@mediaclear/design-tokens/tokens.css';
import { Shell } from './_components/Shell';

/**
 * P2-MCP-26: BUOC render theo tung request.
 *
 * Neu de Next prerender tinh, dia chi API se bi chot NGAY LUC BUILD - dung cai bay ma viec
 * bo `NEXT_PUBLIC_*` di la de tranh. Da kiem that: khong co dong nay thi HTML tinh mang
 * `__MCP_API_BASE__=""`, va giao dien khong goi duoc API nao.
 */
export const dynamic = 'force-dynamic';

export const metadata = {
  title: t(DEFAULT_LOCALE, 'app.name'),
  description: t(DEFAULT_LOCALE, 'app.tagline'),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Locale mac dinh tieng Viet; 'en' da san sang trong packages/i18n.
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        {/*
          P2-MCP-26: tiem dia chi API LUC CHAY. Doc tu bien cua may chu Next, khong phai
          NEXT_PUBLIC_* (thu do bi nhung vao bundle luc build nen doi la phai build lai).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__MCP_API_BASE__=${JSON.stringify(process.env.MEDIACLEAR_API_BASE_URL ?? '')};`,
          }}
        />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
