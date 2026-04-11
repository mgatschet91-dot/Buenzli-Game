'use client';

import { useState } from 'react';

const CATEGORIES = [
  { value: 'bug', label: 'Bug melden' },
  { value: 'feedback', label: 'Feedback / Feature-Wunsch' },
  { value: 'account', label: 'Account / Spielstand' },
  { value: 'dsgvo', label: 'DSGVO-Auskunft / Datenlöschung' },
  { value: 'other', label: 'Sonstiges' },
];

const API_URL = 'https://core.buenzlifight.ch/api/support/contact';

export default function ContactForm() {
  const [category, setCategory] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [privacy, setPrivacy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; id?: number; error?: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!privacy) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          username: username.trim() || undefined,
          email: email.trim() || undefined,
          message,
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ ok: false, error: 'Verbindungsfehler. Bitte versuche es erneut.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-sm border border-emerald-400/40 bg-emerald-500/10 backdrop-blur-sm px-5 py-5">
        <p className="text-emerald-200 font-medium text-sm mb-1">Nachricht gesendet</p>
        <p className="text-emerald-300/70 text-xs leading-relaxed">
          Deine Anfrage wurde erfolgreich übermittelt (Ticket #{result.id}). Ich melde mich so bald wie möglich — entweder
          per In-Game-Nachricht (wenn du deinen Benutzernamen angegeben hast) oder per E-Mail.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
      {result && !result.ok && (
        <div className="rounded-sm border border-red-400/40 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
          {result.error}
        </div>
      )}

      {/* Kategorie */}
      <div className="space-y-1.5">
        <label htmlFor="support-category" className="text-xs text-slate-300 uppercase tracking-wider">
          Kategorie <span className="text-amber-300">*</span>
        </label>
        <select
          id="support-category"
          required
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full h-12 rounded-sm border border-border/50 bg-background/50 px-3 text-sm text-foreground
                     focus:outline-none focus:border-amber-300/70 focus:shadow-[0_0_20px_rgba(251,191,36,0.12)]
                     transition-all duration-300 appearance-none cursor-pointer"
        >
          <option value="" disabled>Bitte wählen…</option>
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Benutzername (optional) */}
      <div className="space-y-1.5">
        <label htmlFor="support-username" className="text-xs text-slate-300 uppercase tracking-wider">
          Benutzername <span className="text-slate-500 normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="support-username"
          type="text"
          maxLength={32}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Dein Spieler-Nickname"
          className="w-full h-12 rounded-sm border border-border/50 bg-background/50 px-3 text-sm text-foreground
                     placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-300/70
                     focus:shadow-[0_0_20px_rgba(251,191,36,0.12)] transition-all duration-300"
        />
        <p className="text-[11px] text-slate-500">
          Mit Benutzername kann ich dir per In-Game-Nachricht antworten.
        </p>
      </div>

      {/* E-Mail (optional) */}
      <div className="space-y-1.5">
        <label htmlFor="support-email" className="text-xs text-slate-300 uppercase tracking-wider">
          E-Mail <span className="text-slate-500 normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="support-email"
          type="email"
          maxLength={255}
          autoComplete="off"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="deine@email.ch"
          className="w-full h-12 rounded-sm border border-border/50 bg-background/50 px-3 text-sm text-foreground
                     placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-300/70
                     focus:shadow-[0_0_20px_rgba(251,191,36,0.12)] transition-all duration-300"
        />
      </div>

      {/* Nachricht */}
      <div className="space-y-1.5">
        <label htmlFor="support-message" className="text-xs text-slate-300 uppercase tracking-wider">
          Nachricht <span className="text-amber-300">*</span>
        </label>
        <textarea
          id="support-message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Beschreibe dein Anliegen so genau wie möglich…"
          className="w-full rounded-sm border border-border/50 bg-background/50 px-3 py-3 text-sm text-foreground
                     placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-300/70
                     focus:shadow-[0_0_20px_rgba(251,191,36,0.12)] transition-all duration-300 resize-none"
        />
        <p className="text-[11px] text-slate-500 text-right">{message.length} / 2000</p>
      </div>

      {/* Datenschutz-Checkbox */}
      <div className="flex items-start gap-3 pt-1">
        <input
          id="support-privacy"
          type="checkbox"
          required
          checked={privacy}
          onChange={e => setPrivacy(e.target.checked)}
          className="mt-0.5 accent-amber-300 w-4 h-4 shrink-0 cursor-pointer"
        />
        <label htmlFor="support-privacy" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
          Ich habe die{' '}
          <a href="/datenschutz" className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors">
            Datenschutzerklärung
          </a>{' '}
          gelesen und bin damit einverstanden, dass meine Angaben zur Bearbeitung meiner Anfrage gespeichert werden.
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting || !privacy}
        className="w-full h-12 rounded-sm bg-amber-400/20 border border-amber-400/40 text-amber-100 text-sm font-medium
                   hover:bg-amber-400/30 hover:border-amber-400/60 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-300 flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
            </svg>
            Wird gesendet…
          </>
        ) : (
          'Nachricht senden'
        )}
      </button>
    </form>
  );
}
