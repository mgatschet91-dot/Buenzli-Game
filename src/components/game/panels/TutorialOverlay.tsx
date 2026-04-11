'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/context/GameContext';
import { getAuthToken } from '@/lib/api/coreApi';
import { ChevronRight, ChevronLeft, X, GraduationCap, MapPin, Zap, Droplets, Home, Store, Factory, Shield, TreePine, DollarSign, Users, Search } from 'lucide-react';

const AUTH_API_BASE_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://127.0.0.1:4100';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Game-Token'] = token;
  }
  return headers;
}

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  hint?: string;
  panel?: string;
  tool?: string;
  highlightPanel?: string; // Panel-Button im Sidebar-Header optisch hervorheben
  highlightTool?: string;  // Werkzeug-Buttons im Sidebar hervorheben (CSS-Glow via data-tool)
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'welcome', // wird dynamisch ersetzt
    description: 'Willkommen bei BünzliFight – dem Schweizer City-Builder! Du wirst jetzt Schritt für Schritt durch die wichtigsten Funktionen deiner Gemeinde geführt.',
    icon: <GraduationCap className="w-6 h-6" />,
  },
  {
    id: 'roads',
    title: 'Strassen bauen',
    description: 'Lege zuerst ein Strassennetz an – das ist die Grundlage für alles andere. Gebäude entstehen nur neben Strassen, also plane das Netz bevor du Zonen oder Gebäude setzt.',
    icon: <MapPin className="w-6 h-6" />,
    hint: 'Tipp: Lege Strassen in einem Raster an für optimale Abdeckung.',
    tool: 'road',
    highlightTool: 'roads',
  },
  {
    id: 'power',
    title: 'Stromversorgung',
    description: 'Baue Kraftwerke um deine Gemeinde mit Strom zu versorgen. Bei einem Defizit kauft das Spiel automatisch Strom vom Markt zu – das kostet Fr. 2 pro Einheit (mit einer Partner-Gemeinde nur Fr. 1.60). Überschüssigen Strom kannst du im Marktplatz verkaufen.',
    icon: <Zap className="w-6 h-6" />,
    hint: 'Tipp: Deine Stromübersicht (Produktion, Verbrauch, Bilanz) findest du im Gemeinde-Panel unter "Budget & Finanzen". Den Energiehandel findest du im Marktplatz-Panel.',
    tool: 'power_plant',
    highlightTool: 'energie',
  },
  {
    id: 'water',
    title: 'Wasserversorgung',
    description: 'Baue Wassertürme damit deine Bürger Wasser haben. Auch Wassertürme müssen über Strassen erreichbar sein. Ohne Wasser wächst die Gemeinde nicht.',
    icon: <Droplets className="w-6 h-6" />,
    hint: 'Tipp: Die Wasser-Bilanz (Produktion vs. Verbrauch) siehst du im Gemeinde-Panel unter "Budget & Finanzen".',
    tool: 'water_tower',
    highlightTool: 'utilities',
  },
  {
    id: 'zones',
    title: 'Zonen platzieren',
    description: 'Jetzt wo Strassen, Strom und Wasser stehen: Setze Zonen! Wähle Wohngebiet (grün), Gewerbegebiet (orange) oder Industriegebiet (gelb) und klicke auf Felder neben Strassen. Dort wachsen dann automatisch Gebäude.',
    icon: <Home className="w-6 h-6" />,
    hint: 'Tipp: Beginne mit Wohngebiet, dann Gewerbe und Industrie. Wohngebiet braucht Wasser, Strom und Strassenzugang zum Wachsen.',
    tool: 'zone_residential',
    highlightTool: 'zones',
  },
  {
    id: 'services',
    title: 'Öffentliche Dienste',
    description: 'Deine Bürger brauchen Sicherheit und Gesundheit: Baue eine Polizeistation und eine Feuerwache. Später kommen Spital, Schule und Parks dazu – das steigert die Zufriedenheit.',
    icon: <Shield className="w-6 h-6" />,
    hint: 'Tipp: Platziere Dienste zentral für maximale Abdeckung.',
    tool: 'police_station',
    highlightTool: 'services',
  },
  {
    id: 'environment',
    title: 'Umwelt & Parks',
    description: 'Bäume und Parks erhöhen die Umweltqualität und die Zufriedenheit deiner Bürger. Platziere Parks neben Wohngebieten für den besten Effekt.',
    icon: <TreePine className="w-6 h-6" />,
    tool: 'park',
    highlightTool: 'parks',
  },
  {
    id: 'budget',
    title: 'Budget verwalten',
    description: 'Im Gemeinde-Panel unter "Budget & Finanzen" stellst du Steuern und Ausgaben ein: Polizei, Feuerwehr, Gesundheit, Bildung, Transport, Parks, Strom und Wasser.',
    icon: <DollarSign className="w-6 h-6" />,
    hint: 'Tipp: Halte die Ausgaben im Gleichgewicht – zu wenig führt zu schlechter Versorgung, zu viel zum Bankrott.',
    panel: 'gemeinde',
    highlightTool: 'panel-gemeinde',
  },
  {
    id: 'statistics',
    title: 'Statistiken beobachten',
    description: 'Das Statistik-Panel zeigt dir Bevölkerung, Geld und Zufriedenheit über Zeit. Behalte diese Werte im Auge – sie zeigen ob deine Gemeinde wächst oder stagniert.',
    icon: <Users className="w-6 h-6" />,
    panel: 'statistics',
    highlightTool: 'panel-statistics',
  },
  {
    id: 'buenzli',
    title: 'Der Büenzli-Inspektor',
    description: 'Der Büenzli ist der typisch schweizerische Gemeinde-Inspektor – penibel, korrekt, unbestechlich. Aktiviere das Inspektions-Werkzeug und er sucht 10 Minuten nach Vergehen: Lärmbelästigung, Abfallsünden, Bausünden und mehr.',
    icon: <Search className="w-6 h-6" />,
    hint: 'Tipp: Gemeldete Vergehen können von Firmen behoben werden – das bringt Geld und senkt die Kriminalität.',
    tool: 'inspect',
    highlightTool: 'inspect',
  },
  {
    id: 'done',
    title: 'Tutorial abgeschlossen!',
    description: 'Du kennst jetzt die Grundlagen von BünzliFight! Entdecke weitere Features wie Firmen gründen, Handel mit anderen Gemeinden und Partnerschaften.',
    icon: <GraduationCap className="w-6 h-6" />,
  },
];

export function TutorialOverlay() {
  const { setActivePanel, state } = useGame();
  const cityName = state.cityName || 'deiner Gemeinde';
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedBefore, setHasCompletedBefore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const res = await fetch(`${AUTH_API_BASE_URL}/api/tutorial/status`, {
          headers: getAuthHeaders(),
        });
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (cancelled) return;
        if (json.ok && json.data) {
          if (json.data.completed) {
            setHasCompletedBefore(true);
            setIsOpen(false);
          } else {
            setCurrentStep(json.data.step || 0);
            setIsOpen(true);
          }
        } else {
          setIsOpen(true);
        }
      } catch {
        setIsOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadStatus();
    return () => { cancelled = true; };
  }, []);

  const saveProgress = useCallback(async (step: number) => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await fetch(`${AUTH_API_BASE_URL}/api/tutorial/progress`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ step }),
      });
    } catch { /* ignore */ } finally {
      savingRef.current = false;
    }
  }, []);

  const markComplete = useCallback(async () => {
    try {
      await fetch(`${AUTH_API_BASE_URL}/api/tutorial/complete`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch { /* ignore */ }
  }, []);

  const resetTutorial = useCallback(async () => {
    try {
      await fetch(`${AUTH_API_BASE_URL}/api/tutorial/reset`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch { /* ignore */ }
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      saveProgress(next);
    } else {
      handleClose();
    }
  }, [currentStep, saveProgress]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      saveProgress(prev);
    }
  }, [currentStep, saveProgress]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setHasCompletedBefore(true);
    markComplete();
  }, [markComplete]);

  const handleRestart = useCallback(() => {
    setCurrentStep(0);
    setIsOpen(true);
    setHasCompletedBefore(false);
    resetTutorial();
  }, [resetTutorial]);

  // CSS einmalig injizieren für Tool-Glow
  useEffect(() => {
    const styleId = 'tutorial-tool-glow-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes tutorial-tool-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0); outline: 2px solid rgba(251,191,36,0.35); }
          50% { box-shadow: 0 0 10px 3px rgba(251,191,36,0.45); outline: 2px solid rgba(251,191,36,1); }
        }
        body[data-tutorial-tool="roads"] [data-submenu="roads"],
        body[data-tutorial-tool="energie"] [data-submenu="energie"],
        body[data-tutorial-tool="utilities"] [data-submenu="utilities"],
        body[data-tutorial-tool="services"] [data-submenu="services"],
        body[data-tutorial-tool="parks"] [data-submenu="parks"],
        body[data-tutorial-tool="inspect"] [data-tool="inspect"],
        body[data-tutorial-tool="zones"] [data-tool="zone_residential"],
        body[data-tutorial-tool="zones"] [data-tool="zone_commercial"],
        body[data-tutorial-tool="zones"] [data-tool="zone_industrial"],
        body[data-tutorial-tool="panel-gemeinde"] [data-panel="gemeinde"],
        body[data-tutorial-tool="panel-statistics"] [data-panel="statistics"] {
          animation: tutorial-tool-glow 1.4s ease-in-out infinite;
          outline-offset: 1px;
          border-radius: 8px;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      document.body.removeAttribute('data-tutorial-tool');
    };
  }, []);

  // Body-Attribute für Tool-Glow setzen
  useEffect(() => {
    const step = TUTORIAL_STEPS[currentStep];
    if (isOpen && step?.highlightTool) {
      document.body.setAttribute('data-tutorial-tool', step.highlightTool);
    } else {
      document.body.removeAttribute('data-tutorial-tool');
    }
  }, [currentStep, isOpen]);

  // Panel-Button im Sidebar-Header hervorheben
  useEffect(() => {
    const panelToHighlight = TUTORIAL_STEPS[currentStep]?.highlightPanel;
    if (!panelToHighlight || !isOpen) {
      setHighlightRect(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-panel="${panelToHighlight}"]`);
      setHighlightRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [currentStep, isOpen]);

  const step = TUTORIAL_STEPS[currentStep];
  const stepTitle = step.id === 'welcome' ? `Willkommen in ${cityName}!` : step.title;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  if (loading) return null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Pulsierender Ring auf dem Panel-Button */}
      {highlightRect && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: highlightRect.left + highlightRect.width / 2,
            top: highlightRect.top + highlightRect.height / 2,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="absolute inline-flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/30 animate-ping" />
          <span className="relative inline-flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        </div>
      )}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto w-[420px] max-w-[calc(100vw-2rem)]">
        <div className="bg-slate-900/95 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-1 bg-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <div className="flex items-center gap-2 text-emerald-400">
              {step.icon}
              <span className="text-xs font-medium text-slate-400">
                Schritt {currentStep + 1}/{TUTORIAL_STEPS.length}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-slate-500 hover:text-white transition-colors p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 pb-2">
            <h3 className="text-base font-semibold text-white mb-1.5">{stepTitle}</h3>
            <p className="text-sm text-slate-300 leading-relaxed">{step.description}</p>
            {step.hint && (
              <p className="text-xs text-amber-400/80 mt-2 italic">{step.hint}</p>
            )}
            {step.id === 'done' && (
              <div className="mt-3 flex items-center gap-3 text-xs">
                <a
                  href="/quick-guide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  📖 Zum Handbuch
                </a>
                <span className="text-slate-600">·</span>
                <a
                  href="https://discord.gg/fSKcZrABEG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#5865F2] hover:text-[#7289DA] transition-colors"
                >
                  Discord
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700/50">
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrev}
                  className="h-8 text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  Zurück
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClose}
                className="h-8 text-xs text-slate-500 hover:text-slate-300"
              >
                Überspringen
              </Button>
              {step.panel && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActivePanel(step.panel as 'budget' | 'statistics')}
                  className="h-8 text-xs border-blue-500/40 text-blue-300 hover:bg-blue-500/15"
                >
                  Öffnen
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {currentStep === TUTORIAL_STEPS.length - 1 ? 'Fertig!' : 'Weiter'}
                {currentStep < TUTORIAL_STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
