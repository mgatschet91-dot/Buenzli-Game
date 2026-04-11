'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getQuizQuestions, formatCooldownRemaining, type BuenzliQuestion } from '@/lib/buenzliQuizQuestions';
import { fetchActiveMunicipalities, hetzenBuenzli, fetchBuenzliQuizStatus, reportBuenzliQuizFail } from '@/lib/api/verwaltungsApi';

// ── Types ──

interface BuenzliQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventType?: string;
  buenzliServerId?: number;
}

type QuizPhase = 'cooldown' | 'quiz' | 'result' | 'hetzen' | 'done';

interface Municipality {
  municipality_id: number;
  name: string;
  population: number;
}

// ── Flavor Texts ──

const FLAVOR_INTRO = [
  'Halt! Ich hab da e Frag...',
  'Stopp! Ordnig muess si!',
  'Moment! Kenned Sie d Regle?',
  'Achtung, Büenzli-Kontrolle!',
  'So so, und d Vorschrifte kenned Sie?',
];

const FLAVOR_SUCCESS = [
  'Beeindruckend! Sie kenned d Schwizer Ordnig!',
  'Très bien! E wahre Büenzli-Experte!',
  'Chapeau! Mit Ihne isch d Ordnig gsicheret!',
];

const FLAVOR_FAIL = [
  'Hmm... da mues mer nomal id Büecher luege.',
  'Leider nöd bstande. Meh üebe!',
  'Oh nei... d Regle sind doch ganz eifach!',
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Component ──

export default function BuenzliQuizDialog({
  open,
  onOpenChange,
  eventType,
  buenzliServerId,
}: BuenzliQuizDialogProps) {
  // Quiz state
  const [phase, setPhase] = useState<QuizPhase>('quiz');
  const [questions, setQuestions] = useState<BuenzliQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [flavorIntro, setFlavorIntro] = useState('');
  const [flavorResult, setFlavorResult] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Hetzen state
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMuniId, setSelectedMuniId] = useState<number | null>(null);
  const [hetzenLoading, setHetzenLoading] = useState(false);
  const [hetzenResult, setHetzenResult] = useState<{
    xp: number;
    coins: number;
    target_name: string;
  } | null>(null);
  const [hetzenError, setHetzenError] = useState<string | null>(null);
  const [muniLoading, setMuniLoading] = useState(false);

  // Reset all state when dialog opens — Cooldown vom Server prüfen
  useEffect(() => {
    if (!open) return;
    fetchBuenzliQuizStatus().then(({ cooldown_remaining_ms }) => {
      if (cooldown_remaining_ms > 0) {
        setCooldownRemaining(cooldown_remaining_ms);
        setPhase('cooldown');
        return;
      }
      const q = getQuizQuestions(eventType);
      setQuestions(q);
      setCurrentQuestion(0);
      setScore(0);
      setSelectedAnswer(null);
      setPhase('quiz');
      setMunicipalities([]);
      setSelectedMuniId(null);
      setHetzenLoading(false);
      setHetzenResult(null);
      setHetzenError(null);
      setFlavorIntro(randomFrom(FLAVOR_INTRO));
    }).catch(() => {
      // Bei Fehler trotzdem Quiz starten
      const q = getQuizQuestions(eventType);
      setQuestions(q);
      setCurrentQuestion(0);
      setScore(0);
      setSelectedAnswer(null);
      setPhase('quiz');
      setFlavorIntro(randomFrom(FLAVOR_INTRO));
    });
  }, [open, eventType]);

  // Cooldown-Timer: aktualisiert jede Minute per Server-Check
  useEffect(() => {
    if (phase !== 'cooldown') return;
    const interval = setInterval(() => {
      fetchBuenzliQuizStatus().then(({ cooldown_remaining_ms }) => {
        setCooldownRemaining(cooldown_remaining_ms);
        if (cooldown_remaining_ms <= 0) setPhase('quiz');
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [phase]);

  // Handle answer click
  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (selectedAnswer !== null) return; // Already answered
      setSelectedAnswer(answerIndex);

      const isCorrect = answerIndex === questions[currentQuestion].correctIndex;
      const newScore = isCorrect ? score + 1 : score;
      if (isCorrect) setScore(newScore);

      // Wait 1.2s, then advance
      setTimeout(() => {
        setSelectedAnswer(null);
        if (currentQuestion < 2) {
          setCurrentQuestion((prev) => prev + 1);
        } else {
          // Quiz complete — use newScore since setState is async
          setScore(newScore);
          setFlavorResult(randomFrom(newScore >= 2 ? FLAVOR_SUCCESS : FLAVOR_FAIL));
          if (newScore < 2) {
            reportBuenzliQuizFail(); // 12h Sperre auf Server speichern
          }
          setPhase('result');
        }
      }, 1200);
    },
    [selectedAnswer, questions, currentQuestion, score]
  );

  // Load municipalities when entering hetzen phase
  const handleHetzenStart = useCallback(async () => {
    setPhase('hetzen');
    setMuniLoading(true);
    setHetzenError(null);
    try {
      const munis = await fetchActiveMunicipalities();
      setMunicipalities(munis);
    } catch (err) {
      setHetzenError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setMuniLoading(false);
    }
  }, []);

  // Execute hetzen
  const handleHetzenConfirm = useCallback(async () => {
    if (!selectedMuniId) return;
    setHetzenLoading(true);
    setHetzenError(null);
    try {
      const result = await hetzenBuenzli(selectedMuniId, score, buenzliServerId);
      setHetzenResult(result);
      setPhase('done');
    } catch (err) {
      setHetzenError(err instanceof Error ? err.message : 'Fehler beim Hetzen');
    } finally {
      setHetzenLoading(false);
    }
  }, [selectedMuniId, score, buenzliServerId]);

  // Current question data
  const q = questions[currentQuestion];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-zinc-900 border-zinc-700 text-white"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-center text-lg flex items-center justify-center gap-2">
            <span className="text-xl">🔍</span> Büenzli-Inspektor
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          {/* Büenzli Image */}
          <div className="relative w-40 h-40 flex-shrink-0">
            <Image
              src="/images/buenzli_inspektor.png"
              alt="Büenzli-Inspektor"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* ── COOLDOWN PHASE ── */}
          {phase === 'cooldown' && (
            <div className="w-full space-y-4 text-center">
              <p className="text-sm italic text-zinc-400">
                &ldquo;Hmm... Sie müend no etwas lerne, bevor ich Sie wieder teste!&rdquo;
              </p>
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4">
                <p className="text-red-400 font-semibold text-sm mb-1">⏳ Sperre aktiv</p>
                <p className="text-zinc-300 text-sm">
                  Quiz-Sperre wegen nicht bestandenem Test.
                </p>
                <p className="text-amber-400 font-mono text-lg mt-2">
                  {formatCooldownRemaining(cooldownRemaining)}
                </p>
                <p className="text-zinc-500 text-xs mt-1">bis du wieder mitmachen darfst</p>
              </div>
              <Button
                variant="outline"
                className="w-full border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                onClick={() => onOpenChange(false)}
              >
                Schliessen
              </Button>
            </div>
          )}

          {/* ── QUIZ PHASE ── */}
          {phase === 'quiz' && q && (
            <div className="w-full space-y-3">
              {/* Flavor text */}
              <p className="text-sm italic text-zinc-400 text-center">
                &ldquo;{flavorIntro}&rdquo;
              </p>

              {/* Question counter */}
              <p className="text-xs text-zinc-500 text-center">
                Frage {currentQuestion + 1}/3
              </p>

              {/* Question */}
              <p className="text-sm font-semibold text-center text-zinc-100 leading-relaxed">
                {q.question}
              </p>

              {/* Answer buttons */}
              <div className="space-y-2">
                {q.answers.map((answer, idx) => {
                  let btnClass =
                    'w-full text-left text-sm px-4 py-2.5 rounded-lg border transition-colors ';

                  if (selectedAnswer === null) {
                    // Not yet answered
                    btnClass +=
                      'bg-zinc-800 border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 text-zinc-100';
                  } else if (idx === q.correctIndex) {
                    // This is the correct answer — always green
                    btnClass += 'bg-green-600 border-green-500 text-white font-semibold';
                  } else if (idx === selectedAnswer) {
                    // User picked this wrong answer
                    btnClass += 'bg-red-600 border-red-500 text-white';
                  } else {
                    // Other unselected answers
                    btnClass += 'bg-zinc-800/50 border-zinc-700 text-zinc-500';
                  }

                  return (
                    <button
                      key={idx}
                      className={btnClass}
                      onClick={() => handleAnswer(idx)}
                      disabled={selectedAnswer !== null}
                    >
                      {answer}
                    </button>
                  );
                })}
              </div>

              {/* Feedback after answering */}
              {selectedAnswer !== null && (
                <p className="text-xs text-center text-zinc-400 animate-pulse">
                  {selectedAnswer === q.correctIndex ? 'Richtig! ✅' : 'Falsch! ❌'} Nächste Frage...
                </p>
              )}
            </div>
          )}

          {/* ── RESULT PHASE ── */}
          {phase === 'result' && (
            <div className="w-full space-y-4 text-center">
              <div className="text-3xl font-bold">
                {score}/3 {score >= 2 ? '✅' : '❌'}
              </div>

              <p className="text-sm text-zinc-300 italic">
                &ldquo;{flavorResult}&rdquo;
              </p>

              {score >= 2 && (
                <p className="text-xs text-amber-400">
                  Guet gmacht! Du chasch jetzt de Büenzli uf e anderi Gmeind hetze!
                </p>
              )}

              <div className="flex flex-col gap-2">
                {score >= 2 && (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    onClick={handleHetzenStart}
                  >
                    🐕 Büenzli hetzen!
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full border-zinc-600 text-zinc-300 hover:text-white"
                  onClick={() => onOpenChange(false)}
                >
                  Schliessen
                </Button>
              </div>
            </div>
          )}

          {/* ── HETZEN PHASE ── */}
          {phase === 'hetzen' && (
            <div className="w-full space-y-4">
              <p className="text-sm font-semibold text-center text-zinc-200">
                Wohin soll de Büenzli?
              </p>

              {muniLoading ? (
                <div className="text-center text-zinc-400 text-sm py-4">
                  Gmeinde wärded glade...
                </div>
              ) : hetzenError && municipalities.length === 0 ? (
                <div className="text-center text-red-400 text-sm py-4">
                  {hetzenError}
                </div>
              ) : (
                <>
                  <select
                    className="w-full rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-100 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    value={selectedMuniId ?? ''}
                    onChange={(e) => setSelectedMuniId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="" disabled>
                      Gemeinde wählen...
                    </option>
                    {municipalities.map((m) => (
                      <option key={m.municipality_id} value={m.municipality_id}>
                        {m.name} ({m.population} Einwohner)
                      </option>
                    ))}
                  </select>

                  {hetzenError && (
                    <p className="text-xs text-red-400 text-center">{hetzenError}</p>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-zinc-600 text-zinc-300 hover:text-white"
                      onClick={() => setPhase('result')}
                    >
                      Abbrechen
                    </Button>
                    <Button
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      disabled={!selectedMuniId || hetzenLoading}
                      onClick={handleHetzenConfirm}
                    >
                      {hetzenLoading ? 'Wird ghetzt...' : '🚀 Hetzen!'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── DONE PHASE ── */}
          {phase === 'done' && hetzenResult && (
            <div className="w-full space-y-4 text-center">
              <div className="text-2xl">🎉</div>
              <p className="text-sm font-semibold text-green-400">
                De Büenzli isch uf em Weg nach {hetzenResult.target_name}!
              </p>
              <div className="bg-zinc-800 rounded-lg p-3 space-y-1">
                <p className="text-xs text-zinc-400">Belohnig:</p>
                <p className="text-sm text-amber-300 font-semibold">
                  +{hetzenResult.xp} XP &bull; +{hetzenResult.coins} Coins
                </p>
              </div>
              <Button
                className="w-full bg-zinc-700 hover:bg-zinc-600 text-white"
                onClick={() => onOpenChange(false)}
              >
                Schliessen
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
