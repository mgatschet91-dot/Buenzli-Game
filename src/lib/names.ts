// Name generation utilities for cities and water bodies

const CITY_NAME_PARTS = [
  'Spring', 'Riverside', 'Harbor', 'Valley', 'Hill', 'Bay', 'Creek', 'Park',
  'Lake', 'Mountain', 'Beach', 'Forest', 'Bridge', 'Port', 'View', 'Heights',
  'Grove', 'Meadow', 'Ridge', 'Point', 'Falls', 'Brook', 'Pine', 'Oak',
  'Maple', 'Cedar', 'Elm', 'Willow', 'Ash', 'Birch', 'Green', 'Blue',
  'White', 'Black', 'Red', 'New', 'Old', 'East', 'West', 'North', 'South',
  'Grand', 'Little', 'Big', 'Upper', 'Lower', 'Central', 'Fair', 'Bright',
  'Sunny', 'Clear', 'Rock', 'Stone', 'Iron', 'Gold', 'Silver', 'Copper',
  'Mill', 'Town', 'City', 'Ville', 'Burg', 'Field', 'Land', 'Wood',
];

const CITY_SUFFIXES = [
  'City', 'Town', 'Ville', 'Burg', 'Port', 'Harbor', 'Bay', 'Beach',
  'Park', 'Heights', 'Hills', 'Valley', 'Ridge', 'Point', 'Falls',
  'Springs', 'Grove', 'Meadow', 'Field', 'Woods', 'Lake', 'River',
];

const LAKE_NAMES = [
  'Genfersee',
  'Bodensee',
  'Neuenburgersee',
  'Vierwaldstättersee',
  'Zürichsee',
  'Luganersee',
  'Thunersee',
  'Brienzersee',
  'Zugersee',
  'Walensee',
  'Bielersee',
  'Murtensee',
  'Sempachersee',
  'Hallwilersee',
  'Greifensee',
  'Pfäffikersee',
  'Ägerisee',
  'Sarnersee',
  'Lauerzersee',
  'Silsersee',
  'Silvaplanersee',
  'St Moritzersee',
  'Lej da Champfer',
  'Lej Nair',
  'Oeschinensee',
  'Blausee',
  'Caumasee',
  'Lac de Joux',
  'Lac Brenet',
  'Lac de Bret',
  'Lac de Tseuzier',
  'Lago Maggiore',
  'Lago di Poschiavo',
  'Lago di Muzzano',
  'Lago di Saoseo',
  'Lac des Brenets',
  'Daubensee',
  'Arnensee',
  'Lac de Neuchâtel',
  'Lac de Morat',
  'Lac de Bienne',
];

const OCEAN_NAMES = [
  'Bodensee',
  'Genfersee',
  'Neuenburgersee',
  'Vierwaldstättersee',
  'Zürichsee',
  'Luganersee',
  'Lago Maggiore',
  'Bielersee',
  'Murtensee',
  'Thunersee',
  'Brienzersee',
  'Walensee',
];

export function generateCityName(): string {
  const part1 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const part2 = CITY_NAME_PARTS[Math.floor(Math.random() * CITY_NAME_PARTS.length)];
  const suffix = CITY_SUFFIXES[Math.floor(Math.random() * CITY_SUFFIXES.length)];
  
  // Sometimes use two parts, sometimes one part + suffix
  if (Math.random() > 0.5) {
    return `${part1} ${suffix}`;
  } else {
    // Avoid duplicate parts
    if (part1 === part2) {
      return `${part1} ${suffix}`;
    }
    return `${part1}${part2} ${suffix}`;
  }
}

export function generateWaterName(type: 'lake' | 'ocean'): string {
  const filtered = type === 'lake' ? LAKE_NAMES : OCEAN_NAMES;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
