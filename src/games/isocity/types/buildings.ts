/**
 * IsoCity Building Types
 */

export type BuildingType =
  | 'empty' | 'grass' | 'water' | 'road' | 'autobahn' | 'bridge' | 'rail' | 'tree'
  // Trees & vegetation (from trees.webp sprite sheet)
  | 'tree_oak' | 'tree_maple' | 'tree_birch' | 'tree_willow'
  | 'tree_pine' | 'tree_spruce' | 'tree_fir' | 'tree_cedar'
  | 'tree_palm' | 'tree_bamboo' | 'tree_coconut'
  | 'tree_cherry' | 'tree_magnolia' | 'tree_jacaranda' | 'tree_wisteria'
  | 'bush_hedge' | 'bush_flowering' | 'topiary_ball' | 'topiary_spiral'
  | 'flower_bed' | 'flower_planter'
  // Residential
  | 'house_small' | 'house_medium' | 'mansion' | 'apartment_low' | 'apartment_high'
  // Commercial
  | 'shop_small' | 'shop_medium' | 'office_low' | 'office_high' | 'mall'
  // Industrial
  | 'factory_small' | 'factory_medium' | 'factory_large' | 'warehouse'
  // Services
  | 'police_station' | 'fire_station' | 'hospital' | 'school' | 'university'
  | 'park' | 'park_large' | 'tennis'
  // Utilities
  | 'power_plant' | 'solar_panel' | 'wind_turbine' | 'water_tower' | 'water_reservoir'
  // Transportation
  | 'subway_station' | 'rail_station' | 'bus_stop' | 'bus_station'
  // Special
  | 'stadium' | 'museum' | 'airport' | 'space_program' | 'city_hall' | 'amusement_park'
  // Parks (new sprite sheet)
  | 'basketball_courts' | 'playground_small' | 'playground_large'
  | 'baseball_field_small' | 'soccer_field_small' | 'football_field' | 'baseball_stadium'
  | 'community_center' | 'office_building_small' | 'swimming_pool' | 'skate_park'
  | 'mini_golf_course' | 'bleachers_field' | 'go_kart_track' | 'amphitheater'
  | 'greenhouse_garden' | 'animal_pens_farm' | 'cabin_house' | 'campground'
  | 'marina_docks_small' | 'pier_large' | 'roller_coaster_small'
  | 'community_garden' | 'pond_park' | 'park_gate' | 'mountain_lodge' | 'mountain_trailhead'
  // NPC production buildings
  | 'woodcutter_house'
  // Municipal infrastructure
  | 'werkhof'
  // Parking
  | 'parking_spot' | 'parking_lot' | 'parking_lot_large'
  // Standalone buildings (individual image assets)
  | 'bank_house'
  | 'fcbasel_stadium'
  | 'st_ursen_kathedrale'
  | 'primetower'
  | 'disco_solothurn'
  // Habbo-style furniture (loaded from CDN)
  | 'furni';

export type BridgeType = 'small' | 'medium' | 'large' | 'suspension';
export type BridgeOrientation = 'ns' | 'ew';
export type BridgeTrackType = 'road' | 'rail';
export type AutobahnDirection = 'north' | 'south' | 'east' | 'west';

export interface Building {
  type: BuildingType;
  level: number;
  population: number;
  jobs: number;
  powered: boolean;
  watered: boolean;
  onFire: boolean;
  fireProgress: number;
  age: number;
  constructionProgress: number;
  abandoned: boolean;
  flipped?: boolean;
  cityId?: string;
  bridgeType?: BridgeType;
  bridgeOrientation?: BridgeOrientation;
  bridgeVariant?: number;
  bridgePosition?: 'start' | 'middle' | 'end';
  bridgeIndex?: number;
  bridgeSpan?: number;
  bridgeTrackType?: BridgeTrackType;
  plantedAt?: number; // Unix-Timestamp (ms) wann ein Plantagen-Baum gepflanzt wurde
  customName?: string; // Custom label for the building
  upgradeTargetLevel?: number; // Target level during upgrade construction
  upgradeStartedAt?: number;  // Unix timestamp (ms) when upgrade started
  // Woodcutter house plantation fields
  plantationHarvests?: number;    // Total trees harvested
  plantationMoneyEarned?: number; // Total money earned from harvests
  plantationPhase?: 'planting' | 'growing' | 'harvesting'; // Current plantation cycle phase
  // Habbo-style furniture fields
  furniClassname?: string;   // CDN folder name, e.g. "ads_calip_cola"
  furniDirection?: number;   // 0, 2, 4 (isometric direction)
  furniState?: number;       // Current state (for multistate furniture)
  // Zustand-Metadaten (aus game_items.metadata)
  metadata?: {
    condition?: number;      // Gebäudezustand 0-100 (100 = neu)
    [key: string]: unknown;
  };
  autobahnDirection?: AutobahnDirection;
}

export const RESIDENTIAL_BUILDINGS: BuildingType[] = ['house_small', 'house_medium', 'mansion', 'apartment_low', 'apartment_high'];
export const COMMERCIAL_BUILDINGS: BuildingType[] = ['shop_small', 'shop_medium', 'office_low', 'office_high', 'mall'];
export const INDUSTRIAL_BUILDINGS: BuildingType[] = ['factory_small', 'factory_medium', 'warehouse', 'factory_large', 'factory_large'];

export const BUILDING_STATS: Record<BuildingType, { maxPop: number; maxJobs: number; pollution: number; landValue: number }> = {
  empty: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  grass: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
  water: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 5 },
  road: { maxPop: 0, maxJobs: 0, pollution: 2, landValue: 0 },
  autobahn: { maxPop: 0, maxJobs: 0, pollution: 4, landValue: -5 },
  bridge: { maxPop: 0, maxJobs: 0, pollution: 1, landValue: 5 },
  rail: { maxPop: 0, maxJobs: 0, pollution: 1, landValue: -2 },
  tree: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 2 },
  // Deciduous trees
  tree_oak: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  tree_maple: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  tree_birch: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  tree_willow: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 4 },
  // Evergreen trees
  tree_pine: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  tree_spruce: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  tree_fir: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  tree_cedar: { maxPop: 0, maxJobs: 0, pollution: -5, landValue: 3 },
  // Tropical trees
  tree_palm: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 4 },
  tree_bamboo: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 4 },
  tree_coconut: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 4 },
  // Flowering trees
  tree_cherry: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 5 },
  tree_magnolia: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 5 },
  tree_jacaranda: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 5 },
  tree_wisteria: { maxPop: 0, maxJobs: 0, pollution: -4, landValue: 5 },
  // Bushes & topiary
  bush_hedge: { maxPop: 0, maxJobs: 0, pollution: -3, landValue: 4 },
  bush_flowering: { maxPop: 0, maxJobs: 0, pollution: -3, landValue: 4 },
  topiary_ball: { maxPop: 0, maxJobs: 0, pollution: -2, landValue: 6 },
  topiary_spiral: { maxPop: 0, maxJobs: 0, pollution: -2, landValue: 6 },
  // Flowers
  flower_bed: { maxPop: 0, maxJobs: 0, pollution: -3, landValue: 5 },
  flower_planter: { maxPop: 0, maxJobs: 0, pollution: -3, landValue: 5 },
  house_small: { maxPop: 6, maxJobs: 0, pollution: 0, landValue: 10 },
  house_medium: { maxPop: 14, maxJobs: 0, pollution: 0, landValue: 22 },
  mansion: { maxPop: 8, maxJobs: 0, pollution: 0, landValue: 60 },
  apartment_low: { maxPop: 120, maxJobs: 0, pollution: 2, landValue: 40 },
  apartment_high: { maxPop: 260, maxJobs: 0, pollution: 3, landValue: 55 },
  shop_small: { maxPop: 0, maxJobs: 10, pollution: 1, landValue: 16 },
  shop_medium: { maxPop: 0, maxJobs: 28, pollution: 2, landValue: 26 },
  office_low: { maxPop: 0, maxJobs: 90, pollution: 2, landValue: 40 },
  office_high: { maxPop: 0, maxJobs: 210, pollution: 3, landValue: 55 },
  mall: { maxPop: 0, maxJobs: 260, pollution: 6, landValue: 70 },
  factory_small: { maxPop: 0, maxJobs: 40, pollution: 15, landValue: -5 },
  factory_medium: { maxPop: 0, maxJobs: 90, pollution: 28, landValue: -10 },
  factory_large: { maxPop: 0, maxJobs: 180, pollution: 55, landValue: -18 },
  warehouse: { maxPop: 0, maxJobs: 100, pollution: 12, landValue: -5 },
  police_station: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 15 },
  fire_station: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 10 },
  hospital: { maxPop: 0, maxJobs: 80, pollution: 0, landValue: 25 },
  school: { maxPop: 0, maxJobs: 25, pollution: 0, landValue: 15 },
  university: { maxPop: 0, maxJobs: 100, pollution: 0, landValue: 35 },
  park: { maxPop: 0, maxJobs: 2, pollution: -10, landValue: 20 },
  park_large: { maxPop: 0, maxJobs: 6, pollution: -25, landValue: 50 },
  tennis: { maxPop: 0, maxJobs: 1, pollution: -5, landValue: 15 },
  power_plant: { maxPop: 0, maxJobs: 30, pollution: 30, landValue: -20 },
  solar_panel: { maxPop: 0, maxJobs: 2, pollution: -5, landValue: 5 },
  wind_turbine: { maxPop: 0, maxJobs: 3, pollution: -3, landValue: -5 },
  water_tower: { maxPop: 0, maxJobs: 5, pollution: 0, landValue: 5 },
  water_reservoir: { maxPop: 0, maxJobs: 8, pollution: 0, landValue: 8 },
  stadium: { maxPop: 0, maxJobs: 50, pollution: 5, landValue: 40 },
  museum: { maxPop: 0, maxJobs: 40, pollution: 0, landValue: 45 },
  airport: { maxPop: 0, maxJobs: 200, pollution: 20, landValue: 50 },
  space_program: { maxPop: 0, maxJobs: 150, pollution: 5, landValue: 80 },
  subway_station: { maxPop: 0, maxJobs: 15, pollution: 0, landValue: 25 },
  rail_station: { maxPop: 0, maxJobs: 25, pollution: 2, landValue: 20 },
  bus_stop: { maxPop: 0, maxJobs: 2, pollution: 0, landValue: 8 },
  bus_station: { maxPop: 0, maxJobs: 25, pollution: 3, landValue: 35 },
  city_hall: { maxPop: 0, maxJobs: 60, pollution: 0, landValue: 50 },
  amusement_park: { maxPop: 0, maxJobs: 100, pollution: 8, landValue: 60 },
  basketball_courts: { maxPop: 0, maxJobs: 2, pollution: -3, landValue: 12 },
  playground_small: { maxPop: 0, maxJobs: 1, pollution: -5, landValue: 15 },
  playground_large: { maxPop: 0, maxJobs: 2, pollution: -8, landValue: 18 },
  baseball_field_small: { maxPop: 0, maxJobs: 4, pollution: -10, landValue: 25 },
  soccer_field_small: { maxPop: 0, maxJobs: 2, pollution: -5, landValue: 15 },
  football_field: { maxPop: 0, maxJobs: 8, pollution: -8, landValue: 30 },
  baseball_stadium: { maxPop: 0, maxJobs: 60, pollution: 5, landValue: 45 },
  community_center: { maxPop: 0, maxJobs: 10, pollution: 0, landValue: 20 },
  office_building_small: { maxPop: 0, maxJobs: 25, pollution: 1, landValue: 22 },
  swimming_pool: { maxPop: 0, maxJobs: 5, pollution: -5, landValue: 18 },
  skate_park: { maxPop: 0, maxJobs: 2, pollution: -3, landValue: 12 },
  mini_golf_course: { maxPop: 0, maxJobs: 6, pollution: -8, landValue: 22 },
  bleachers_field: { maxPop: 0, maxJobs: 3, pollution: -5, landValue: 15 },
  go_kart_track: { maxPop: 0, maxJobs: 10, pollution: 5, landValue: 20 },
  amphitheater: { maxPop: 0, maxJobs: 15, pollution: -5, landValue: 35 },
  greenhouse_garden: { maxPop: 0, maxJobs: 8, pollution: -15, landValue: 28 },
  animal_pens_farm: { maxPop: 0, maxJobs: 4, pollution: 2, landValue: 10 },
  cabin_house: { maxPop: 4, maxJobs: 0, pollution: -3, landValue: 15 },
  campground: { maxPop: 0, maxJobs: 3, pollution: -8, landValue: 12 },
  marina_docks_small: { maxPop: 0, maxJobs: 8, pollution: 2, landValue: 25 },
  pier_large: { maxPop: 0, maxJobs: 12, pollution: 1, landValue: 30 },
  roller_coaster_small: { maxPop: 0, maxJobs: 20, pollution: 3, landValue: 40 },
  community_garden: { maxPop: 0, maxJobs: 2, pollution: -12, landValue: 18 },
  pond_park: { maxPop: 0, maxJobs: 2, pollution: -15, landValue: 22 },
  park_gate: { maxPop: 0, maxJobs: 1, pollution: -2, landValue: 8 },
  mountain_lodge: { maxPop: 0, maxJobs: 15, pollution: -5, landValue: 35 },
  mountain_trailhead: { maxPop: 0, maxJobs: 2, pollution: -10, landValue: 15 },
  // NPC production buildings
  woodcutter_house: { maxPop: 0, maxJobs: 4, pollution: -5, landValue: 12 },
  // Municipal infrastructure
  werkhof: { maxPop: 0, maxJobs: 8, pollution: 2, landValue: 5 },
  // Parking
  parking_spot:      { maxPop: 0, maxJobs: 0, pollution: 1, landValue: -5 },
  parking_lot:       { maxPop: 0, maxJobs: 1, pollution: 2, landValue: -8 },
  parking_lot_large: { maxPop: 0, maxJobs: 2, pollution: 3, landValue: -10 },
  // Standalone buildings
  bank_house: { maxPop: 0, maxJobs: 30, pollution: 0, landValue: 35 },
  fcbasel_stadium: { maxPop: 500, maxJobs: 300, pollution: 5, landValue: 200 },
  st_ursen_kathedrale: { maxPop: 0, maxJobs: 20, pollution: 0, landValue: 180 },
  primetower: { maxPop: 0, maxJobs: 1200, pollution: 2, landValue: 250 },
  disco_solothurn: { maxPop: 0, maxJobs: 80, pollution: 3, landValue: 120 },
  // Habbo-style furniture
  furni: { maxPop: 0, maxJobs: 0, pollution: 0, landValue: 0 },
};
