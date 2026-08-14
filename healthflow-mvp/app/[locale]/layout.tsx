import type { ReactNode } from 'react';
import { getDictionary, locales, defaultLocale } from '@/lib/i18n';
import BottomNav from '@/components/BottomNav';
import '../globals.css';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const locale = locales.includes(params.locale as any) ? params.locale : defaultLocale;
  const dict = getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <main style={{ flex: 1, paddingBottom: 24 }}>{children}</main>
          <BottomNav locale={locale} labels={dict.nav} />
        </div>
      </body>
    </html>
  );
}
