'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GemeindeGame from './GemeindeGame';
import { CANTON_CONTENT, FEATURED_CITIES, type CantonContent } from './cantonContent';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';
const API_BASE_URL = process.env.NEXT_PUBLIC_CORE_API_URL || process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

interface MunicipalityInfo {
  name: string;
  canton_code: string;
  canton_name: string;
  member_count: number;
  slug: string;
  population: number;
  area_km2: number;
  elevation_m: number;
  postal_code: string;
  district: string;
}

interface CantonMunicipality {
  name: string;
  slug: string;
}

export default function GemeindePage() {
  const params = useParams();
  const slug = params.slug as string;

  // Synchron prüfen ob Token existiert – wenn nicht, sofort Landing zeigen (kein Loader)
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (typeof window === 'undefined') return 'unauthenticated';
    return localStorage.getItem('isocity_auth_token') ? 'loading' : 'unauthenticated';
  });
  const [municipalityInfo, setMunicipalityInfo] = useState<MunicipalityInfo | null>(null);
  const [cantonMunicipalities, setCantonMunicipalities] = useState<CantonMunicipality[]>([]);

  // Auth check – nur wenn Token vorhanden (authState === 'loading')
  useEffect(() => {
    if (authState !== 'loading') return;

    const token = localStorage.getItem('isocity_auth_token');
    if (!token) { setAuthState('unauthenticated'); return; }

    fetch(`${AUTH_API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if ((data?.ok || data?.success) && data.user) {
          setAuthState('authenticated');
        } else {
          setAuthState('unauthenticated');
        }
      })
      .catch(() => setAuthState('unauthenticated'));
  }, [authState]);

  // Fetch municipality info for landing (only when unauthenticated)
  useEffect(() => {
    if (authState !== 'unauthenticated' || !slug) return;

    fetch(`${API_BASE_URL}/api/game/municipality/${slug}/map`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json?.data?.municipality) {
          const m = json.data.municipality;
          setMunicipalityInfo({
            name: m.name,
            canton_code: m.canton || '',
            canton_name: m.canton_full || '',
            member_count: json.data.administration?.member_count || 0,
            slug: m.slug,
            population: Number(m.population) || 0,
            area_km2: Number(m.area_km2) || 0,
            elevation_m: Number(m.elevation_m) || 0,
            postal_code: m.postal_code || '',
            district: m.district || '',
          });

          if (m.canton) {
            fetch(`${API_BASE_URL}/api/game/canton/${m.canton}`)
              .then(res => res.ok ? res.json() : null)
              .then(cantonJson => {
                if (cantonJson?.data?.municipalities) {
                  setCantonMunicipalities(
                    cantonJson.data.municipalities
                      .filter((cm: { slug: string }) => cm.slug !== slug)
                      .slice(0, 12)
                      .map((cm: { name: string; slug: string }) => ({ name: cm.name, slug: cm.slug }))
                  );
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
  }, [authState, slug]);

  const handleNotAuthenticated = useCallback(() => {
    setAuthState('unauthenticated');
  }, []);

  // Authenticated -> Game
  if (authState === 'authenticated') {
    return (
      <GemeindeGame
        slug={slug}
        onNotAuthenticated={handleNotAuthenticated}
      />
    );
  }

  // Loading
  if (authState === 'loading') {
    return (
      <main className="min-h-screen hero-gradient flex flex-col items-center justify-center gap-5">
        <h1 className="text-4xl font-display font-bold tracking-[0.12em] animate-blueShimmer">BuenzliFight</h1>
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground/70 text-sm">Laden...</p>
      </main>
    );
  }

  // Unauthenticated -> Landing Funnel
  const cantonCode = municipalityInfo?.canton_code || '';
  const cantonContent = CANTON_CONTENT[cantonCode.toUpperCase()] || null;
  const displayName = municipalityInfo?.name || slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ');

  return (
    <MunicipalityLanding
      slug={slug}
      name={displayName}
      cantonCode={cantonCode}
      cantonContent={cantonContent}
      memberCount={municipalityInfo?.member_count || 0}
      population={municipalityInfo?.population || 0}
      areaKm2={municipalityInfo?.area_km2 || 0}
      elevationM={municipalityInfo?.elevation_m || 0}
      postalCode={municipalityInfo?.postal_code || ''}
      district={municipalityInfo?.district || ''}
      cantonMunicipalities={cantonMunicipalities}
    />
  );
}

// ── Landing Funnel Component ────────────────────────────────────────────────

function MunicipalityLanding({
  slug,
  name,
  cantonCode,
  cantonContent,
  memberCount,
  population,
  areaKm2,
  elevationM,
  postalCode,
  district,
  cantonMunicipalities,
}: {
  slug: string;
  name: string;
  cantonCode: string;
  cantonContent: CantonContent | null;
  memberCount: number;
  population: number;
  areaKm2: number;
  elevationM: number;
  postalCode: string;
  district: string;
  cantonMunicipalities: CantonMunicipality[];
}) {
  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      {/* Background */}
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[8%] w-96 h-96 rounded-full bg-cyan-300/10 blur-[160px]" />
        <div className="absolute bottom-[15%] right-[10%] w-[32rem] h-[32rem] rounded-full bg-emerald-300/8 blur-[170px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-10 pb-24">
        {/* Back */}
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-200 transition-colors mb-8 group text-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:-translate-x-1 transition-transform duration-300">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Zurueck zur Startseite
        </Link>

        {/* HERO */}
        <header className="mb-10">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            {name} {cantonContent ? `\u2022 ${cantonContent.name}` : cantonCode ? `\u2022 ${cantonCode}` : ''} \u2022 Gemeinde Simulator
          </p>

          <h1 className="text-3xl md:text-5xl font-display font-bold text-white leading-tight">
            {name} im Gemeinde Simulator spielen
          </h1>

          <p className="mt-4 text-slate-200 leading-relaxed max-w-3xl">
            Uebernimm die Kontrolle ueber <strong>{name}</strong>
            {cantonContent ? ` im Kanton ${cantonContent.name}` : ''}.
            Baue, verwalte und entwickle deine Gemeinde im Schweizer Multiplayer-Simulator BuenzliFight.
            {memberCount > 0 && ` Bereits ${memberCount} Spieler sind aktiv.`}
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link
              href="/#registration"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-6 py-3 transition-colors"
            >
              Jetzt {name} spielen – kostenlos
            </Link>
            <Link
              href="/gemeinde-simulator-schweiz"
              className="inline-flex items-center justify-center rounded-sm border border-white/15 bg-black/35 hover:bg-black/45 text-white font-medium px-6 py-3 transition-colors"
            >
              Was ist BuenzliFight?
            </Link>
          </div>
        </header>

        {/* Gemeinde-Steckbrief — echte Daten fuer unique SEO Content */}
        {(population > 0 || areaKm2 > 0 || elevationM > 0) && (
          <section className="mb-10 rounded-sm border border-cyan-400/20 bg-cyan-500/5 backdrop-blur-sm p-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Steckbrief {name}
            </h2>
            <p className="text-slate-200 text-sm leading-relaxed mb-4">
              {name} liegt
              {elevationM > 0 && ` auf ${elevationM.toLocaleString('de-CH')} m ue. M.`}
              {district && ` im ${district}`}
              {cantonContent ? `, Kanton ${cantonContent.name}` : cantonCode ? `, Kanton ${cantonCode}` : ''}.
              {population > 0 && ` Die Gemeinde zaehlt ${population.toLocaleString('de-CH')} Einwohner`}
              {areaKm2 > 0 && ` auf einer Flaeche von ${areaKm2.toLocaleString('de-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km\u00B2`}
              {population > 0 && areaKm2 > 0 && ` (${Math.round(population / areaKm2).toLocaleString('de-CH')} Einw./km\u00B2)`}.
              {memberCount > 0
                ? ` Im Spiel wird ${name} bereits von ${memberCount} Spielern verwaltet.`
                : ` ${name} sucht noch einen Gemeindepraesidenten \u2013 uebernimm die Fuehrung!`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {population > 0 && (
                <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-200">{population.toLocaleString('de-CH')}</p>
                  <p className="text-xs text-slate-400 mt-1">Einwohner</p>
                </div>
              )}
              {areaKm2 > 0 && (
                <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-200">{areaKm2.toLocaleString('de-CH', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km&sup2;</p>
                  <p className="text-xs text-slate-400 mt-1">Flaeche</p>
                </div>
              )}
              {elevationM > 0 && (
                <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-200">{elevationM.toLocaleString('de-CH')} m</p>
                  <p className="text-xs text-slate-400 mt-1">Hoehe ue. M.</p>
                </div>
              )}
              {postalCode && (
                <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-200">{postalCode}</p>
                  <p className="text-xs text-slate-400 mt-1">Postleitzahl</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Canton Section */}
        {cantonContent && (
          <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              {cantonContent.tagline}
            </h2>
            <p className="text-slate-200 text-sm leading-relaxed">
              {cantonContent.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-sm border border-white/10 bg-black/35 px-3 py-1 text-xs text-amber-200/80">
                {cantonContent.emoji} {cantonContent.character}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-white/10 bg-black/35 px-3 py-1 text-xs text-slate-300">
                Region: {cantonContent.region}
              </span>
              <span className="inline-flex items-center gap-1 rounded-sm border border-white/10 bg-black/35 px-3 py-1 text-xs text-slate-300">
                Sprache: {cantonContent.language === 'de' ? 'Deutsch' : cantonContent.language === 'fr' ? 'Franzoesisch' : cantonContent.language === 'it' ? 'Italienisch' : 'Raetoromanisch'}
              </span>
            </div>
          </section>
        )}

        {/* Stats */}
        {memberCount > 0 && (
          <section className="mb-10 rounded-sm border border-amber-400/25 bg-amber-500/10 backdrop-blur-sm p-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              {name} – Live-Status
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                <p className="text-2xl font-bold text-amber-200">{memberCount}</p>
                <p className="text-xs text-slate-400 mt-1">Aktive Spieler</p>
              </div>
              <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                <p className="text-2xl font-bold text-amber-200">{cantonCode}</p>
                <p className="text-xs text-slate-400 mt-1">Kanton</p>
              </div>
              <div className="rounded-sm border border-white/10 bg-black/35 p-4 text-center">
                <p className="text-2xl font-bold text-amber-200">Frei</p>
                <p className="text-xs text-slate-400 mt-1">Beitritt</p>
              </div>
            </div>
          </section>
        )}

        {/* Features */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
            Was du in {name} machen kannst
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">Bauen</p>
              <p className="text-slate-200 text-sm">100+ Gebaeude, Zonen, Infrastruktur – alles isometrisch und in Echtzeit.</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">Verwalten</p>
              <p className="text-slate-200 text-sm">Steuern setzen, Budget verteilen, Services managen – wie ein echter Gemeindepraesident.</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">Events</p>
              <p className="text-slate-200 text-sm">Buenzli-Events, Katastrophen und Inspektionen – reagiere und verdiene XP.</p>
            </div>
            <div className="rounded-sm border border-white/10 bg-black/35 p-4">
              <p className="text-amber-200/80 text-xs tracking-[0.25em] uppercase mb-2">Multiplayer</p>
              <p className="text-slate-200 text-sm">Spiele mit bis zu 25 Spielern zusammen, handle mit Nachbargemeinden.</p>
            </div>
          </div>
        </section>

        {/* Cross-links: same canton */}
        {cantonMunicipalities.length > 0 && (
          <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-4">
              Weitere Gemeinden im Kanton {cantonContent?.name || cantonCode}
            </h2>
            <div className="flex flex-wrap gap-2">
              {cantonMunicipalities.map(m => (
                <Link
                  key={m.slug}
                  href={`/gemeinde/${m.slug}`}
                  className="inline-flex items-center rounded-sm border border-white/10 bg-black/35 hover:bg-black/50 hover:border-amber-400/30 px-3 py-1.5 text-sm text-slate-300 hover:text-amber-200 transition-colors"
                >
                  {m.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Cross-links: neighbor cantons */}
        {cantonContent && cantonContent.neighbors.length > 0 && (
          <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-4">
              Nachbar-Kantone entdecken
            </h2>
            <div className="flex flex-wrap gap-2">
              {cantonContent.neighbors.map(nc => {
                const neighbor = CANTON_CONTENT[nc];
                if (!neighbor) return null;
                return (
                  <Link
                    key={nc}
                    href={`/gemeinde-simulator-schweiz`}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-white/10 bg-black/35 hover:bg-black/50 hover:border-amber-400/30 px-3 py-1.5 text-sm text-slate-300 hover:text-amber-200 transition-colors"
                  >
                    {neighbor.emoji} {neighbor.name}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Featured cities */}
        <section className="mb-10 rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-6">
          <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-4">
            Beliebte Staedte
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURED_CITIES.filter(c => c.slug !== slug).map(city => (
              <Link
                key={city.slug}
                href={city.landingPage}
                className="flex items-center justify-between rounded-sm border border-white/10 bg-black/35 hover:bg-black/50 hover:border-amber-400/30 px-4 py-3 transition-colors group"
              >
                <span className="text-slate-200 group-hover:text-amber-200 transition-colors font-medium">{city.name}</span>
                <span className="text-xs text-slate-500">{city.canton}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center">
          <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-6 py-6">
            <h2 className="text-white font-display font-bold text-xl md:text-2xl mb-3">
              Bereit fuer {name}?
            </h2>
            <p className="text-amber-200/70 text-xs md:text-sm mb-5">
              Starte kostenlos und uebernimm deine Gemeinde.
            </p>
            <Link
              href="/#registration"
              className="inline-flex items-center justify-center rounded-sm bg-amber-400/90 hover:bg-amber-300 text-black font-semibold px-7 py-3 transition-colors"
            >
              Kostenlos starten
            </Link>
          </div>
          <div className="mt-10 pt-6 border-t border-white/10 text-center text-slate-500 text-[10px]">
            BuenzliFight &copy; 2026
          </div>
        </section>
      </div>
    </main>
  );
}
