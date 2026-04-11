import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung',
  description:
    'Datenschutzerklärung von BünzliFight — ein privates Hobbyprojekt von Marc Gatschet.',
};

export default function DatenschutzPage() {
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
          <p className="text-amber-200/80 text-xs tracking-[0.3em] uppercase mb-3">
            BünzliFight
          </p>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
            Datenschutzerklärung
          </h1>
          <div className="h-px w-20 bg-gradient-to-r from-amber-300/80 to-transparent mt-4" />
          <p className="mt-4 text-slate-300 text-sm leading-relaxed max-w-xl">
            Stand: Februar 2026
          </p>
        </header>

        <div className="rounded-sm border border-amber-400/30 bg-amber-500/15 backdrop-blur-sm px-5 py-4 mb-8">
          <p className="text-amber-100 text-sm font-medium mb-1">Privates Hobbyprojekt</p>
          <p className="text-amber-200/70 text-xs">
            BünzliFight wird von mir, Marc Gatschet, als Privatperson betrieben. Es handelt sich
            um ein nicht-kommerzielles Hobbyprojekt — nicht um ein Angebot einer Firma.
          </p>
        </div>

        <div className="space-y-6">
          <Section title="1. Verantwortliche Person">
            <p>Verantwortlich für die Datenverarbeitung auf dieser Website:</p>
            <div className="mt-2 space-y-0.5">
              <p className="text-white font-medium">Marc Gatschet</p>
              <p>Bielstrasse 2</p>
              <p>2540 Grenchen, Schweiz</p>
              <p className="mt-2">
                E-Mail:{' '}
                <a
                  href="mailto:admin@buenzlifight.ch"
                  className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors"
                >
                  admin@buenzlifight.ch
                </a>
              </p>
            </div>
            <p className="mt-3">
              Da ich als Privatperson handle und nicht als Unternehmen, ist kein Datenschutzbeauftragter
              bestellt. Bei Fragen zum Datenschutz kannst du dich direkt an mich wenden.
            </p>
          </Section>

          <Section title="2. Welche Daten werden erhoben?">
            <p>Bei der Registrierung werden folgende Daten gespeichert:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
              <li>E-Mail-Adresse (für Login und Kontowiederherstellung)</li>
              <li>Nickname / Spielername (wird im Spiel angezeigt)</li>
              <li>Vorname und Nachname</li>
              <li>Geschlecht und Geburtsdatum</li>
              <li>Gewählte Gemeinde</li>
            </ul>
            <p className="mt-3">Während der Nutzung des Spiels werden zusätzlich gespeichert:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
              <li>Spielfortschritt (Gebäude, Ressourcen, Achievements)</li>
              <li>Chat-Nachrichten innerhalb des Spiels</li>
              <li>Spielaktionen (z.B. Gebäude platzieren, Handel)</li>
            </ul>
          </Section>

          <Section title="3. Zweck der Datenverarbeitung">
            <p>Deine Daten werden ausschliesslich für den Betrieb des Spiels verwendet:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
              <li>Kontoverwaltung und Authentifizierung</li>
              <li>Spielstand-Speicherung und -Synchronisation</li>
              <li>Gemeinde-Zuordnung und Multiplayer-Funktionen</li>
              <li>Anzeige deines Nicknames im Spiel</li>
            </ul>
            <p className="mt-3">
              Es findet <strong className="text-white">keine</strong> Datenverarbeitung zu
              Werbezwecken, Profiling oder Marketing statt. Ich verdiene kein Geld mit diesem
              Projekt und habe kein Interesse an deinen Daten über den Spielbetrieb hinaus.
            </p>
          </Section>

          <Section title="4. Speicherung und Sicherheit">
            <p>
              Passwörter werden verschlüsselt (gehasht) gespeichert und sind auch für mich
              nicht einsehbar. Die Daten werden auf Servern in der Schweiz bzw. Europa gehostet.
            </p>
            <p className="mt-2">
              Als Privatperson und Hobby-Entwickler treffe ich angemessene technische Massnahmen
              zum Schutz deiner Daten. Eine 100%-ige Sicherheit kann jedoch — wie bei jedem
              Online-Dienst — nicht garantiert werden.
            </p>
          </Section>

          <Section title="5. Weitergabe an Dritte">
            <p>
              Deine Daten werden <strong className="text-white">nicht</strong> an Dritte verkauft,
              vermietet oder weitergegeben. Eine Weitergabe erfolgt nur, wenn ich gesetzlich
              dazu verpflichtet bin.
            </p>
          </Section>

          <Section title="6. Cookies und lokale Speicherung">
            <p>
              BünzliFight verwendet <strong className="text-white">keine</strong> Tracking-Cookies
              und keine Analyse-Tools (kein Google Analytics o.ä.).
            </p>
            <p className="mt-2">
              Für die Sitzungsverwaltung wird ein Authentifizierungs-Token im localStorage
              deines Browsers gespeichert. Dieser ist technisch notwendig, damit du eingeloggt
              bleibst. Du kannst diesen jederzeit löschen, indem du dich ausloggst.
            </p>
          </Section>

          <Section title="7. Deine Rechte">
            <p>Du hast jederzeit das Recht auf:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-slate-300">
              <li><strong className="text-white">Auskunft</strong> — welche Daten über dich gespeichert sind</li>
              <li><strong className="text-white">Berichtigung</strong> — falls deine Daten fehlerhaft sind</li>
              <li><strong className="text-white">Löschung</strong> — du kannst die Löschung deines Kontos und aller Daten verlangen</li>
              <li><strong className="text-white">Datenexport</strong> — du kannst eine Kopie deiner Daten anfordern</li>
            </ul>
            <p className="mt-3">
              Wende dich dazu einfach per E-Mail an{' '}
              <a
                href="mailto:admin@buenzlifight.ch"
                className="text-amber-200/80 hover:text-amber-100 underline underline-offset-2 transition-colors"
              >
                admin@buenzlifight.ch
              </a>
              . Ich kümmere mich so schnell wie möglich darum.
            </p>
          </Section>

          <Section title="8. Minderjährige">
            <p>
              BünzliFight richtet sich nicht gezielt an Kinder unter 13 Jahren. Wenn du unter
              16 Jahre alt bist, bitte deine Eltern um Erlaubnis, bevor du dich registrierst.
            </p>
          </Section>

          <Section title="9. Änderungen">
            <p>
              Ich behalte mir vor, diese Datenschutzerklärung bei Bedarf anzupassen — zum
              Beispiel bei neuen Features oder geänderten rechtlichen Anforderungen.
              Wesentliche Änderungen werden im Spiel kommuniziert.
            </p>
          </Section>
        </div>

        <div className="mt-12 flex items-center justify-center gap-4 text-xs text-slate-400">
          <Link href="/impressum" className="hover:text-amber-200 transition-colors">
            Impressum
          </Link>
          <span className="text-white/15">|</span>
          <Link href="/faq" className="hover:text-amber-200 transition-colors">
            FAQ
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 text-center text-slate-500 text-[10px]">
          BünzliFight &copy; 2026
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm p-5">
      <h2 className="text-white font-medium text-base mb-3">{title}</h2>
      <div className="text-sm text-slate-200 leading-relaxed">{children}</div>
    </section>
  );
}
