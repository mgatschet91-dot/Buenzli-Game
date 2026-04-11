/**
 * IsoCity Game State Types
 */

import { msg } from 'gt-next';
import { Building } from './buildings';
import { ZoneType } from './zones';
import { Stats, Budget, CityEconomy, HistoryPoint } from './economy';
import { ServiceCoverage } from './services';

export type Tool =
  | 'select' | 'bulldoze' | 'label' | 'road' | 'autobahn' | 'rail' | 'subway'
  | 'expand_city' | 'shrink_city' | 'tree'
  | 'tree_oak' | 'tree_maple' | 'tree_birch' | 'tree_willow'
  | 'tree_pine' | 'tree_spruce' | 'tree_fir' | 'tree_cedar'
  | 'tree_palm' | 'tree_bamboo' | 'tree_coconut'
  | 'tree_cherry' | 'tree_magnolia' | 'tree_jacaranda' | 'tree_wisteria'
  | 'bush_hedge' | 'bush_flowering' | 'topiary_ball' | 'topiary_spiral'
  | 'flower_bed' | 'flower_planter'
  | 'zone_residential' | 'zone_commercial' | 'zone_industrial' | 'zone_dezone'
  | 'zone_water' | 'zone_land'
  | 'police_station' | 'fire_station' | 'hospital' | 'school' | 'university'
  | 'park' | 'park_large' | 'tennis' | 'power_plant' | 'water_tower' | 'water_reservoir'
  | 'subway_station' | 'rail_station' | 'bus_stop' | 'bus_station' | 'stadium' | 'museum' | 'airport'
  | 'space_program' | 'city_hall' | 'amusement_park'
  | 'solar_panel' | 'wind_turbine'
  | 'basketball_courts' | 'playground_small' | 'playground_large'
  | 'baseball_field_small' | 'soccer_field_small' | 'football_field' | 'baseball_stadium'
  | 'community_center' | 'office_building_small' | 'swimming_pool' | 'skate_park'
  | 'mini_golf_course' | 'bleachers_field' | 'go_kart_track' | 'amphitheater'
  | 'greenhouse_garden' | 'animal_pens_farm' | 'cabin_house' | 'campground'
  | 'marina_docks_small' | 'pier_large' | 'roller_coaster_small'
  | 'community_garden' | 'pond_park' | 'park_gate' | 'mountain_lodge' | 'mountain_trailhead'
  | 'woodcutter_house'
  | 'werkhof'
  | 'parking_spot' | 'parking_lot' | 'parking_lot_large'
  | 'fcbasel_stadium' | 'st_ursen_kathedrale' | 'primetower'
  | 'bank_house'
  | 'npc_woodcutter'
  | 'npc_gardener'
  | 'npc_police_chase'
  | 'npc_gangster'
  | 'npc_buenzli'
  // Bünzli Inspect tool
  | 'inspect'
  // Terrain & Painting tools
  | 'terrain_raise' | 'terrain_lower' | 'terrain_lower2' | 'terrain_hill' | 'terrain_mountain' | 'terrain_flatten'
  | 'paint_green' | 'paint_sand' | 'paint_dirt' | 'paint_snow' | 'paint_dark_grass' | 'paint_rock' | 'paint_reset'
  // Bauzone tools (municipality management)
  | 'bauzone' | 'bauzone_remove';

export interface ToolInfo {
  name: string;
  cost: number;
  description: string;
  size?: number;
}

export const TOOL_INFO: Record<Tool, ToolInfo> = {
  select: { name: msg('Select'), cost: 0, description: msg('Click to view tile info') },
  bulldoze: { name: msg('Bulldoze'), cost: 10, description: msg('Remove buildings and zones') },
  label: { name: msg('Label'), cost: 0, description: msg('Give buildings a custom name') },
  road: { name: msg('Road'), cost: 25, description: msg('Connect your city') },
  autobahn: { name: msg('Autobahn'), cost: 80, description: msg('Schnellstrasse ohne Ampeln') },
  rail: { name: msg('Rail'), cost: 40, description: msg('Build railway tracks') },
  subway: { name: msg('Subway'), cost: 50, description: msg('Underground transit') },
  expand_city: { name: msg('Expand City'), cost: 50000, description: msg('Add 15 tiles') },
  shrink_city: { name: msg('Shrink City'), cost: 0, description: msg('Not available') },
  tree: { name: msg('Tree'), cost: 15, description: msg('Plant trees to improve environment') },
  // Deciduous trees
  tree_oak: { name: msg('Eiche'), cost: 20, description: msg('Kräftiger Laubbaum'), size: 1 },
  tree_maple: { name: msg('Ahorn'), cost: 20, description: msg('Bunter Ahornbaum'), size: 1 },
  tree_birch: { name: msg('Birke'), cost: 20, description: msg('Schlanke Birke'), size: 1 },
  tree_willow: { name: msg('Weide'), cost: 25, description: msg('Hängende Trauerweide'), size: 1 },
  // Evergreen trees
  tree_pine: { name: msg('Kiefer'), cost: 20, description: msg('Hoher Nadelbaum'), size: 1 },
  tree_spruce: { name: msg('Fichte'), cost: 20, description: msg('Dichte Fichte'), size: 1 },
  tree_fir: { name: msg('Tanne'), cost: 20, description: msg('Klassische Tanne'), size: 1 },
  tree_cedar: { name: msg('Zeder'), cost: 25, description: msg('Majestätische Zeder'), size: 1 },
  // Tropical trees
  tree_palm: { name: msg('Palme'), cost: 25, description: msg('Tropische Palme'), size: 1 },
  tree_bamboo: { name: msg('Bambus'), cost: 20, description: msg('Bambusstaude'), size: 1 },
  tree_coconut: { name: msg('Kokospalme'), cost: 25, description: msg('Palme mit Kokosnüssen'), size: 1 },
  // Flowering trees
  tree_cherry: { name: msg('Kirschbaum'), cost: 30, description: msg('Blühender Kirschbaum'), size: 1 },
  tree_magnolia: { name: msg('Magnolie'), cost: 30, description: msg('Prächtige Magnolie'), size: 1 },
  tree_jacaranda: { name: msg('Jakaranda'), cost: 30, description: msg('Lila blühender Baum'), size: 1 },
  tree_wisteria: { name: msg('Glyzinie'), cost: 30, description: msg('Hängende Blütentrauben'), size: 1 },
  // Bushes & topiary
  bush_hedge: { name: msg('Hecke'), cost: 15, description: msg('Dichte grüne Hecke'), size: 1 },
  bush_flowering: { name: msg('Blütenbusch'), cost: 15, description: msg('Blühender Busch'), size: 1 },
  topiary_ball: { name: msg('Buchsbaum-Kugel'), cost: 30, description: msg('Kugelförmiger Formschnitt'), size: 1 },
  topiary_spiral: { name: msg('Buchsbaum-Spirale'), cost: 35, description: msg('Spiralförmiger Formschnitt'), size: 1 },
  // Flowers
  flower_bed: { name: msg('Blumenbeet'), cost: 20, description: msg('Buntes Blumenbeet'), size: 1 },
  flower_planter: { name: msg('Blumenkübel'), cost: 20, description: msg('Dekorativer Pflanzenkübel'), size: 1 },
  zone_residential: { name: msg('Residential'), cost: 50, description: msg('Zone for housing') },
  zone_commercial: { name: msg('Commercial'), cost: 50, description: msg('Zone for shops and offices') },
  zone_industrial: { name: msg('Industrial'), cost: 50, description: msg('Zone for factories') },
  zone_dezone: { name: msg('De-zone'), cost: 0, description: msg('Remove zoning') },
  zone_water: { name: msg('Water Terraform'), cost: 50000, description: msg('Terraform land into water') },
  zone_land: { name: msg('Land Terraform'), cost: 50000, description: msg('Terraform water into land') },
  police_station: { name: msg('Police'), cost: 500, description: msg('Increase safety'), size: 1 },
  fire_station: { name: msg('Fire Station'), cost: 500, description: msg('Fight fires'), size: 1 },
  hospital: { name: msg('Hospital'), cost: 1000, description: msg('Improve health (2x2)'), size: 2 },
  school: { name: msg('School'), cost: 400, description: msg('Basic education (2x2)'), size: 2 },
  university: { name: msg('University'), cost: 2000, description: msg('Higher education (3x3)'), size: 3 },
  park: { name: msg('Small Park'), cost: 150, description: msg('Boost happiness and land value (1x1)'), size: 1 },
  park_large: { name: msg('Large Park'), cost: 600, description: msg('Large park (3x3)'), size: 3 },
  tennis: { name: msg('Tennis Court'), cost: 200, description: msg('Recreation facility'), size: 1 },
  power_plant: { name: msg('Power Plant'), cost: 3000, description: msg('Generate electricity (2x2)'), size: 2 },
  solar_panel: { name: msg('Solar Panel'), cost: 1500, description: msg('Solar energy, weather dependent (1x1)'), size: 1 },
  wind_turbine: { name: msg('Wind Turbine'), cost: 2000, description: msg('Wind energy, more in storms (1x1)'), size: 1 },
  water_tower: { name: msg('Water Tower'), cost: 1000, description: msg('Provide water'), size: 1 },
  water_reservoir: { name: msg('Wasserspeicher'), cost: 1800, description: msg('Speichert Wasser als Puffer bei Spitzenlast (2x2)'), size: 2 },
  subway_station: { name: msg('Subway Station'), cost: 750, description: msg('Access to subway network'), size: 1 },
  rail_station: { name: msg('Rail Station'), cost: 1000, description: msg('Passenger and freight station'), size: 2 },
  bus_stop: { name: msg('Bushaltestelle'), cost: 120, description: msg('Öffentliche Bushaltestelle für Buslinien'), size: 1 },
  bus_station: { name: msg('Busbahnhof'), cost: 3000, description: msg('Zentraler Busbahnhof – alle Linien starten hier (4x4)'), size: 4 },
  stadium: { name: msg('Stadium'), cost: 5000, description: msg('Boosts commercial demand (3x3)'), size: 3 },
  museum: { name: msg('Museum'), cost: 4000, description: msg('Boosts commercial & residential demand (3x3)'), size: 3 },
  airport: { name: msg('Airport'), cost: 10000, description: msg('Boosts commercial & industrial demand (4x4)'), size: 4 },
  space_program: { name: msg('Space Program'), cost: 15000, description: msg('Boosts industrial & residential demand (3x3)'), size: 3 },
  city_hall: { name: msg('City Hall'), cost: 6000, description: msg('Boosts all demand types (2x2)'), size: 2 },
  amusement_park: { name: msg('Amusement Park'), cost: 12000, description: msg('Major boost to commercial demand (4x4)'), size: 4 },
  basketball_courts: { name: msg('Basketball Courts'), cost: 250, description: msg('Outdoor basketball facility'), size: 1 },
  playground_small: { name: msg('Small Playground'), cost: 200, description: msg('Children\'s playground'), size: 1 },
  playground_large: { name: msg('Large Playground'), cost: 350, description: msg('Large playground with more equipment (2x2)'), size: 2 },
  baseball_field_small: { name: msg('Baseball Field'), cost: 800, description: msg('Local baseball diamond (2x2)'), size: 2 },
  soccer_field_small: { name: msg('Soccer Field'), cost: 400, description: msg('Soccer/football pitch'), size: 1 },
  football_field: { name: msg('Football Field'), cost: 1200, description: msg('Football stadium (2x2)'), size: 2 },
  baseball_stadium: { name: msg('Baseball Stadium'), cost: 6000, description: msg('Professional baseball venue (3x3)'), size: 3 },
  community_center: { name: msg('Community Center'), cost: 500, description: msg('Local community hub'), size: 1 },
  office_building_small: { name: msg('Small Office'), cost: 600, description: msg('Small office building'), size: 1 },
  swimming_pool: { name: msg('Swimming Pool'), cost: 450, description: msg('Public swimming facility'), size: 1 },
  skate_park: { name: msg('Skate Park'), cost: 300, description: msg('Skateboarding park'), size: 1 },
  mini_golf_course: { name: msg('Mini Golf'), cost: 700, description: msg('Miniature golf course (2x2)'), size: 2 },
  bleachers_field: { name: msg('Bleachers Field'), cost: 350, description: msg('Sports field with seating'), size: 1 },
  go_kart_track: { name: msg('Go-Kart Track'), cost: 1000, description: msg('Racing entertainment (2x2)'), size: 2 },
  amphitheater: { name: msg('Amphitheater'), cost: 1500, description: msg('Outdoor performance venue (2x2)'), size: 2 },
  greenhouse_garden: { name: msg('Greenhouse Garden'), cost: 800, description: msg('Botanical greenhouse (2x2)'), size: 2 },
  animal_pens_farm: { name: msg('Animal Pens'), cost: 400, description: msg('Petting zoo / farm animals'), size: 1 },
  cabin_house: { name: msg('Cabin House'), cost: 300, description: msg('Rustic cabin retreat'), size: 1 },
  campground: { name: msg('Campground'), cost: 250, description: msg('Outdoor camping area'), size: 1 },
  marina_docks_small: { name: msg('Marina'), cost: 1200, description: msg('Boat docks (2x2, must be placed next to water)'), size: 2 },
  pier_large: { name: msg('Pier'), cost: 600, description: msg('Waterfront pier (must be placed next to water)'), size: 1 },
  roller_coaster_small: { name: msg('Roller Coaster'), cost: 3000, description: msg('Thrill ride (2x2)'), size: 2 },
  community_garden: { name: msg('Community Garden'), cost: 200, description: msg('Shared gardening space'), size: 1 },
  pond_park: { name: msg('Pond Park'), cost: 350, description: msg('Park with scenic pond'), size: 1 },
  park_gate: { name: msg('Park Gate'), cost: 150, description: msg('Decorative park entrance'), size: 1 },
  mountain_lodge: { name: msg('Mountain Lodge'), cost: 1500, description: msg('Nature retreat lodge (2x2)'), size: 2 },
  mountain_trailhead: { name: msg('Trailhead'), cost: 400, description: msg('Hiking trail entrance (3x3)'), size: 3 },
  // NPC production buildings
  woodcutter_house: { name: msg('Holzfäller-Haus'), cost: 500, description: msg('Holzfäller bauen eine Baumplantage, ernten & verkaufen Holz'), size: 1 },
  // Municipal infrastructure
  werkhof: { name: msg('Werkhof'), cost: 4500, description: msg('Kommunaler Bauhof – repariert Gebäude und organisiert die Müllabfuhr (2x2)'), size: 2 },
  // Parking
  parking_spot:      { name: msg('Parkplatz'),         cost: 150,  description: msg('Kleiner Parkplatz für ~2 Autos (1x1)'), size: 1 },
  parking_lot:       { name: msg('Parkfeld'),          cost: 400,  description: msg('Mittleres Parkfeld für ~6 Autos (2x2)'), size: 2 },
  parking_lot_large: { name: msg('Grosses Parkfeld'),  cost: 900,  description: msg('Grosses Parkfeld für ~12 Autos (3x3)'), size: 3 },
  bank_house: { name: msg('Bank'), cost: 2000, description: msg('Bankgebäude für Finanzdienstleistungen'), size: 1 },
  fcbasel_stadium: { name: msg('Stadion FC Basel'), cost: 50000, description: msg('Heimstadion des FC Basel – einmalig pro Stadt (3x3)'), size: 3 },
  st_ursen_kathedrale: { name: msg('St. Ursen Kathedrale'), cost: 30000, description: msg('Die St. Ursen Kathedrale – einmalig pro Stadt (2x2)'), size: 2 },
  primetower: { name: msg('Prime Tower Zürich'), cost: 75000, description: msg('Der höchste Wolkenkratzer der Schweiz – einmalig pro Stadt (2x2)'), size: 2 },
  // NPC Testing Tools
  npc_woodcutter: { name: msg('Woodcutter NPC'), cost: 0, description: msg('Spawn a woodcutter that chops nearby trees') },
  npc_gardener: { name: msg('Gardener NPC'), cost: 0, description: msg('Spawn a gardener that plants trees on empty grass') },
  npc_police_chase: { name: msg('Police Chase'), cost: 0, description: msg('Spawn a police officer chasing a gangster') },
  npc_gangster: { name: msg('Gangster'), cost: 0, description: msg('Spawn a gangster being chased by police') },
  npc_buenzli: { name: msg('Bünzli'), cost: 0, description: msg('Schweizer Bünzli der überall Vergehen findet und Bussen verteilt') },
  // Bünzli Inspect Tool
  inspect: { name: msg('Inspizieren'), cost: 0, description: msg('Klicke auf ein Feld um nach Vergehen zu suchen (10 Min)') },
  // Terrain & Painting Tools
  terrain_raise: { name: msg('Anheben (+1)'), cost: 50, description: msg('Gelände um 1 Stufe anheben (max 6)') },
  terrain_lower: { name: msg('Absenken (-1)'), cost: 50, description: msg('Gelände um 1 Stufe absenken (min -6)') },
  terrain_lower2: { name: msg('Absenken (-2)'), cost: 90, description: msg('Gelände um 2 Stufen absenken (min -6)') },
  terrain_hill: { name: msg('Hügel (2)'), cost: 200, description: msg('Setze Höhe auf 2 (Hügel)') },
  terrain_mountain: { name: msg('Berg (4)'), cost: 500, description: msg('Setze Höhe auf 4 (Berg)') },
  terrain_flatten: { name: msg('Einebnen'), cost: 100, description: msg('Gelände komplett einebnen (Höhe 0)') },
  paint_green: { name: msg('Grünes Gras'), cost: 10, description: msg('Tile grün färben') },
  paint_sand: { name: msg('Sand'), cost: 10, description: msg('Tile sandig färben') },
  paint_dirt: { name: msg('Erde'), cost: 10, description: msg('Tile braun/erdig färben') },
  paint_snow: { name: msg('Schnee'), cost: 10, description: msg('Tile weiß/schneebedeckt färben') },
  paint_dark_grass: { name: msg('Dunkles Gras'), cost: 10, description: msg('Tile dunkelgrün färben') },
  paint_rock: { name: msg('Fels'), cost: 10, description: msg('Tile grau/felsig färben') },
  paint_reset: { name: msg('Farbe zurücksetzen'), cost: 0, description: msg('Tile-Farbe auf Standard zurücksetzen') },
  // Bauzone tools
  bauzone: { name: msg('Bauzone setzen'), cost: 0, description: msg('Bauzone markieren – Mitglieder dürfen nur innerhalb von Bauzonen bauen') },
  bauzone_remove: { name: msg('Bauzone entfernen'), cost: 0, description: msg('Bauzone-Markierung von einem Feld entfernen') },
};

export type TilePaintColor = 'green' | 'sand' | 'dirt' | 'snow' | 'dark_grass' | 'rock';

export interface Tile {
  x: number;
  y: number;
  zone: ZoneType;
  building: Building;
  landValue: number;
  pollution: number;
  crime: number;
  traffic: number;
  hasSubway: boolean;
  hasRailOverlay?: boolean;
  elevation?: number;       // -6..6 (0 = flat), positive = raised, negative = lowered terrain
  paintColor?: TilePaintColor; // Custom tile color override
  bauzone?: boolean;        // true = tile is within a designated building zone
}

export interface City {
  id: string;
  name: string;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  economy: CityEconomy;
  color: string;
}

export interface AdjacentCity {
  id: string;
  name: string;
  slug?: string;
  direction: 'north' | 'south' | 'east' | 'west';
  connected: boolean;
  discovered: boolean;
}

export interface WaterBody {
  id: string;
  name: string;
  type: 'lake' | 'ocean';
  tiles: { x: number; y: number }[];
  centerX: number;
  centerY: number;
}

export interface Notification {
  id: string;
  title: string;
  description: string;
  icon: string;
  timestamp: number;
}

export interface AdvisorMessage {
  name: string;
  icon: string;
  messages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface GameState {
  id: string;
  grid: Tile[][];
  gridSize: number;
  cityName: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  tick: number;
  speed: 0 | 1 | 2 | 3;
  weatherType: string;
  weatherIntensity: number;
  weatherTemperature: number | null;
  selectedTool: Tool;
  taxRate: number;
  effectiveTaxRate: number;
  stats: Stats;
  budget: Budget;
  services: ServiceCoverage;
  notifications: Notification[];
  advisorMessages: AdvisorMessage[];
  history: HistoryPoint[];
  activePanel: 'none' | 'budget' | 'statistics' | 'advisors' | 'settings' | 'trade' | 'navigator' | 'inventory' | 'shop' | 'debug' | 'chat' | 'firma' | 'gemeinde' | 'leaderboard' | 'profile' | 'admin' | 'marketplace' | 'reports' | 'banking' | 'user' | 'growth_debug';
  disastersEnabled: boolean;
  adjacentCities: AdjacentCity[];
  waterBodies: WaterBody[];
  gameVersion: number;
  cities: City[];
  lastSaveTimestamp?: number;
  tradeIncome?: number;
}

export interface SavedCityMeta {
  id: string;
  cityName: string;
  population: number;
  money: number;
  year: number;
  month: number;
  gridSize: number;
  savedAt: number;
  roomCode?: string;
}
