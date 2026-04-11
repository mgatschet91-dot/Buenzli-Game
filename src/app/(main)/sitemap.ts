import type { MetadataRoute } from 'next'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const API_BASE = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:4100'
const BASE_URL = 'https://buenzlifight.ch'

interface Municipality {
  slug: string
  canton_code: string
  updated_at?: string
  members_count?: number
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ── Statische Seiten ──
  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/gemeinde-simulator-schweiz`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/zuerich-gemeinde-simulator`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/basel-gemeinde-simulator`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/bern-gemeinde-simulator`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/solothurn-gemeinde-simulator`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/statistiken`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE_URL}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    // ── Quick Guide / Handbuch ──
    { url: `${BASE_URL}/quick-guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/quick-guide/karte-bauen`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/quick-guide/budget-finanzen`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/quick-guide/firmen-wirtschaft`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/quick-guide/gemeinde-panel`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/quick-guide/statistiken`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/quick-guide/banking-kredit`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/quick-guide/rangliste`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]

  // ── Dynamische Gemeinde-Seiten ──
  // Alle 2175 Gemeinden sind in der Sitemap — jede Seite hat unique Content
  // (echte Einwohner, Flaeche, Hoehe aus Wikidata/BFS).
  // Aktive Gemeinden (mit Spielern) erhalten hoehere Prioritaet.
  let dynamicUrls: MetadataRoute.Sitemap = []
  try {
    const res = await fetch(`${API_BASE}/api/municipalities`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      const municipalities: Municipality[] = data.municipalities || []
      dynamicUrls = municipalities.map((m) => ({
        url: `${BASE_URL}/gemeinde/${m.slug}`,
        lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: Number(m.members_count || 0) > 0 ? 0.7 : 0.5,
      }))
    } else {
      console.error(`[Sitemap] API Fehler: ${res.status} ${res.statusText}`)
    }
  } catch (err) {
    console.error('[Sitemap] API nicht erreichbar:', err instanceof Error ? err.message : String(err))
  }

  console.log(`[Sitemap] ${staticUrls.length} statische + ${dynamicUrls.length} Gemeinde-URLs generiert`)

  return [...staticUrls, ...dynamicUrls]
}
