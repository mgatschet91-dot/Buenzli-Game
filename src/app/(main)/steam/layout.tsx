import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://buenzlifight.ch'),
  title: {
    default: 'Steam — Theme Park Builder',
    template: 'Steam — %s',
    absolute: 'Steam — Theme Park Builder',
  },
  description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
  openGraph: {
    title: 'Steam — Theme Park Builder',
    description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
    type: 'website',
    siteName: 'BünzliFight',
    images: [
      {
        url: '/coaster/opengraph-image.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Steam - Theme park builder game screenshot'
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Steam — Theme Park Builder',
    description: 'Build the ultimate theme park with thrilling roller coasters, exciting rides, and happy guests!',
    images: ['/coaster/opengraph-image.png'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Steam',
  },
};

export default function SteamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
