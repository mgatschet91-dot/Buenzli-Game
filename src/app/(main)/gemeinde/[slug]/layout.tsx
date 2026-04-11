import { Metadata } from 'next';
import { CANTON_CONTENT } from './cantonContent';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const BASE_URL = 'https://buenzlifight.ch';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

interface MunicipalityApiData {
  municipality: {
    id: number;
    name: string;
    slug: string;
    canton: string;
    canton_full: string;
    population?: number;
    area_km2?: number;
    elevation_m?: number;
    postal_code?: string;
    district?: string;
  };
  administration?: {
    member_count: number;
  };
}

async function fetchMunicipalityData(slug: string): Promise<MunicipalityApiData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/game/municipality/${slug}/map`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchMunicipalityData(slug);

  if (!data) {
    const formattedName = slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');
    return {
      title: `${formattedName} - BuenzliFight`,
      description: `Baue und verwalte die Gemeinde ${formattedName} in BuenzliFight`,
    };
  }

  const { municipality, administration } = data;
  const cantonCode = municipality.canton || '';
  const cantonInfo = CANTON_CONTENT[cantonCode.toUpperCase()];
  const cantonName = cantonInfo?.name || municipality.canton_full || cantonCode;
  const memberCount = administration?.member_count || 0;

  const pop = Number(municipality.population) || 0;
  const elev = Number(municipality.elevation_m) || 0;
  const area = Number(municipality.area_km2) || 0;

  const title = `${municipality.name} (${cantonCode}) \u2013 Gemeinde Simulator | BuenzliFight`;
  const statsSnippet = [
    pop > 0 ? `${pop.toLocaleString('de-CH')} Einwohner` : '',
    elev > 0 ? `${elev} m ue. M.` : '',
    area > 0 ? `${area.toLocaleString('de-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km\u00B2` : '',
  ].filter(Boolean).join(', ');
  const description = `${municipality.name} im Kanton ${cantonName}${statsSnippet ? ` (${statsSnippet})` : ''} spielen: Baue und verwalte deine Schweizer Gemeinde im Multiplayer.${memberCount > 0 ? ` ${memberCount} Spieler aktiv.` : ''} Jetzt kostenlos starten.`;
  const canonical = `${BASE_URL}/gemeinde/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    keywords: [
      `${municipality.name} Gemeinde Simulator`,
      `${municipality.name} Spiel`,
      `${municipality.name} ${cantonName}`,
      `Gemeinde ${municipality.name}`,
      'Schweizer Gemeinde Spiel',
      'BuenzliFight',
      `Kanton ${cantonName}`,
      'Gemeinde Simulation Schweiz',
    ],
    openGraph: {
      title: `${municipality.name} im Gemeinde Simulator \u2013 BuenzliFight`,
      description,
      url: canonical,
      type: 'website',
      siteName: 'BuenzliFight',
      images: [
        {
          url: '/opengraph-image.png',
          width: 643,
          height: 900,
          alt: `BuenzliFight \u2013 ${municipality.name} im Gemeinde Simulator`,
        },
      ],
    },
  };
}

function MunicipalityJsonLd({ data }: { data: MunicipalityApiData }) {
  const { municipality } = data;
  const cantonCode = municipality.canton || '';
  const cantonInfo = CANTON_CONTENT[cantonCode.toUpperCase()];

  const placeJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: municipality.name,
    address: {
      '@type': 'PostalAddress',
      addressLocality: municipality.name,
      addressRegion: cantonCode,
      addressCountry: 'CH',
      ...(municipality.postal_code ? { postalCode: municipality.postal_code } : {}),
    },
    url: `${BASE_URL}/gemeinde/${municipality.slug}`,
  };
  if (municipality.elevation_m) {
    placeJsonLd.elevation = `${municipality.elevation_m} m`;
  }

  const softwareJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `BuenzliFight \u2013 ${municipality.name}`,
    applicationCategory: 'GameApplication',
    operatingSystem: 'Web Browser',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CHF',
    },
    description: `Schweizer Gemeinde Simulator: Verwalte ${municipality.name} im Kanton ${cantonInfo?.name || cantonCode}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
      />
    </>
  );
}

export default async function GemeindeLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const data = await fetchMunicipalityData(slug);

  return (
    <>
      {data && <MunicipalityJsonLd data={data} />}
      {children}
    </>
  );
}
