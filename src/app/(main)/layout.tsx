import type { Metadata, Viewport } from 'next';
import { Playfair_Display } from 'next/font/google';
import localFont from 'next/font/local';
import '../globals.css';
import { getLocale } from "gt-next/server";
import { GTProvider } from "gt-next";
import { CookieBanner } from '@/components/ui/CookieBanner';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800', '900']
});

const volter = localFont({
  src: [
    { path: '../../../public/fonts/volter.woff2', weight: '400', style: 'normal' },
    { path: '../../../public/fonts/volter_bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://buenzlifight.ch'),
  title: {
    default: 'BünzliFight — Dini Stadt, Dis Spiel',
    template: 'BünzliFight — %s',
  },
  description: 'Baue dini eigeni Schwiizer Gmeind, manage Ressource und kämpf gege de Bünzli — in Echtziit mit andere Spieler.',
  openGraph: {
    title: 'BünzliFight — Dini Stadt, Dis Spiel',
    description: 'Baue dini eigeni Schwiizer Gmeind, manage Ressource und kämpf gege de Bünzli — in Echtziit mit andere Spieler.',
    type: 'website',
    siteName: 'BünzliFight',
    images: [
      {
        url: '/opengraph-image.png',
        width: 643,
        height: 900,
        type: 'image/png',
        alt: 'BünzliFight - Schweizer Städtebau-Spiel'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BünzliFight'
  },
  formatDetection: {
    telephone: false
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f1219'
};

export default async function RootLayout({ children }: {children: React.ReactNode;}) {
  return (
  <html className={`dark ${playfair.variable} ${volter.variable}`} lang={await getLocale()}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, true);` }} />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {/* Preload critical game assets - WebP for browsers that support it */}
        <link
        rel="preload"
        href="/assets/sprites_red_water_new.webp"
        as="image"
        type="image/webp" />

        <link
        rel="preload"
        href="/assets/water.webp"
        as="image"
        type="image/webp" />

      </head>
      <body className="bg-background text-foreground antialiased font-sans overflow-hidden"><GTProvider>{children}</GTProvider><CookieBanner /></body>
    </html>
  );
}