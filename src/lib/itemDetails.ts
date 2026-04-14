import type { BuildingType } from '@/types/game';

export interface ItemDetails {
  footprintWidth: number;
  footprintHeight: number;
}

const ITEM_DETAILS: Partial<Record<BuildingType, ItemDetails>> = {
  power_plant: { footprintWidth: 2, footprintHeight: 2 },
  hospital: { footprintWidth: 2, footprintHeight: 2 },
  school: { footprintWidth: 2, footprintHeight: 2 },
  stadium: { footprintWidth: 3, footprintHeight: 3 },
  museum: { footprintWidth: 3, footprintHeight: 3 },
  university: { footprintWidth: 3, footprintHeight: 3 },
  airport: { footprintWidth: 4, footprintHeight: 4 },
  space_program: { footprintWidth: 3, footprintHeight: 3 },
  park_large: { footprintWidth: 3, footprintHeight: 3 },
  mansion: { footprintWidth: 2, footprintHeight: 2 },
  apartment_low: { footprintWidth: 2, footprintHeight: 2 },
  apartment_high: { footprintWidth: 2, footprintHeight: 2 },
  office_low: { footprintWidth: 2, footprintHeight: 2 },
  office_high: { footprintWidth: 2, footprintHeight: 2 },
  mall: { footprintWidth: 3, footprintHeight: 3 },
  factory_medium: { footprintWidth: 2, footprintHeight: 2 },
  factory_large: { footprintWidth: 3, footprintHeight: 3 },
  warehouse: { footprintWidth: 2, footprintHeight: 2 },
  city_hall: { footprintWidth: 2, footprintHeight: 2 },
  amusement_park: { footprintWidth: 4, footprintHeight: 4 },
  playground_large: { footprintWidth: 2, footprintHeight: 2 },
  baseball_field_small: { footprintWidth: 2, footprintHeight: 2 },
  football_field: { footprintWidth: 2, footprintHeight: 2 },
  baseball_stadium: { footprintWidth: 3, footprintHeight: 3 },
  mini_golf_course: { footprintWidth: 2, footprintHeight: 2 },
  go_kart_track: { footprintWidth: 2, footprintHeight: 2 },
  amphitheater: { footprintWidth: 2, footprintHeight: 2 },
  greenhouse_garden: { footprintWidth: 2, footprintHeight: 2 },
  marina_docks_small: { footprintWidth: 2, footprintHeight: 2 },
  roller_coaster_small: { footprintWidth: 2, footprintHeight: 2 },
  mountain_lodge: { footprintWidth: 2, footprintHeight: 2 },
  mountain_trailhead: { footprintWidth: 3, footprintHeight: 3 },
  rail_station: { footprintWidth: 2, footprintHeight: 2 },
  bank_house: { footprintWidth: 1, footprintHeight: 1 },
  bus_station: { footprintWidth: 4, footprintHeight: 4 },
  fcbasel_stadium: { footprintWidth: 3, footprintHeight: 3 },
  st_ursen_kathedrale: { footprintWidth: 2, footprintHeight: 2 },
  primetower: { footprintWidth: 2, footprintHeight: 2 },
  disco_solothurn: { footprintWidth: 2, footprintHeight: 2 },
  parking_lot:       { footprintWidth: 2, footprintHeight: 2 },
  parking_lot_large: { footprintWidth: 3, footprintHeight: 3 },
};

export function getItemDetails(type: BuildingType): ItemDetails {
  return ITEM_DETAILS[type] ?? { footprintWidth: 1, footprintHeight: 1 };
}

export function getItemFootprint(type: BuildingType): { width: number; height: number } {
  const details = getItemDetails(type);
  return { width: details.footprintWidth, height: details.footprintHeight };
}
