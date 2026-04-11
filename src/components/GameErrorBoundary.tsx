'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  municipalitySlug?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reported: boolean;
}

export class GameErrorBoundary extends React.Component<Props, State> {
  private _handleWindowError: ((e: ErrorEvent) => void) | null = null;
  private _handleUnhandledRejection: ((e: PromiseRejectionEvent) => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, reported: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  private reportToApi(error: Error | null, componentStack?: string | null) {
    try {
      const apiBase =
        process.env.NEXT_PUBLIC_AUTH_API_URL ||
        process.env.NEXT_PUBLIC_CORE_API_URL ||
        'http://127.0.0.1:4100';
      const userId = typeof window !== 'undefined' ? localStorage.getItem('isocity_user_id') : null;
      const slug =
        this.props.municipalitySlug ||
        (typeof window !== 'undefined'
          ? window.location.pathname.split('/gemeinde/')?.[1]?.split('/')?.[0] || null
          : null);

      fetch(`${apiBase}/api/admin/frontend-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error?.message || String(error),
          stack: error?.stack || null,
          componentStack: componentStack || null,
          url: typeof window !== 'undefined' ? window.location.href : null,
          userId: userId ? Number(userId) : null,
          municipalitySlug: slug || null,
          browser: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }),
      }).catch(() => {});
    } catch (_) {
      // Logging darf nie selbst crashen
    }
  }

  componentDidMount() {
    if (typeof window === 'undefined') return;

    this._handleWindowError = (e: ErrorEvent) => {
      const err = e.error instanceof Error ? e.error : new Error(e.message || 'Unknown error');
      this.reportToApi(err, null);
    };

    this._handleUnhandledRejection = (e: PromiseRejectionEvent) => {
      const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason ?? 'Unhandled rejection'));
      this.reportToApi(err, null);
    };

    window.addEventListener('error', this._handleWindowError);
    window.addEventListener('unhandledrejection', this._handleUnhandledRejection);
  }

  componentWillUnmount() {
    if (typeof window === 'undefined') return;
    if (this._handleWindowError) window.removeEventListener('error', this._handleWindowError);
    if (this._handleUnhandledRejection) window.removeEventListener('unhandledrejection', this._handleUnhandledRejection);
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.state.reported) return;
    this.setState({ reported: true });
    this.reportToApi(error, errorInfo?.componentStack);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const errorMsg = this.state.error?.message || 'Unbekannter Fehler';

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-slate-900/80 p-8 text-center shadow-2xl">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-red-500/10 p-4">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">
            Ups, da ist etwas schiefgelaufen
          </h1>
          <p className="mb-1 text-sm text-slate-400">
            Das Spiel ist auf einen Fehler gestossen. Wir haben den Fehler automatisch gemeldet.
          </p>
          <p className="mb-6 rounded-lg bg-slate-800/60 px-3 py-2 font-mono text-xs text-red-300 break-all">
            {errorMsg.slice(0, 200)}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
            >
              <RefreshCw className="h-4 w-4" />
              Seite neu laden
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
            >
              <Home className="h-4 w-4" />
              Zur Startseite
            </button>
          </div>
        </div>
      </div>
    );
  }
}
