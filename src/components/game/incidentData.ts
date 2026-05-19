/**
 * Incident Data - Crime types, fire types, and their descriptions
 * Comprehensive incident system for city simulation
 */

// ============================================================================
// CRIME TYPES
// ============================================================================

export type CrimeType =
  // Violent Crimes
  | 'armed_robbery'
  | 'mugging'
  | 'assault'
  | 'aggravated_assault'
  | 'carjacking'
  | 'kidnapping'
  | 'hostage_situation'
  | 'gang_violence'
  | 'shooting'
  | 'stabbing'
  
  // Property Crimes
  | 'burglary'
  | 'home_invasion'
  | 'commercial_burglary'
  | 'car_theft'
  | 'bike_theft'
  | 'package_theft'
  | 'shoplifting'
  | 'smash_and_grab'
  | 'warehouse_theft'
  | 'construction_theft'
  
  // Financial Crimes
  | 'fraud'
  | 'identity_theft'
  | 'credit_card_fraud'
  | 'insurance_fraud'
  | 'embezzlement'
  | 'counterfeiting'
  
  // Public Order
  | 'disturbance'
  | 'public_intoxication'
  | 'disorderly_conduct'
  | 'noise_complaint'
  | 'loitering'
  | 'trespassing'
  | 'public_urination'
  | 'street_racing'
  | 'illegal_dumping'
  
  // Drug Related
  | 'drug_dealing'
  | 'drug_possession'
  | 'illegal_dispensary'
  | 'public_drug_use'
  
  // Traffic & Vehicle
  | 'hit_and_run'
  | 'dui'
  | 'reckless_driving'
  | 'traffic_violation'
  | 'parking_violation'
  | 'illegal_street_vendor'
  
  // Vandalism & Destruction
  | 'vandalism'
  | 'graffiti'
  | 'arson_attempt'
  | 'property_damage'
  | 'broken_windows'
  
  // Other
  | 'suspicious_activity'
  | 'prowler'
  | 'stalking'
  | 'domestic_disturbance'
  | 'animal_cruelty'
  | 'illegal_gambling'
  | 'prostitution'
  | 'solicitation';

export interface CrimeData {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number; // seconds before incident expires if unresponded
  weight: number; // relative spawn frequency (higher = more common)
}

export const CRIME_DATA: Record<CrimeType, CrimeData> = {
  // Gewalttaten (kritisch/hoch, lange Dauer)
  armed_robbery: {
    name: 'Bewaffneter Raub',
    description: 'Bewaffneter Verdächtiger bedroht Zivilisten. Waffe gezogen.',
    severity: 'critical',
    duration: 45,
    weight: 3,
  },
  mugging: {
    name: 'Strassenraub',
    description: 'Opfer wird auf der Strasse ausgeraubt. Verdächtiger flüchtet.',
    severity: 'high',
    duration: 30,
    weight: 5,
  },
  assault: {
    name: 'Körperverletzung',
    description: 'Körperliche Auseinandersetzung im Gange. Mehrere Beteiligte.',
    severity: 'high',
    duration: 25,
    weight: 6,
  },
  aggravated_assault: {
    name: 'Schwere Körperverletzung',
    description: 'Gewalttätiger Angriff mit möglicher Waffe. Opfer verletzt.',
    severity: 'critical',
    duration: 40,
    weight: 2,
  },
  carjacking: {
    name: 'Fahrzeugraub',
    description: 'Bewaffneter Verdächtiger stiehlt Fahrzeug vom Fahrer.',
    severity: 'critical',
    duration: 35,
    weight: 2,
  },
  kidnapping: {
    name: 'Entführung',
    description: 'Person wird in Fahrzeug gezwungen. Dringende Reaktion.',
    severity: 'critical',
    duration: 50,
    weight: 1,
  },
  hostage_situation: {
    name: 'Geiselnahme',
    description: 'Bewaffneter Verdächtiger hält Geiseln. Verhandler benötigt.',
    severity: 'critical',
    duration: 60,
    weight: 0.5,
  },
  gang_violence: {
    name: 'Bandengewalt',
    description: 'Rivalisierende Gruppen in Konfrontation. Mehrere Verdächtige.',
    severity: 'critical',
    duration: 40,
    weight: 2,
  },
  shooting: {
    name: 'Schüsse gemeldet',
    description: 'Schüsse gemeldet. Mögliche Verletzte.',
    severity: 'critical',
    duration: 45,
    weight: 1,
  },
  stabbing: {
    name: 'Messerangriff',
    description: 'Messerangriff gemeldet. Medizinische Hilfe benötigt.',
    severity: 'critical',
    duration: 40,
    weight: 1.5,
  },

  // Eigentumsdelikte (mittel/hoch)
  burglary: {
    name: 'Einbruch',
    description: 'Einbruch festgestellt. Verdächtiger im Gebäude.',
    severity: 'high',
    duration: 30,
    weight: 8,
  },
  home_invasion: {
    name: 'Hauseinbruch',
    description: 'Eindringling in bewohntem Haus. Bewohner in Gefahr.',
    severity: 'critical',
    duration: 35,
    weight: 3,
  },
  commercial_burglary: {
    name: 'Geschäftseinbruch',
    description: 'Einbruch in Geschäft im Gange. Alarm ausgelöst.',
    severity: 'high',
    duration: 28,
    weight: 6,
  },
  car_theft: {
    name: 'Autodiebstahl',
    description: 'Fahrzeug wird gestohlen. Verdächtiger bricht Auto auf.',
    severity: 'medium',
    duration: 22,
    weight: 10,
  },
  bike_theft: {
    name: 'Fahrraddiebstahl',
    description: 'Fahrrad wird gestohlen. Verdächtiger durchtrennt Schloss.',
    severity: 'low',
    duration: 15,
    weight: 12,
  },
  package_theft: {
    name: 'Paketdiebstahl',
    description: 'Gelieferte Pakete werden vom Eingang gestohlen.',
    severity: 'low',
    duration: 12,
    weight: 15,
  },
  shoplifting: {
    name: 'Ladendiebstahl',
    description: 'Diebstahl im Detailhandel. Verdächtiger flüchtet.',
    severity: 'low',
    duration: 15,
    weight: 20,
  },
  smash_and_grab: {
    name: 'Schaufenstereinbruch',
    description: 'Scheibe eingeschlagen. Mehrere Verdächtige greifen Waren.',
    severity: 'high',
    duration: 25,
    weight: 4,
  },
  warehouse_theft: {
    name: 'Lagerdiebstahl',
    description: 'Grosser Diebstahl in Industrieanlage.',
    severity: 'high',
    duration: 35,
    weight: 3,
  },
  construction_theft: {
    name: 'Baustellendiebstahl',
    description: 'Ausrüstung oder Material wird von Baustelle gestohlen.',
    severity: 'medium',
    duration: 25,
    weight: 5,
  },

  // Finanzdelikte
  fraud: {
    name: 'Betrug',
    description: 'Verdächtiges Betrugsschema. Opfer meldet finanziellen Verlust.',
    severity: 'medium',
    duration: 30,
    weight: 4,
  },
  identity_theft: {
    name: 'Identitätsdiebstahl',
    description: 'Persönliche Daten werden betrügerisch verwendet.',
    severity: 'medium',
    duration: 30,
    weight: 3,
  },
  credit_card_fraud: {
    name: 'Kreditkartenbetrug',
    description: 'Nicht autorisierte Kartentransaktionen im Gange.',
    severity: 'medium',
    duration: 25,
    weight: 5,
  },
  insurance_fraud: {
    name: 'Versicherungsbetrug',
    description: 'Gestellter Unfall oder falsche Schadensmeldung.',
    severity: 'medium',
    duration: 35,
    weight: 2,
  },
  embezzlement: {
    name: 'Unterschlagung',
    description: 'Mitarbeiter beim Stehlen von Firmengeldern erwischt.',
    severity: 'high',
    duration: 40,
    weight: 1,
  },
  counterfeiting: {
    name: 'Fälschung',
    description: 'Falschgeld oder gefälschte Waren werden verteilt.',
    severity: 'high',
    duration: 35,
    weight: 2,
  },

  // Öffentliche Ordnung (niedrig/mittel, kurze Dauer)
  disturbance: {
    name: 'Öffentliche Störung',
    description: 'Lautstärker Streit eskaliert. Menschenmenge sammelt sich.',
    severity: 'low',
    duration: 18,
    weight: 25,
  },
  public_intoxication: {
    name: 'Öffentliche Trunkenheit',
    description: 'Stark betrunkene Person verursacht Störung.',
    severity: 'low',
    duration: 15,
    weight: 18,
  },
  disorderly_conduct: {
    name: 'Ungebührliches Verhalten',
    description: 'Person verweigert Kooperation. Verursacht Aufsehen.',
    severity: 'low',
    duration: 18,
    weight: 15,
  },
  noise_complaint: {
    name: 'Lärmbeschwerde',
    description: 'Übermässiger Lärm stört Nachbarschaft.',
    severity: 'low',
    duration: 12,
    weight: 20,
  },
  loitering: {
    name: 'Herumtreiben',
    description: 'Verdächtige Personen halten sich am Gebäude auf.',
    severity: 'low',
    duration: 10,
    weight: 12,
  },
  trespassing: {
    name: 'Hausfriedensbruch',
    description: 'Unbefugte Person auf Privatgelände.',
    severity: 'low',
    duration: 15,
    weight: 14,
  },
  public_urination: {
    name: 'Öffentliches Urinieren',
    description: 'Unzüchtige Handlung auf öffentlichem Gebiet.',
    severity: 'low',
    duration: 8,
    weight: 10,
  },
  street_racing: {
    name: 'Strassenrennen',
    description: 'Fahrzeuge rasen mit gefährlicher Geschwindigkeit.',
    severity: 'high',
    duration: 20,
    weight: 4,
  },
  illegal_dumping: {
    name: 'Illegale Entsorgung',
    description: 'Unerlaubte Abfallentsorgung gemeldet.',
    severity: 'low',
    duration: 20,
    weight: 6,
  },

  // Drogendelikte
  drug_dealing: {
    name: 'Drogenhandel',
    description: 'Verdächtiger Drogenhandel im Gange.',
    severity: 'high',
    duration: 20,
    weight: 8,
  },
  drug_possession: {
    name: 'Drogenbesitz',
    description: 'Person mit verdächtigen Substanzen angetroffen.',
    severity: 'medium',
    duration: 18,
    weight: 10,
  },
  illegal_dispensary: {
    name: 'Illegaler Drogenhandel',
    description: 'Nicht lizenzierter Drogenhandel entdeckt.',
    severity: 'high',
    duration: 35,
    weight: 2,
  },
  public_drug_use: {
    name: 'Öffentlicher Drogenkonsum',
    description: 'Person konsumiert Substanzen offen in der Öffentlichkeit.',
    severity: 'low',
    duration: 15,
    weight: 12,
  },

  // Verkehr & Fahrzeuge
  hit_and_run: {
    name: 'Fahrerflucht',
    description: 'Fahrer nach Kollision geflüchtet. Mögliche Verletzte.',
    severity: 'high',
    duration: 25,
    weight: 6,
  },
  dui: {
    name: 'Fahren unter Einfluss',
    description: 'Verdächtiger Fahrer unter Einfluss. Unkontrolliertes Fahrverhalten.',
    severity: 'high',
    duration: 22,
    weight: 7,
  },
  reckless_driving: {
    name: 'Rücksichtsloses Fahren',
    description: 'Fahrzeug fährt gefährlich. Andere werden gefährdet.',
    severity: 'medium',
    duration: 18,
    weight: 10,
  },
  traffic_violation: {
    name: 'Verkehrsdelikt',
    description: 'Verkehrsdelikt beobachtet. Fahrer wird gebüsst.',
    severity: 'low',
    duration: 12,
    weight: 25,
  },
  parking_violation: {
    name: 'Falschparkieren',
    description: 'Illegal geparktes Fahrzeug blockiert Zugang.',
    severity: 'low',
    duration: 10,
    weight: 20,
  },
  illegal_street_vendor: {
    name: 'Illegaler Händler',
    description: 'Nicht lizenzierter Händler ohne Bewilligung.',
    severity: 'low',
    duration: 15,
    weight: 8,
  },

  // Vandalismus & Sachbeschädigung
  vandalism: {
    name: 'Vandalismus',
    description: 'Eigentum wird beschädigt oder zerstört.',
    severity: 'medium',
    duration: 18,
    weight: 12,
  },
  graffiti: {
    name: 'Graffiti',
    description: 'Person besprüht Gebäude oder Oberfläche.',
    severity: 'low',
    duration: 15,
    weight: 15,
  },
  arson_attempt: {
    name: 'Brandstiftungsversuch',
    description: 'Person versucht Feuer zu legen. Dringend.',
    severity: 'critical',
    duration: 30,
    weight: 2,
  },
  property_damage: {
    name: 'Sachbeschädigung',
    description: 'Vorsätzliche Zerstörung von Eigentum im Gange.',
    severity: 'medium',
    duration: 20,
    weight: 8,
  },
  broken_windows: {
    name: 'Eingeschlagene Scheiben',
    description: 'Scheiben werden eingeschlagen. Möglicher Einbruch.',
    severity: 'medium',
    duration: 18,
    weight: 10,
  },

  // Sonstiges
  suspicious_activity: {
    name: 'Verdächtige Aktivität',
    description: 'Unbekannte Person verhält sich verdächtig in Gebäudenähe.',
    severity: 'low',
    duration: 15,
    weight: 18,
  },
  prowler: {
    name: 'Verdächtige Person',
    description: 'Person schleicht nachts um Grundstück herum.',
    severity: 'medium',
    duration: 18,
    weight: 8,
  },
  stalking: {
    name: 'Nachstellung',
    description: 'Person wird von Unbekanntem verfolgt.',
    severity: 'high',
    duration: 25,
    weight: 3,
  },
  domestic_disturbance: {
    name: 'Häuslicher Streit',
    description: 'Heftiger Streit in Wohnung. Mögliche Gewalt.',
    severity: 'high',
    duration: 25,
    weight: 10,
  },
  animal_cruelty: {
    name: 'Tierquälerei',
    description: 'Tier wird misshandelt oder gefährdet.',
    severity: 'medium',
    duration: 20,
    weight: 3,
  },
  illegal_gambling: {
    name: 'Illegales Glücksspiel',
    description: 'Nicht lizenzierter Spielbetrieb entdeckt.',
    severity: 'medium',
    duration: 30,
    weight: 2,
  },
  prostitution: {
    name: 'Prostitution',
    description: 'Illegale Aktivitäten in der Gegend gemeldet.',
    severity: 'medium',
    duration: 20,
    weight: 4,
  },
  solicitation: {
    name: 'Belästigung',
    description: 'Aufdringliches Ansprechen von Passanten.',
    severity: 'low',
    duration: 12,
    weight: 8,
  },
};

// Get all crime types as an array
export const CRIME_TYPES = Object.keys(CRIME_DATA) as CrimeType[];

// Get a weighted random crime type
export function getRandomCrimeType(): CrimeType {
  const totalWeight = CRIME_TYPES.reduce((sum, type) => sum + CRIME_DATA[type].weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const type of CRIME_TYPES) {
    random -= CRIME_DATA[type].weight;
    if (random <= 0) {
      return type;
    }
  }
  
  return CRIME_TYPES[0];
}

// ============================================================================
// FIRE TYPES
// ============================================================================

export type FireType =
  | 'structural'
  | 'electrical'
  | 'kitchen'
  | 'industrial'
  | 'chemical'
  | 'vehicle'
  | 'brush'
  | 'explosion'
  | 'gas_leak'
  | 'arson';

export interface FireData {
  name: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
}

export const FIRE_DATA: Record<FireType, FireData> = {
  structural: {
    name: 'Gebäudebrand',
    description: 'Flammen breiten sich im Gebäude aus. Mehrere Stockwerke gefährdet. Sofort evakuieren.',
    severity: 'major',
  },
  electrical: {
    name: 'Elektrischer Brand',
    description: 'Überlastung des Stromsystems. Rauch aus Steckdosen. Stromleitungen funken.',
    severity: 'moderate',
  },
  kitchen: {
    name: 'Küchenbrand',
    description: 'Kochfeuer ausser Kontrolle. Fettflammen breiten sich aus. Belüftung beeinträchtigt.',
    severity: 'moderate',
  },
  industrial: {
    name: 'Industriebrand',
    description: 'Fabrikbrand mit starkem Rauch. Gefahrstoffe möglicherweise beteiligt. Grosse Sperrzone nötig.',
    severity: 'catastrophic',
  },
  chemical: {
    name: 'Chemikalienbrand',
    description: 'Toxische Chemikalienverbrennung. Gefährliche Dämpfe verbreiten sich. Spezialeinsatz erforderlich.',
    severity: 'catastrophic',
  },
  vehicle: {
    name: 'Fahrzeugbrand',
    description: 'Auto in Flammen. Explosionsgefahr des Tanks. Abstand halten.',
    severity: 'minor',
  },
  brush: {
    name: 'Vegetationsbrand',
    description: 'Feuer breitet sich mit dem Wind aus. Umliegende Gebäude gefährdet.',
    severity: 'moderate',
  },
  explosion: {
    name: 'Explosion',
    description: 'Gebäude durch Explosion erschüttert. Statik kompromittiert. Mögliche Verletzte.',
    severity: 'catastrophic',
  },
  gas_leak: {
    name: 'Gasbrand',
    description: 'Erdgas entzündet. Dauerflamme aus Leck. Absperrventil benötigt.',
    severity: 'major',
  },
  arson: {
    name: 'Brandstiftung',
    description: 'Vorsätzlich gelegtes Feuer entdeckt. Brandbeschleuniger verwendet. Feuer breitet sich aus.',
    severity: 'major',
  },
};

export const FIRE_TYPES = Object.keys(FIRE_DATA) as FireType[];

// Get a random fire type (weighted toward structural/electrical for realism)
export function getRandomFireType(): FireType {
  const weights: Record<FireType, number> = {
    structural: 25,
    electrical: 20,
    kitchen: 15,
    industrial: 8,
    chemical: 3,
    vehicle: 10,
    brush: 5,
    explosion: 2,
    gas_leak: 7,
    arson: 5,
  };
  
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  
  for (const [type, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) {
      return type as FireType;
    }
  }
  
  return 'structural';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function getCrimeName(crimeType: CrimeType): string {
  return CRIME_DATA[crimeType]?.name || 'Unbekannter Vorfall';
}

export function getCrimeDescription(crimeType: CrimeType): string {
  return CRIME_DATA[crimeType]?.description || 'Vorfall gemeldet.';
}

export function getCrimeDuration(crimeType: CrimeType): number {
  return CRIME_DATA[crimeType]?.duration || 20;
}

export function getFireName(fireType: FireType): string {
  return FIRE_DATA[fireType]?.name || 'Brand';
}

export function getFireDescription(fireType: FireType): string {
  return FIRE_DATA[fireType]?.description || 'Gebäude in Flammen. Feuerwehr unterwegs.';
}

// Get fire description based on tile coordinates (deterministic)
export function getFireDescriptionForTile(x: number, y: number): string {
  // Use coordinates to deterministically pick a fire type
  const index = Math.abs((x * 31 + y * 17) % FIRE_TYPES.length);
  return FIRE_DATA[FIRE_TYPES[index]].description;
}

// Get fire name based on tile coordinates (deterministic)
export function getFireNameForTile(x: number, y: number): string {
  const index = Math.abs((x * 31 + y * 17) % FIRE_TYPES.length);
  return FIRE_DATA[FIRE_TYPES[index]].name;
}
