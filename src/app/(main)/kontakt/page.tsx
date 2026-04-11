import type { Metadata } from 'next';
import Link from 'next/link';
import ContactForm from './ContactForm';

export const metadata: Metadata = {
  title: 'Kontakt & Support',
  description: 'Support und Kontakt für BünzliFight — Bugs melden, Feedback geben, DSGVO-Auskunft.',
};

export default function KontaktPage() {
  return (
    <main className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-[hsl(220,20%,7%)]">
      <div className="fixed inset-0 hero-gradient z-0" />
      <div className="fixed inset-0 bg-black/60 z-[1]" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[2]">
        <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full bg-emerald-400/5 blur-[120px]" />
        <div className="absolute bottom-[15%] right-[8%] w-80 h-80 rounded-full bg-amber-300/5 blur-[130px]" />
      </div>
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent z-10" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-12 pb-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-amber-200 transition-colors mb-10 group text-sm"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:-translate-x-1 transition-transform duration-300"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Zurück zum Spiel
        </Link>

        <header className="mb-10">
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">BünzliFight</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">Kontakt & Support</h1>
          <div className="h-px w-20 bg-gradient-to-r from-amber-300/80 to-transparent mt-4" />
        </header>

        {/* Hinweisbox */}
        <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-5 py-4 mb-8">
          <p className="text-amber-100 text-sm font-medium mb-1">Kein Ticketsystem mit Login</p>
          <p className="text-amber-200/70 text-xs leading-relaxed">
            Du kannst anonym schreiben — Benutzername und E-Mail sind freiwillig. Wenn du deinen Benutzernamen angibst,
            kann ich dir per In-Game-Nachricht antworten.
          </p>
        </div>

        {/* Kontaktformular */}
        <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5 mb-6">
          <h2 className="text-white font-medium text-base mb-5">Nachricht senden</h2>
          <ContactForm />
        </section>

        {/* Community & Steam */}
        <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5 mb-6">
          <h2 className="text-white font-medium text-base mb-4">Community & Steam</h2>
          <p className="text-slate-300 text-sm mb-4 leading-relaxed">
            Für allgemeine Diskussionen, Spielerfragen und Community-Support:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="https://store.steampowered.com/app/4563360/BnzliFight_Swiss_City_Simulator/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-sm border border-white/10 bg-white/5 hover:bg-white/10
                         hover:border-amber-400/30 px-4 py-3 transition-all duration-300 group"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-slate-400 group-hover:text-amber-200 transition-colors shrink-0"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
                <path d="M11.998 2C6.475 2 2 6.475 2 12c0 4.187 2.562 7.764 6.235 9.29l2.256-9.327a2.499 2.499 0 0 1-.241-3.481 2.5 2.5 0 0 1 3.521-.249 2.5 2.5 0 0 1 .249 3.522 2.499 2.499 0 0 1-3.29.587L8.51 21.805C9.604 22.253 10.773 22.5 12 22.5c5.523 0 10-4.477 10-10S17.523 2 11.998 2z" />
              </svg>
              <div>
                <p className="text-sm text-slate-200 group-hover:text-amber-100 transition-colors font-medium">Steam Community Hub</p>
                <p className="text-xs text-slate-500">Diskussionen & Bewertungen</p>
              </div>
            </a>
            <a
              href="https://discord.gg/fSKcZrABEG"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-sm border border-white/10 bg-white/5 hover:bg-white/10
                         hover:border-amber-400/30 px-4 py-3 transition-all duration-300 group"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-slate-400 group-hover:text-amber-200 transition-colors shrink-0"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
              <div>
                <p className="text-sm text-slate-200 group-hover:text-amber-100 transition-colors font-medium">Discord</p>
                <p className="text-xs text-slate-500">Community & Support</p>
              </div>
            </a>
          </div>
        </section>

        {/* Antwortzeit */}
        <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5 mb-6">
          <h2 className="text-white font-medium text-base mb-3">Antwortzeiten</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            Ich antworte in der Regel innerhalb von <span className="text-amber-200/80">1–3 Tagen</span>. Da BünzliFight ein
            privates Hobbyprojekt ist, das ich in meiner Freizeit entwickle, kann es in Ausnahmefällen etwas länger dauern —
            ich bitte um dein Verständnis.
          </p>
        </section>

        {/* DSGVO */}
        <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5 mb-6">
          <h2 className="text-white font-medium text-base mb-4">Deine Datenschutzrechte</h2>
          <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
            <div className="border-l-2 border-amber-400/40 pl-4">
              <p className="text-white font-medium mb-1">Art. 15 DSG / DSGVO — Auskunftsrecht</p>
              <p>
                Du kannst jederzeit Auskunft verlangen, welche Daten wir über dich gespeichert haben.
                Wähle im Formular oben die Kategorie <span className="text-amber-200/80">«DSGVO-Auskunft / Datenlöschung»</span> oder
                schreibe direkt an:
              </p>
              <a
                href="mailto:admin@buenzlifight.ch?subject=DSGVO%20Auskunft"
                className="inline-block mt-2 text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors text-xs"
              >
                admin@buenzlifight.ch — Betreff: DSGVO Auskunft
              </a>
            </div>
            <div className="border-l-2 border-amber-400/40 pl-4">
              <p className="text-white font-medium mb-1">Art. 17 DSG / DSGVO — Recht auf Löschung</p>
              <p>
                Du kannst die Löschung deiner Daten verlangen. Gleicher Kontaktweg wie beim Auskunftsrecht.
              </p>
            </div>
            <div className="rounded-sm border border-white/8 bg-white/3 px-4 py-3 text-xs text-slate-400 space-y-1">
              <p><span className="text-slate-300">Antwortfrist:</span> Wir antworten innerhalb von 30 Tagen.</p>
              <p><span className="text-slate-300">Gespeicherte Daten:</span> Spielkonto (E-Mail, Nickname, Spielstand), Support-Anfragen, technische Logs (IP, Zeitstempel).</p>
              <p><span className="text-slate-300">Datenweitergabe:</span> Keine Weitergabe an Dritte.</p>
              <p className="pt-1">
                <Link href="/datenschutz" className="text-amber-200/60 hover:text-amber-200/90 underline underline-offset-2 transition-colors">
                  Vollständige Datenschutzerklärung →
                </Link>
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link href="/datenschutz" className="hover:text-amber-200 transition-colors">Datenschutz</Link>
          <span className="text-white/15">|</span>
          <Link href="/impressum" className="hover:text-amber-200 transition-colors">Impressum</Link>
          <span className="text-white/15">|</span>
          <Link href="/faq" className="hover:text-amber-200 transition-colors">FAQ</Link>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-slate-500 text-[10px]">
          BünzliFight &copy; 2026
        </div>
      </div>
    </main>
  );
}
