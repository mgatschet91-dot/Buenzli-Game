'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MunicipalityRankingWidget } from '@/components/game/panels/MunicipalityRankingWidget';

const API_BASE = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

interface FunnelDay {
  date: string;
  total_income: number;
  total_expenses: number;
  total_power_production: number;
  total_power_consumption: number;
  total_solar_production: number;
  total_water_production: number;
  total_water_consumption: number;
  total_population: number;
  municipality_count: number;
}

function fmt(n: number): string {
  return n.toLocaleString('de-CH');
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
}

function TrendBar({ data, getValue, color }: {
  data: FunnelDay[];
  getValue: (d: FunnelDay) => number;
  color: string;
}) {
  if (!data.length) return null;
  const values = data.map(getValue);
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{ height: `${Math.max(2, (values[i] / max) * 100)}%`, background: color, opacity: 0.85 }}
          title={`${fmtDate(d.date)}: ${fmt(values[i])}`}
        />
      ))}
    </div>
  );
}

function StatCard({ title, value, unit, sub, trend, trendColor, icon }: {
  title: string;
  value: string;
  unit?: string;
  sub?: string;
  trend?: FunnelDay[];
  trendColor?: string;
  icon?: string;
}) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        {icon && <span>{icon}</span>}
        {title}
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">
        {value}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
      {trend && trendColor && (
        <div className="mt-1">
          <TrendBar data={trend} getValue={(d) => {
            if (trendColor === '#facc15') return d.total_power_production;
            if (trendColor === '#f97316') return d.total_solar_production;
            if (trendColor === '#22d3ee') return d.total_water_consumption;
            if (trendColor === '#4ade80') return d.total_income;
            if (trendColor === '#f87171') return d.total_expenses;
            return 0;
          }} color={trendColor} />
          <div className="flex justify-between text-[9px] text-slate-600 mt-0.5">
            <span>{fmtDate(trend[0]?.date ?? '')}</span>
            <span>{fmtDate(trend[trend.length - 1]?.date ?? '')}</span>
          </div>
        </div>
      )}
    </div>
  );
}

interface RegionalStats {
  municipality_count: number;
  total_population: number;
  total_jobs: number;
  total_power_production: number;
  total_water_production: number;
  total_solar_production?: number;
}

export default function StatistikenPage() {
  const [data, setData] = useState<FunnelDay[]>([]);
  const [live, setLive] = useState<RegionalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Body hat global overflow-hidden (für Game), hier für Public-Seite zurücksetzen
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [funnelRes, regionalRes] = await Promise.all([
          fetch(`${API_BASE}/api/stats/funnel`),
          fetch(`${API_BASE}/api/stats/regional`),
        ]);
        const funnel = await funnelRes.json();
        const regional = await regionalRes.json();
        if (funnel.ok) setData(funnel.data);
        else setError('Daten konnten nicht geladen werden.');
        if (regional.ok) setLive(regional.data);
      } catch {
        setError('Server nicht erreichbar.');
      } finally {
        setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, []);

  const latest = data[data.length - 1];
  const avgIncome = data.length
    ? Math.round(data.reduce((s, d) => s + d.total_income, 0) / data.length)
    : 0;
  const avgSolar = data.length
    ? Math.round(data.reduce((s, d) => s + d.total_solar_production, 0) / data.length)
    : 0;
  const avgWaterConsumption = data.length
    ? Math.round(data.reduce((s, d) => s + d.total_water_consumption, 0) / data.length)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur px-4 py-3 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white text-sm transition-colors">← Zurück</Link>
            <span className="text-slate-600">|</span>
            <span className="text-sm font-semibold text-slate-200">🇨🇭 Buenzlifight Statistiken</span>
          </div>
          <span className="text-xs text-slate-500">Letzte 30 Tage</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white">Schweizer Gemeinde-Simulator Statistiken</h1>
          <p className="text-slate-400 max-w-xl mx-auto text-sm">
            Aggregierte Echtzeit-Daten aller Gemeinden auf Buenzlifight.ch — Einkommen, Solarstrom, Wasserverbrauch und mehr.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
            <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z"/>
            </svg>
            Lade Statistiken...
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-400 text-sm">{error}</div>
        )}

        {!loading && !error && latest && (
          <>
            {/* Summary row — Live-Daten aus /api/stats/regional */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-amber-400">{fmt(live?.municipality_count ?? latest.municipality_count)}</div>
                <div className="text-xs text-slate-400 mt-1">Aktive Gemeinden</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-slate-200">{fmt(live?.total_population ?? latest.total_population)}</div>
                <div className="text-xs text-slate-400 mt-1">Gesamtbevölkerung</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-yellow-400">{fmt(live?.total_power_production ?? latest.total_power_production)}<span className="text-sm font-normal text-slate-400 ml-1">MW</span></div>
                <div className="text-xs text-slate-400 mt-1">⚡ Strom live</div>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-cyan-400">{fmt(live?.total_water_production ?? latest.total_water_production)}<span className="text-sm font-normal text-slate-400 ml-1">m³/h</span></div>
                <div className="text-xs text-slate-400 mt-1">💧 Wasser live</div>
              </div>
            </div>

            {/* Charts */}
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">📈 Trends der letzten {data.length} Tage</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                <StatCard
                  icon="💰"
                  title="Ø Tageseinkommen (alle Gemeinden)"
                  value={`CHF ${fmt(avgIncome)}`}
                  sub={`Letzter Tag: CHF ${fmt(latest.total_income)}`}
                  trend={data}
                  trendColor="#4ade80"
                />

                <StatCard
                  icon="📉"
                  title="Ø Tagesausgaben"
                  value={`CHF ${fmt(Math.round(data.reduce((s, d) => s + d.total_expenses, 0) / (data.length || 1)))}`}
                  sub={`Letzter Tag: CHF ${fmt(latest.total_expenses)}`}
                  trend={data}
                  trendColor="#f87171"
                />

                <StatCard
                  icon="☀️"
                  title="Ø Solar-Produktion"
                  value={`${fmt(avgSolar)} MW`}
                  sub={`Letzter Tag: ${fmt(latest.total_solar_production)} MW`}
                  trend={data}
                  trendColor="#f97316"
                />

                <StatCard
                  icon="⚡"
                  title="Ø Stromproduktion"
                  value={`${fmt(Math.round(data.reduce((s, d) => s + d.total_power_production, 0) / (data.length || 1)))} MW`}
                  sub={`Letzter Tag: ${fmt(latest.total_power_production)} MW`}
                  trend={data}
                  trendColor="#facc15"
                />

                <StatCard
                  icon="💧"
                  title="Ø Wasserverbrauch"
                  value={`${fmt(avgWaterConsumption)} m³/h`}
                  sub={`Letzter Tag: ${fmt(latest.total_water_consumption)} m³/h`}
                  trend={data}
                  trendColor="#22d3ee"
                />

                <StatCard
                  icon="👥"
                  title="Bevölkerung (letzter Tag)"
                  value={fmt(latest.total_population)}
                  sub={`${latest.municipality_count} Gemeinden`}
                />

              </div>
            </div>

            {/* Raw table */}
            <div>
              <h2 className="text-lg font-semibold text-slate-200 mb-3">📋 Tagesübersicht</h2>
              <div className="overflow-x-auto rounded-xl border border-slate-700/50">
                <table className="w-full text-xs text-slate-300">
                  <thead>
                    <tr className="bg-slate-800/80 text-slate-400 border-b border-slate-700/50">
                      <th className="text-left px-3 py-2">Datum</th>
                      <th className="text-right px-3 py-2">Gemeinden</th>
                      <th className="text-right px-3 py-2">Bevölkerung</th>
                      <th className="text-right px-3 py-2">Einkommen</th>
                      <th className="text-right px-3 py-2">Solar MW</th>
                      <th className="text-right px-3 py-2">Strom MW</th>
                      <th className="text-right px-3 py-2">Wasser m³/h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data].reverse().map((d, i) => (
                      <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="px-3 py-1.5 font-medium text-slate-300">{new Date(d.date).toLocaleDateString('de-CH')}</td>
                        <td className="px-3 py-1.5 text-right">{d.municipality_count}</td>
                        <td className="px-3 py-1.5 text-right">{fmt(d.total_population)}</td>
                        <td className="px-3 py-1.5 text-right text-green-400">CHF {fmt(d.total_income)}</td>
                        <td className="px-3 py-1.5 text-right text-orange-400">{fmt(d.total_solar_production)}</td>
                        <td className="px-3 py-1.5 text-right text-yellow-400">{fmt(d.total_power_production)}</td>
                        <td className="px-3 py-1.5 text-right text-cyan-400">{fmt(d.total_water_consumption)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Ranking */}
            <div>
              <MunicipalityRankingWidget
                onVisit={(slug) => { window.location.href = `/gemeinde/${slug}`; }}
              />
            </div>

            {/* FAQ */}
            <div className="border-t border-slate-800 pt-6 space-y-3">
              <h2 className="text-base font-semibold text-slate-300">Häufige Fragen</h2>
              {[
                {
                  q: 'Was ist Buenzlifight?',
                  a: 'Buenzlifight.ch ist ein kostenloser Schweizer Gemeinde-Simulator. Spieler bauen virtuelle Städte auf, verwalten Budgets, Strom- und Wasserversorgung und konkurrieren mit anderen Gemeinden.',
                },
                {
                  q: 'Woher stammen diese Statistiken?',
                  a: 'Die Daten werden automatisch alle 3 Sekunden vom Spielserver berechnet und täglich als Snapshot gespeichert. Bevölkerung, Einnahmen, Strom- und Wasserproduktion aller aktiven Gemeinden werden aggregiert.',
                },
                {
                  q: 'Was bedeutet "Stromproduktion" und "Wasserproduktion"?',
                  a: 'Stromproduktion ist die Summe aller Kraftwerke (inklusive Solar) aller Gemeinden in MW. Wasserproduktion ist die Kapazität aller Wasserpumpwerke in m³/h. Diese Werte sind Echtzeit-Daten.',
                },
                {
                  q: 'Wie oft werden die Daten aktualisiert?',
                  a: 'Die Live-Werte (Strom, Wasser, Bevölkerung) werden alle 30 Sekunden neu geladen. Die Tagesübersicht zeigt den ersten Snapshot des jeweiligen Tages.',
                },
                {
                  q: 'Kann ich mitmachen?',
                  a: 'Ja! Registriere dich kostenlos auf Buenzlifight.ch, wähle eine Schweizer Gemeinde und fange an zu bauen.',
                },
              ].map(({ q, a }, i) => (
                <details key={i} className="group border border-slate-700/50 rounded-lg overflow-hidden">
                  <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium text-slate-200 hover:bg-slate-800/40 list-none">
                    {q}
                    <span className="text-slate-500 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="px-4 pb-3 pt-1 text-xs text-slate-400 leading-relaxed">{a}</div>
                </details>
              ))}
            </div>

            {/* SEO text */}
            <div className="text-slate-600 text-xs space-y-1">
              <p>
                Buenzlifight.ch ist ein Schweizer Gemeinde-Simulator, bei dem Spieler virtuelle Gemeinden aufbauen, verwalten und miteinander vernetzt werden.
                Diese Statistikseite zeigt aggregierte Daten aller aktiven Gemeinden der letzten 30 Tage.
              </p>
              <p>
                Die Daten umfassen Einnahmen und Ausgaben der Gemeindekassen, Stromproduktion (inklusive Solaranlagen), Wasserverbrauch und -produktion sowie die Gesamtbevölkerung aller Gemeinden.
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 pt-6 text-center">
              <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 mb-1">
                <Link href="/impressum" className="hover:text-amber-300 transition-colors">Impressum</Link>
                <span className="text-slate-700">|</span>
                <Link href="/datenschutz" className="hover:text-amber-300 transition-colors">Datenschutz</Link>
                <span className="text-slate-700">|</span>
                <Link href="/faq" className="hover:text-amber-300 transition-colors">FAQ</Link>
                <span className="text-slate-700">|</span>
                <Link href="/" className="hover:text-amber-300 transition-colors">Jetzt spielen</Link>
              </div>
              <p className="text-slate-600 text-[10px]">BünzliFight © 2026</p>
            </div>
          </>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">📊</div>
            <p>Noch keine Daten vorhanden. Sobald Gemeinden aktiv sind, erscheinen hier die Statistiken.</p>
          </div>
        )}
      </div>

      {/* JSON-LD: WebPage + FAQPage für Google */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': 'https://buenzlifight.ch/statistiken',
            url: 'https://buenzlifight.ch/statistiken',
            name: 'Schweizer Gemeinde-Simulator Statistiken | Buenzlifight',
            description: 'Echtzeit-Statistiken aller virtuellen Gemeinden auf Buenzlifight.ch — Strom, Wasser, Bevölkerung, Einkommen der letzten 30 Tage.',
            inLanguage: 'de-CH',
            isPartOf: { '@id': 'https://buenzlifight.ch' },
          },
          {
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Was ist Buenzlifight?',
                acceptedAnswer: { '@type': 'Answer', text: 'Buenzlifight.ch ist ein kostenloser Schweizer Gemeinde-Simulator. Spieler bauen virtuelle Städte auf, verwalten Budgets, Strom- und Wasserversorgung und konkurrieren mit anderen Gemeinden.' },
              },
              {
                '@type': 'Question',
                name: 'Woher stammen diese Statistiken?',
                acceptedAnswer: { '@type': 'Answer', text: 'Die Daten werden automatisch alle 3 Sekunden vom Spielserver berechnet und täglich als Snapshot gespeichert. Bevölkerung, Einnahmen, Strom- und Wasserproduktion aller aktiven Gemeinden werden aggregiert.' },
              },
              {
                '@type': 'Question',
                name: 'Was bedeutet Stromproduktion und Wasserproduktion?',
                acceptedAnswer: { '@type': 'Answer', text: 'Stromproduktion ist die Summe aller Kraftwerke (inklusive Solar) aller Gemeinden in MW. Wasserproduktion ist die Kapazität aller Wasserpumpwerke in m³/h.' },
              },
              {
                '@type': 'Question',
                name: 'Wie oft werden die Daten aktualisiert?',
                acceptedAnswer: { '@type': 'Answer', text: 'Die Live-Werte werden alle 30 Sekunden neu geladen. Die Tagesübersicht zeigt den ersten Snapshot des jeweiligen Tages.' },
              },
              {
                '@type': 'Question',
                name: 'Kann ich mitmachen?',
                acceptedAnswer: { '@type': 'Answer', text: 'Ja! Registriere dich kostenlos auf Buenzlifight.ch, wähle eine Schweizer Gemeinde und fange an zu bauen.' },
              },
            ],
          },
        ],
      })}} />
    </div>
  );
}
