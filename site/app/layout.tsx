import { Suspense } from 'react';
import type { Metadata } from 'next';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import './style.css';
import './design.css';
import AppFrame from '../components/app/frame';
import { themeScript } from '../components/app/theme';
import '@fontsource/inter/600.css';
export const metadata: Metadata = {
  title: 'Supanauts — An unofficial Supabase community',
  description:
    'Supanauts: an unofficial Supabase community. Meet other builders, share your projects and learn together.',
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={<p role="status">Loading Supanauts…</p>}>
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}
