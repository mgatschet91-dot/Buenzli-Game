export interface CantonContent {
  code: string
  name: string
  tagline: string
  description: string
  character: string
  region: string
  language: 'de' | 'fr' | 'it' | 'rm'
  accentColor: string
  emoji: string
  neighbors: string[] // neighboring canton codes for cross-canton links
}

// Popular cities with dedicated landing pages
export const FEATURED_CITIES = [
  { name: 'Zürich', slug: 'zurich', landingPage: '/zuerich-gemeinde-simulator', canton: 'ZH' },
  { name: 'Bern', slug: 'bern', landingPage: '/bern-gemeinde-simulator', canton: 'BE' },
  { name: 'Basel', slug: 'basel', landingPage: '/basel-gemeinde-simulator', canton: 'BS' },
  { name: 'Solothurn', slug: 'solothurn', landingPage: '/solothurn-gemeinde-simulator', canton: 'SO' },
] as const

export const CANTON_CONTENT: Record<string, CantonContent> = {
  AG: {
    code: 'AG',
    name: 'Aargau',
    tagline: 'Aargau \u2013 Brücken, Flüsse und Industriegeschichte',
    description: 'Der Kanton Aargau liegt im Herzen der Schweiz, wo sich Aare, Reuss und Limmat vereinen. Als Industriestandort und Bildungskanton bietet Aargau eine spannende Mischung aus Tradition und Fortschritt. 210 Gemeinden warten auf deinen Aufbau.',
    character: 'Fleissig',
    region: 'Mittelland',
    language: 'de',
    accentColor: 'cyan',
    emoji: '\u{1F30A}',
    neighbors: ['ZH', 'SO', 'BL', 'LU', 'ZG', 'BE'],
  },
  AI: {
    code: 'AI', name: 'Appenzell Innerrhoden', tagline: 'Appenzell I.Rh. \u2013 Tradition trifft auf Landsgemeinde', description: 'Der kleinste Schweizer Kanton pflegt Traditionen wie kaum ein anderer Ort. Hier stimmt man noch an der Landsgemeinde ab und die Hügellandschaft des Alpsteins prägt das Leben.', character: 'Traditionell', region: 'Ostschweiz', language: 'de', accentColor: 'amber', emoji: '\u{1F3D4}\uFE0F',
    neighbors: ['AR', 'SG'],
  },
  AR: {
    code: 'AR', name: 'Appenzell Ausserrhoden', tagline: 'Appenzell A.Rh. \u2013 Zwischen Textiltradition und Innovation', description: 'Appenzell Ausserrhoden verbindet seine reiche Textilgeschichte mit modernem Unternehmergeist. Die Hügellandschaft zwischen Säntis und Bodensee bietet eine einzigartige Kulisse für deine Gemeinde.', character: 'Innovativ', region: 'Ostschweiz', language: 'de', accentColor: 'emerald', emoji: '\u{1F9F5}',
    neighbors: ['AI', 'SG', 'TG'],
  },
  BE: {
    code: 'BE', name: 'Bern', tagline: 'Bern \u2013 Bundesstadt im Herzen der Schweiz', description: 'Als Bundesstadt der Schweiz ist Bern das politische Zentrum des Landes. Von der UNESCO-Altstadt über das Bundeshaus bis zum Emmental \u2013 Bern verbindet Macht, Geschichte und ländlichen Charme. Mit 339 Gemeinden der grösste Kanton im Spiel.', character: 'Souverän', region: 'Mittelland', language: 'de', accentColor: 'red', emoji: '\u{1F43B}',
    neighbors: ['FR', 'SO', 'AG', 'LU', 'OW', 'NW', 'VS', 'VD', 'NE', 'JU'],
  },
  BL: {
    code: 'BL', name: 'Basel-Landschaft', tagline: 'Baselland \u2013 Zwischen Jura und Rhein', description: 'Basel-Landschaft umgibt die Stadt Basel mit sanften Jurahügeln, Kirschblütenhängen und einer starken Wirtschaft. 86 Gemeinden bieten Vielfalt von der Industrie bis zur Landwirtschaft.', character: 'Bodenständig', region: 'Nordwestschweiz', language: 'de', accentColor: 'red', emoji: '\u{1F3DE}\uFE0F',
    neighbors: ['BS', 'SO', 'AG', 'JU'],
  },
  BS: {
    code: 'BS', name: 'Basel-Stadt', tagline: 'Basel \u2013 Kultur, Pharma und Rheinknie', description: 'Basel am Rheinknie ist die Kulturhauptstadt der Schweiz. Art Basel, Pharma-Riesen und die Fasnacht machen diesen Stadtkanton einzigartig. Klein aber mit globalem Einfluss \u2013 3 Gemeinden, maximale Dichte.', character: 'Kulturell', region: 'Nordwestschweiz', language: 'de', accentColor: 'slate', emoji: '\u{1F3A8}',
    neighbors: ['BL'],
  },
  FR: {
    code: 'FR', name: 'Freiburg', tagline: 'Freiburg \u2013 Zweisprachig zwischen Seen und Voralpen', description: 'Freiburg ist der zweisprachige Kanton par excellence: Deutsch und Französisch leben hier Seite an Seite. Von der mittelalterlichen Altstadt über den Greyerzersee bis zu den Voralpen \u2013 129 Gemeinden mit Charakter.', character: 'Zweisprachig', region: 'Westschweiz', language: 'de', accentColor: 'blue', emoji: '\u{1F9C0}',
    neighbors: ['BE', 'VD', 'NE'],
  },
  GE: {
    code: 'GE', name: 'Genf', tagline: 'Genf \u2013 Internationale Stadt am Leman', description: 'Genf ist die internationalste Stadt der Schweiz: UNO, Rotes Kreuz, CERN und Jet d\'eau. Hier trifft Diplomatie auf Luxus und weltweite Bedeutung. 45 Gemeinden mit kosmopolitischem Flair.', character: 'International', region: 'Genferseeregion', language: 'fr', accentColor: 'amber', emoji: '\u26F2',
    neighbors: ['VD'],
  },
  GL: {
    code: 'GL', name: 'Glarus', tagline: 'Glarus \u2013 Berge, Industrie und Landsgemeinde', description: 'Glarus vereint alpine Wildheit mit Industriegeschichte. Der Kanton mit nur 3 Gemeinden hat sich 2011 radikal reformiert und ist heute ein Vorreiter der direkten Demokratie.', character: 'Eigenständig', region: 'Ostschweiz', language: 'de', accentColor: 'green', emoji: '\u{1F3ED}',
    neighbors: ['SZ', 'SG', 'GR', 'UR'],
  },
  GR: {
    code: 'GR', name: 'Graubünden', tagline: 'Graubünden \u2013 Dreisprachig und wildromantisch', description: 'Der grösste Kanton der Schweiz spricht drei Sprachen und bietet 150 Täler. Von Davos über St. Moritz bis ins Engadin \u2013 Graubünden ist Vielfalt pur. 101 Gemeinden in einer einzigartigen Bergwelt.', character: 'Vielfältig', region: 'Graubünden', language: 'de', accentColor: 'stone', emoji: '\u{1F98C}',
    neighbors: ['GL', 'SG', 'TI', 'UR'],
  },
  JU: {
    code: 'JU', name: 'Jura', tagline: 'Jura \u2013 Jüngster Kanton mit eigenem Charakter', description: 'Der 1979 gegründete Kanton Jura ist der jüngste der Schweiz. Uhrenindustrie, sanfte Hügellandschaften und ein starker Identitätssinn prägen die 53 Gemeinden dieses französischsprachigen Kantons.', character: 'Rebellisch', region: 'Westschweiz', language: 'fr', accentColor: 'rose', emoji: '\u2692\uFE0F',
    neighbors: ['BE', 'BL', 'SO', 'NE'],
  },
  LU: {
    code: 'LU', name: 'Luzern', tagline: 'Luzern \u2013 Tor zur Zentralschweiz', description: 'Luzern am Vierwaldstättersee verbindet touristische Weltklasse mit Zentralschweizer Bodenständigkeit. Kapellbrücke, Pilatus und ein lebendiges Kulturleben machen den Kanton mit 80 Gemeinden zum Erlebnis.', character: 'Gastfreundlich', region: 'Zentralschweiz', language: 'de', accentColor: 'blue', emoji: '\u{1F309}',
    neighbors: ['BE', 'AG', 'ZG', 'SZ', 'NW', 'OW', 'UR'],
  },
  NE: {
    code: 'NE', name: 'Neuenburg', tagline: 'Neuenburg \u2013 Uhren, Wein und Jura-Seen', description: 'Neuenburg ist das Herz der Schweizer Uhrenindustrie. Am Neuenburgersee gelegen, verbindet der Kanton Präzisionstechnik mit Weinbau und französischer Lebensart. 27 Gemeinden voller Finesse.', character: 'Präzise', region: 'Westschweiz', language: 'fr', accentColor: 'emerald', emoji: '\u231A',
    neighbors: ['BE', 'FR', 'VD', 'JU'],
  },
  NW: {
    code: 'NW', name: 'Nidwalden', tagline: 'Nidwalden \u2013 Am Fusse des Stanserhorns', description: 'Nidwalden liegt eingebettet zwischen Vierwaldstättersee und Alpen. Der kleine Kanton mit 11 Gemeinden überzeugt mit tiefen Steuern, hoher Lebensqualität und spektakulärer Bergkulisse.', character: 'Naturverbunden', region: 'Zentralschweiz', language: 'de', accentColor: 'red', emoji: '\u{1F3D4}\uFE0F',
    neighbors: ['OW', 'LU', 'UR', 'BE', 'SZ'],
  },
  OW: {
    code: 'OW', name: 'Obwalden', tagline: 'Obwalden \u2013 Heimat des Bruder Klaus', description: 'Obwalden am Sarnersee ist die Heimat des Schweizer Nationalheiligen Bruder Klaus. Der Kanton mit 7 Gemeinden bietet alpine Idylle, Tradition und einen eigenständigen Charakter.', character: 'Besinnlich', region: 'Zentralschweiz', language: 'de', accentColor: 'red', emoji: '\u26EA',
    neighbors: ['NW', 'LU', 'BE', 'UR'],
  },
  SG: {
    code: 'SG', name: 'St. Gallen', tagline: 'St. Gallen \u2013 Stiftsbibliothek und Ostschweizer Wirtschaft', description: 'St. Gallen verbindet UNESCO-Weltkulturerbe mit moderner Ostschweizer Wirtschaftskraft. Von der Stiftsbibliothek über die HSG bis zum Säntis \u2013 77 Gemeinden mit Substanz.', character: 'Gelehrt', region: 'Ostschweiz', language: 'de', accentColor: 'emerald', emoji: '\u{1F4DA}',
    neighbors: ['AI', 'AR', 'TG', 'ZH', 'SZ', 'GL', 'GR'],
  },
  SH: {
    code: 'SH', name: 'Schaffhausen', tagline: 'Schaffhausen \u2013 Rheinfall und nördlichster Kanton', description: 'Schaffhausen beherbergt Europas grössten Wasserfall und liegt als nördlichster Kanton fast vollständig rechts des Rheins. 26 Gemeinden mit mittelalterlichem Charme und Wasserkraft.', character: 'Nördlich', region: 'Ostschweiz', language: 'de', accentColor: 'yellow', emoji: '\u{1F4A7}',
    neighbors: ['ZH', 'TG'],
  },
  SO: {
    code: 'SO', name: 'Solothurn', tagline: 'Solothurn \u2013 Barockstadt mit der magischen 11', description: 'Solothurn ist die schönste Barockstadt der Schweiz und die Zahl 11 ist hier allgegenwärtig: 11 Kirchen, 11 Kapellen, 11 Brunnen. Kompakt, charmant und unterschätzt \u2013 107 Gemeinden warten.', character: 'Charmant', region: 'Mittelland', language: 'de', accentColor: 'red', emoji: '\u{1F3DB}\uFE0F',
    neighbors: ['BE', 'AG', 'BL', 'JU'],
  },
  SZ: {
    code: 'SZ', name: 'Schwyz', tagline: 'Schwyz \u2013 Namensgeber der Schweiz', description: 'Schwyz gab der Schweiz ihren Namen. Der Kanton zwischen Zürichsee und Vierwaldstättersee bewahrt die Gründungsgeschichte der Eidgenossenschaft. 30 Gemeinden mit urschweizerischem Stolz.', character: 'Urschweizerisch', region: 'Zentralschweiz', language: 'de', accentColor: 'red', emoji: '\u{1F1E8}\u{1F1ED}',
    neighbors: ['ZH', 'ZG', 'LU', 'UR', 'GL', 'SG', 'NW'],
  },
  TG: {
    code: 'TG', name: 'Thurgau', tagline: 'Thurgau \u2013 Mostindien am Bodensee', description: 'Der Thurgau am Bodensee trägt den liebevollen Übernamen Mostindien. Obstgärten, sanfte Hügel und 80 Gemeinden bieten ländliche Idylle mit Seezugang.', character: 'Ländlich', region: 'Ostschweiz', language: 'de', accentColor: 'green', emoji: '\u{1F34E}',
    neighbors: ['SH', 'ZH', 'SG', 'AR'],
  },
  TI: {
    code: 'TI', name: 'Tessin', tagline: 'Tessin \u2013 Sonnenstube südlich der Alpen', description: 'Das Tessin ist die italienischsprachige Schweiz: Palmen, Seen und Dolce Vita. Lugano, Locarno und Bellinzona bieten mediterranes Flair mit Schweizer Qualität. 113 Gemeinden im Süden.', character: 'Südlich', region: 'Tessin', language: 'it', accentColor: 'orange', emoji: '\u{1F334}',
    neighbors: ['GR', 'UR', 'VS'],
  },
  UR: {
    code: 'UR', name: 'Uri', tagline: 'Uri \u2013 Gotthard, Tell und Urnersee', description: 'Uri ist das Land von Wilhelm Tell und des Gotthards. Der Kanton am Urnersee ist Durchgangsland und Rückzugsort zugleich. 19 Gemeinden in wilder Berglandschaft.', character: 'Wehrhaft', region: 'Zentralschweiz', language: 'de', accentColor: 'amber', emoji: '\u{1F402}',
    neighbors: ['SZ', 'NW', 'OW', 'LU', 'GL', 'GR', 'TI', 'BE'],
  },
  VD: {
    code: 'VD', name: 'Waadt', tagline: 'Waadt \u2013 Weinberge, Lausanne und Genfersee', description: 'Der Kanton Waadt erstreckt sich von den Lavaux-Weinbergen (UNESCO) über Lausanne als olympische Hauptstadt bis zu den Waadtländer Alpen. 308 Gemeinden \u2013 der zweitgrösste Kanton im Spiel.', character: 'Geniesserisch', region: 'Genferseeregion', language: 'fr', accentColor: 'emerald', emoji: '\u{1F347}',
    neighbors: ['GE', 'FR', 'BE', 'NE', 'VS'],
  },
  VS: {
    code: 'VS', name: 'Wallis', tagline: 'Wallis \u2013 Berge, Wein und Walliser Charakter', description: 'Das Wallis beherbergt das Matterhorn, die grössten Gletscher der Alpen und die meisten Sonnenstunden. Raclette, Fendant und eine Prise Sturheit gehören dazu. 122 Gemeinden mit Charakter.', character: 'Eigensinnig', region: 'Wallis', language: 'de', accentColor: 'red', emoji: '\u{1F3D4}\uFE0F',
    neighbors: ['VD', 'BE', 'UR', 'TI'],
  },
  ZG: {
    code: 'ZG', name: 'Zug', tagline: 'Zug \u2013 Crypto Valley und tiefe Steuern', description: 'Zug ist das Crypto Valley der Schweiz: tiefe Steuern, hohe Lebensqualität und eine boomende Tech-Szene am Zugersee. 11 Gemeinden, maximaler Wohlstand.', character: 'Finanzstark', region: 'Zentralschweiz', language: 'de', accentColor: 'blue', emoji: '\u{1F4B0}',
    neighbors: ['ZH', 'AG', 'LU', 'SZ'],
  },
  ZH: {
    code: 'ZH', name: 'Zürich', tagline: 'Zürich \u2013 Wirtschaftsmetropole am Zürichsee', description: 'Zürich ist die grösste Stadt und das wirtschaftliche Herz der Schweiz. Bahnhofstrasse, ETH, Zürichsee und ein pulsierendes Nachtleben \u2013 hier passiert alles. 162 Gemeinden im stärksten Kanton.', character: 'Ambitioniert', region: 'Zürich', language: 'de', accentColor: 'blue', emoji: '\u{1F3D9}\uFE0F',
    neighbors: ['AG', 'SH', 'TG', 'SG', 'SZ', 'ZG'],
  },
}

export function getCantonContent(cantonCode: string): CantonContent | null {
  return CANTON_CONTENT[cantonCode.toUpperCase()] || null
}
