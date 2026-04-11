import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Schweizer Gemeinde-Simulator Statistiken | Buenzlifight',
  description: 'Echtzeit-Statistiken aller virtuellen Gemeinden auf Buenzlifight.ch — Einkommen, Solarstrom, Wasserverbrauch, Bevölkerung der letzten 30 Tage.',
  openGraph: {
    title: 'Buenzlifight Statistiken',
    description: 'Aggregierte Echtzeit-Daten aller Schweizer Gemeinden auf Buenzlifight.ch',
    url: 'https://buenzlifight.ch/statistiken',
    siteName: 'Buenzlifight',
    locale: 'de_CH',
    type: 'website',
  },
  alternates: {
    canonical: 'https://buenzlifight.ch/statistiken',
  },
};

export default function StatistikenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
