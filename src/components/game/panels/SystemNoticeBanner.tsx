'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone } from 'lucide-react';

interface SystemNotice {
  id: number;
  title: string;
  message: string;
  format: 'normal' | 'bold' | 'italic' | 'small';
}

export function SystemNoticeBanner() {
  const [notices, setNotices] = useState<SystemNotice[]>([]);

  const dismiss = useCallback((id: number) => {
    setNotices(prev => prev.filter(n => n.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail as { title?: string; message: string; format?: string };
      if (!d?.message) return;
      const notice: SystemNotice = {
        id: Date.now(),
        title: d.title || 'Nachricht von Bünzlifight Management',
        message: d.message,
        format: (['bold', 'italic', 'small'].includes(d.format ?? '') ? d.format : 'normal') as SystemNotice['format'],
      };
      setNotices([notice]);
      setTimeout(() => dismiss(notice.id), 45000);
    };
    window.addEventListener('system-notice', handler);
    return () => window.removeEventListener('system-notice', handler);
  }, [dismiss]);

  if (notices.length === 0) return null;
  if (typeof document === 'undefined') return null;

  // Immer nur die neueste Nachricht anzeigen
  const [active] = [...notices].reverse();

  return createPortal(
    <>
      <style>{`
        @keyframes noticeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.92); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes chipIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 40px 0px rgba(250,204,21,0.10), 0 32px 64px -16px rgba(0,0,0,0.9); }
          50%       { box-shadow: 0 0 40px 8px rgba(250,204,21,0.22), 0 32px 64px -16px rgba(0,0,0,0.9); }
        }
      `}</style>

      {/* Backdrop (nur bei aktiver Nachricht) */}
      <div
        className="fixed inset-0 z-[9990] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(1px)' }}
      />

      {/* Haupt-Banner — zentriert im oberen Drittel */}
      <div
        className="fixed z-[9999] pointer-events-auto"
        style={{
          top: '30%',
          left: '50%',
          width: 'min(560px, calc(100vw - 32px))',
          animation: 'noticeIn 0.35s cubic-bezier(0.34,1.4,0.64,1) both, glowPulse 2.5s ease-in-out 0.5s 4',
        }}
      >
        {/* Glow-Rand */}
        <div className="absolute -inset-px rounded-2xl"
          style={{ background: 'linear-gradient(135deg, rgba(250,204,21,0.5), rgba(251,146,60,0.3), rgba(250,204,21,0.1))' }} />

        <div className="relative rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #0f0a00 0%, #1a1200 60%, #0d0d0d 100%)',
            boxShadow: '0 32px 64px -16px rgba(0,0,0,0.95)',
          }}>

          {/* Goldene Akzentlinie */}
          <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, transparent, #fbbf24, #f59e0b, #fbbf24, transparent)' }} />

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5"
            style={{ background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.15)' }}>
            <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
              style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)' }}>
              <Megaphone className="w-4 h-4 text-yellow-400" />
            </div>
            <span className="text-yellow-300 text-sm font-bold tracking-wide flex-1">
              {active.title}
            </span>
            <div className="w-7 h-7 shrink-0" />
          </div>

          {/* Nachricht */}
          <div className="px-5 py-5">
            <p className={`text-white leading-relaxed ${
              active.format === 'bold'   ? 'font-bold text-lg' :
              active.format === 'italic' ? 'italic text-base text-slate-200' :
              active.format === 'small'  ? 'text-sm text-slate-300' :
              'text-base'
            }`}>
              {active.message}
            </p>
          </div>

          {/* Footer */}
          <div className="px-5 pb-4 flex justify-end">
            <button
              onClick={() => dismiss(active.id)}
              className="text-xs px-4 py-1.5 rounded-full border border-slate-600 text-slate-400 hover:border-yellow-500/50 hover:text-yellow-300 transition-all"
            >
              Verstanden
            </button>
          </div>
        </div>
      </div>

    </>,
    document.body
  );
}
