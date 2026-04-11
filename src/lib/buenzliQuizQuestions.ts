/**
 * Büenzli Quiz Fragen — Schweizer Ordnungs- und Regelwissen
 *
 * Fragen zu Schweizer Büenzli-Themen, Gemeindewissen und allgemeinen Regeln.
 * Jede Frage hat genau 3 Antworten, eine davon korrekt.
 */

export interface BuenzliQuestion {
  question: string;
  answers: [string, string, string];
  correctIndex: number; // 0, 1 oder 2
  category: string;
}

export const BUENZLI_QUESTIONS: BuenzliQuestion[] = [
  // ── Nachtruhe / Sonntagsruhe ──
  {
    question: 'Ab wann gilt in den meisten Schweizer Gemeinden die Nachtruhe?',
    answers: ['20:00 Uhr — sicher isch sicher', '22:00 Uhr — wie sich das ghört', '23:00 Uhr — mer sind doch kei Chinder'],
    correctIndex: 1,
    category: 'sunday_noise',
  },
  {
    question: 'Darf man am Sonntag den Rasenmäher benutzen?',
    answers: ['Klar, de Rase wachst au am Sunntig', 'Nur elektrisch, die sind leiser', 'Nei! Sonntagsruhe gilt für alli Rasenmäher'],
    correctIndex: 2,
    category: 'sunday_noise',
  },
  {
    question: 'Was gilt in vielen Gemeinden zwischen 12:00 und 13:00 Uhr?',
    answers: ['Obligatorisches Znüni', 'Mittagsruhe — kein Lärm bitte!', 'Gratis-Parkieren'],
    correctIndex: 1,
    category: 'sunday_noise',
  },
  {
    question: 'Musik nach 22:00 Uhr in der Wohnung — was gilt?',
    answers: ['Zimmerlautstärke, de Nachbar muess schlafe!', 'Gar kein Musik — stilli Nacht', 'Volle Pulle bis Mitternacht'],
    correctIndex: 0,
    category: 'sunday_noise',
  },
  {
    question: 'Waschmaschine in einem Mehrfamilienhaus — wann ist Schluss?',
    answers: ['20:00 Uhr — de Waschplan seitig so', 'Lauft dure, Maschine chönned nöd lese', '22:00 Uhr und nicht am Sonntag'],
    correctIndex: 2,
    category: 'sunday_noise',
  },
  {
    question: 'Ab wann darf man in der Schweiz Bauarbeiten starten?',
    answers: ['6:00 Uhr — de früeh Vogel!', '7:00 Uhr — und ab 12:00 isch Pause', '8:00 Uhr — mir sind doch zivilisiert'],
    correctIndex: 1,
    category: 'sunday_noise',
  },
  {
    question: 'Feuerwerkskörper ausserhalb vom 1. August und Silvester — was gilt?',
    answers: ['Immer erlaubt, isch lustig!', 'Es bruucht e Bewilligung vo de Gmeind', 'Nur Wunderkerzen sind erlaubt'],
    correctIndex: 1,
    category: 'sunday_noise',
  },

  // ── Zaun / Garten / Grünflächen ──
  {
    question: 'Wie hoch darf ein Zaun in der Schweiz meistens ohne Bewilligung sein?',
    answers: ['1.20 Meter — höcher bruuchts e Bewilligung', '2 Meter — Sichtschutz isch Pflicht', '80 Zentimeter — mir sind kei Gefängnis'],
    correctIndex: 0,
    category: 'fence_too_high',
  },
  {
    question: 'Was passiert, wenn dein Rasen verwildert und der Nachbar reklamiert?',
    answers: ['Nüt, mis Grundstück, mini Regle', 'D Gmeind chan e Mahnung usspräche', 'De Nachbar mues selber mähe'],
    correctIndex: 1,
    category: 'lawn_overgrown',
  },
  {
    question: 'Gartenabfälle im Garten verbrennen — erlaubt?',
    answers: ['Klar, heisst jo Gartefeuer', 'Nur am 1. August', 'In de meischte Kantön verbote!'],
    correctIndex: 2,
    category: 'lawn_overgrown',
  },
  {
    question: 'Bis wann muss im Winter der Gehweg vor dem Haus geräumt sein?',
    answers: ['Bis 7:00 Uhr morgens — suscht haftet de Eigentümer', 'Wenns em Briefträger passt', 'Gar nöd, d Gmeind isch zuständig'],
    correctIndex: 0,
    category: 'lawn_overgrown',
  },

  // ── Recycling / Abfall ──
  {
    question: 'Welche Farbe hat der offizielle Kehrichtsack in den meisten Gemeinden?',
    answers: ['Blau mit Recycling-Logo', 'Schwarz mit Gemeinde-Wappen', 'Grün wie d Hoffnig'],
    correctIndex: 1,
    category: 'recycling_violation',
  },
  {
    question: 'Was passiert bei einem Abfallsack ohne Gebührenmarke?',
    answers: ['Wird eifach mitgnoh', 'Blibt ligge und du kriegsch e Busse bis 300 CHF', 'De Abfallmann schribt en böse Brief'],
    correctIndex: 1,
    category: 'recycling_violation',
  },

  // ── Parkieren ──
  {
    question: 'Parkieren auf einem Gehweg — was riskiert man?',
    answers: ['Nüt, wenn de Auto passt', 'E Busse und Abschleppen', 'Nur Hinweis vo de Polizei'],
    correctIndex: 1,
    category: 'illegal_parking',
  },
  {
    question: 'Velofahren auf dem Trottoir — wer darf das?',
    answers: ['Alli, wenn si langsam fahred', 'Niemert, Trottoir ghört de Fussgänger', 'Chinder under 12 dürfed — suscht verbote!'],
    correctIndex: 2,
    category: 'illegal_parking',
  },

  // ── Hund ──
  {
    question: 'Hundekot nicht aufgeräumt — was droht?',
    answers: ['Nur bösi Blick vom Nachbar', 'E Busse bis 200 CHF — Robidog bruuche!', 'Nüt, de Räge spüelt das weg'],
    correctIndex: 1,
    category: 'dog_unleashed',
  },
  {
    question: 'Wo gilt in der Schweiz meistens Leinenpflicht für Hunde?',
    answers: ['Nirgends, Hünd sind frei!', 'In Siedlige und Parks — Leinepflicht!', 'Nur im Wald während de Bruetzyt'],
    correctIndex: 1,
    category: 'dog_unleashed',
  },

  // ── Wäsche / Sonntag ──
  {
    question: 'Wäsche am Sonntag draussen aufhängen — was meinen die Büenzlis?',
    answers: ['Immer erlaubt, d Sunne scheint gratis', 'In viele Gmeinde verbote!', 'Nur Unterwäsche isch verbote'],
    correctIndex: 1,
    category: 'laundry_sunday',
  },

  // ── Grillen / Rauch ──
  {
    question: 'Grillieren auf dem Balkon — was gilt?',
    answers: ['Verbote, nur im Garte', 'Erlaubt, wenn kein übermässige Rauch entstaht', 'Nur mit schriftlicher Erlaubnis vom Vermieter'],
    correctIndex: 1,
    category: 'bbq_smoke',
  },

  // ── Gemeinde-Wissen ──
  {
    question: 'Wie heisst das oberste Organ einer Schweizer Gemeinde?',
    answers: ['De Gemeindepräsident allein', 'D Gemeindeversammlung oder s Gemeindeparlament', 'Dr Bundesrat — er entscheidet alls'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Wer zahlt die Schulen in einer Schweizer Gemeinde hauptsächlich?',
    answers: ['Der Bund gibt alls', 'D Gmeind und de Kanton gemeinsam', 'Elternbeiträge decken alls'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist eine Gemeindeversammlung?',
    answers: ['E Party für Gemeinderäte', 'Wo Stimmbürger über Gmeind-Sachä abstimmed', 'E Treffe vo Bürgermeister aller Kantone'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Wie viele Gemeinden hat die Schweiz ungefähr?',
    answers: ['Etwa 500', 'Etwa 2000', 'Über 20\'000'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist das Gemeindebudget?',
    answers: ['De Jahresplan für Ausgaben und Einnahmen', 'De Lohn vo Gemeinderat', 'D Strassenbaukosten vom Kanton'],
    correctIndex: 0,
    category: 'ordnung',
  },
  {
    question: 'Was ist eine Gemeindefusion?',
    answers: ['E Zusammenschluss vo zwei oder mehr Gemeinde', 'E neue Sportanlage', 'E Fusion vo zwei Restaurants'],
    correctIndex: 0,
    category: 'ordnung',
  },
  {
    question: 'Wofür sind Gemeindesteuern hauptsächlich?',
    answers: ['Für Bundesausgaben', 'Für lokale Dienstleistunge wie Schule, Strasse, Feuerwehr', 'Nur für Gemeinderats-Salär'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist der Steuerfuss in einer Gemeinde?',
    answers: ['Wie viel Meter Strasse gebaut werd', 'E Multiplikator uf d Staatssteuer — bestimmt wi viel du zahlsch', 'D Anzahl Steuerbeamte'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Welche Gemeinde hat die meisten Einwohner in der Schweiz?',
    answers: ['Bern — weil Bundesstadt', 'Zürich — isch d grössti Stadt', 'Genf — am See isch s schöner'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist eine Einwohnergemeinde?',
    answers: ['Nur für Einheimische', 'D Grundform vo Gmeind, zuständig für alli Einwohner', 'Nur für Schweizer Staatsbürger'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Wer darf in einer Schweizer Gemeindeversammlung abstimmen?',
    answers: ['Alli Einwohner ab 16', 'Stimmberechtigte Schweizer Bürger mit Wohnsitz', 'Nur Grundeigentümer'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist Buenzlifight?',
    answers: ['E Buurespiel wo mer Kühe kämpfe lah', 'En Schweizer Gmeinde-Simulator wo mer baut und verwaltet', 'E Kampfsport-App für Büenzlis'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was bedeutet "kommunal" in der Schweiz?',
    answers: ['Kommunistisch', 'Zur Gemeinde gehörend', 'Kantonale Verwaltung'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Wie heisst der Chef einer kleinen Schweizer Gemeinde?',
    answers: ['Bürgermeister', 'Gemeindepräsident oder Gemeindammann', 'Ortsbeigeordneter'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist ein Zonenplan?',
    answers: ['Fahrplan für Busse', 'Karte wo zeigt was wo gebaut werde darf', 'Plan für Steuerzone'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist eine Bauzone?',
    answers: ['Wo Bauarbeiter essen', 'Gebiet wo Gebäude erstellt werde dürfed', 'Zone ohne Steuern'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist Raumplanung?',
    answers: ['Planung vo Weltraumraketen', 'Geordnete Nutzung vo Land — Wohnen, Gewerbe, Natur', 'Inneneinrichtungsplanung'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist die Gemeindeordnung?',
    answers: ['Regeln zum Abfall entsorgen', 'D Grundverfassung vo de Gmeind — regelt Organisation und Zuständigkeit', 'Öffnungszeiten vom Gemeindehaus'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist ein Gemeinderat?',
    answers: ['Nur e Titel ohne Funktion', 'D Exekutive — führt d Gmeindgeschäfte', 'Alli Einwohner vo de Gmeind'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist der Unterschied zwischen Kanton und Gemeinde?',
    answers: ['Kein Unterschied — isch dasselbe', 'Kanton isch grösser, Gmeind isch d kleinste politischi Einheit', 'Gemeinde isch grösser als Kanton'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Wer baut und unterhält Gemeindestrassen?',
    answers: ['Der Bund zahlt alls', 'D Gmeind — finanziert dure Steuern', 'Private Firmen kostenlos'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was ist ein Bürgerrecht in einer Gemeinde?',
    answers: ['Recht auf gratis Parkieren', 'Zugehörigkeit zur Bürgergemeinde — historische Verbindung', 'Recht auf kostenlose Schule'],
    correctIndex: 1,
    category: 'ordnung',
  },
  {
    question: 'Was macht die Feuerwehr in einer Gemeinde?',
    answers: ['Nur Brände löschen', 'Brände, Überschwemmungen, Rettungen — Katastrophenschutz', 'Nur bei Grossbränden kommen'],
    correctIndex: 1,
    category: 'ordnung',
  },
];

// ── Cooldown-Anzeige-Formatierung ────────────────────────────────────────────

export function formatCooldownRemaining(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} Minute${m !== 1 ? 'n' : ''}`;
}

/**
 * 3 zufällige Fragen ziehen.
 * Wenn ein eventType gegeben ist, wird 1 Frage aus der passenden Kategorie
 * bevorzugt und 2 weitere zufällig ergänzt.
 */
export function getQuizQuestions(eventType?: string): BuenzliQuestion[] {
  const all = [...BUENZLI_QUESTIONS];
  const result: BuenzliQuestion[] = [];

  if (eventType) {
    const matching = all.filter(q => q.category === eventType);
    if (matching.length > 0) {
      const idx = Math.floor(Math.random() * matching.length);
      result.push(matching[idx]);
    }
  }

  const remaining = all.filter(q => !result.includes(q));
  shuffleArray(remaining);

  while (result.length < 3 && remaining.length > 0) {
    result.push(remaining.pop()!);
  }

  shuffleArray(result);
  return result;
}

/** Fisher-Yates Shuffle (in-place) */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
