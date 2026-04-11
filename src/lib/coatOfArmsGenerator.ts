export type CoatPattern = 'solid' | 'split_vertical' | 'split_horizontal' | 'diagonal' | 'quarters';
export type CoatSymbol =
  | 'cross'
  | 'star'
  | 'mountain'
  | 'tree'
  | 'wave'
  | 'gear'
  | 'lion'
  | 'eagle'
  | 'crown'
  | 'castle';

export interface CoatOfArmsPreset {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: CoatPattern;
  symbol: CoatSymbol;
}

const PATTERNS: CoatPattern[] = ['solid', 'split_vertical', 'split_horizontal', 'diagonal', 'quarters'];
const SYMBOLS: CoatSymbol[] = [
  'cross',
  'star',
  'mountain',
  'tree',
  'wave',
  'gear',
  'lion',
  'eagle',
  'crown',
  'castle',
];
const COLOR_PALETTES: Array<[string, string, string]> = [
  ['#166534', '#22c55e', '#fef08a'],
  ['#1d4ed8', '#60a5fa', '#f8fafc'],
  ['#7c2d12', '#f59e0b', '#fde68a'],
  ['#831843', '#f472b6', '#fdf2f8'],
  ['#0f766e', '#2dd4bf', '#ecfeff'],
  ['#3f3f46', '#a1a1aa', '#f5f5f4'],
];

function pickRandom<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function sanitizeHexColor(value: string, fallback: string): string {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function renderPattern(preset: CoatOfArmsPreset): string {
  const p = sanitizeHexColor(preset.primaryColor, '#166534');
  const s = sanitizeHexColor(preset.secondaryColor, '#22c55e');

  switch (preset.pattern) {
    case 'split_vertical':
      return `<rect x="0" y="0" width="128" height="160" fill="${p}" /><rect x="128" y="0" width="128" height="160" fill="${s}" />`;
    case 'split_horizontal':
      return `<rect x="0" y="0" width="256" height="80" fill="${p}" /><rect x="0" y="80" width="256" height="80" fill="${s}" />`;
    case 'diagonal':
      return `<rect x="0" y="0" width="256" height="160" fill="${p}" /><polygon points="0,160 256,0 256,160" fill="${s}" />`;
    case 'quarters':
      return `
        <rect x="0" y="0" width="128" height="80" fill="${p}" />
        <rect x="128" y="0" width="128" height="80" fill="${s}" />
        <rect x="0" y="80" width="128" height="80" fill="${s}" />
        <rect x="128" y="80" width="128" height="80" fill="${p}" />
      `;
    case 'solid':
    default:
      return `<rect x="0" y="0" width="256" height="160" fill="${p}" />`;
  }
}

function renderSymbol(symbol: CoatSymbol, accent: string): string {
  switch (symbol) {
    case 'cross':
      return `
        <rect x="112" y="30" width="32" height="100" fill="${accent}" />
        <rect x="74" y="64" width="108" height="32" fill="${accent}" />
      `;
    case 'star':
      return `<polygon fill="${accent}" points="128,26 146,68 192,68 156,96 170,138 128,112 86,138 100,96 64,68 110,68" />`;
    case 'mountain':
      return `
        <polygon points="58,126 110,58 156,126" fill="${accent}" opacity="0.95" />
        <polygon points="106,126 164,44 212,126" fill="${accent}" opacity="0.8" />
      `;
    case 'tree':
      return `
        <rect x="116" y="98" width="24" height="34" fill="#6b4423" />
        <circle cx="128" cy="84" r="34" fill="${accent}" />
        <circle cx="100" cy="92" r="20" fill="${accent}" opacity="0.92" />
        <circle cx="154" cy="92" r="20" fill="${accent}" opacity="0.92" />
      `;
    case 'wave':
      return `
        <path d="M42 92 C62 72, 86 72, 106 92 C126 112, 150 112, 170 92 C190 72, 214 72, 234 92" fill="none" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
        <path d="M42 120 C62 100, 86 100, 106 120 C126 140, 150 140, 170 120 C190 100, 214 100, 234 120" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
      `;
    case 'gear':
      return `
        <circle cx="128" cy="80" r="32" fill="${accent}" />
        <circle cx="128" cy="80" r="14" fill="#0f172a" />
        <rect x="124" y="24" width="8" height="18" fill="${accent}" />
        <rect x="124" y="118" width="8" height="18" fill="${accent}" />
        <rect x="72" y="76" width="18" height="8" fill="${accent}" />
        <rect x="166" y="76" width="18" height="8" fill="${accent}" />
        <rect x="92" y="38" width="10" height="16" transform="rotate(-45 97 46)" fill="${accent}" />
        <rect x="154" y="106" width="10" height="16" transform="rotate(-45 159 114)" fill="${accent}" />
        <rect x="154" y="38" width="10" height="16" transform="rotate(45 159 46)" fill="${accent}" />
        <rect x="92" y="106" width="10" height="16" transform="rotate(45 97 114)" fill="${accent}" />
      `;
    case 'lion':
      return `
        <circle cx="132" cy="70" r="16" fill="${accent}" />
        <path d="M90 126 C90 96, 114 86, 132 88 C152 90, 170 100, 176 122 C178 132, 170 138, 160 136 L104 136 C96 136, 90 132, 90 126 Z" fill="${accent}" />
        <rect x="106" y="132" width="10" height="20" rx="4" fill="${accent}" />
        <rect x="124" y="132" width="10" height="20" rx="4" fill="${accent}" />
        <rect x="144" y="132" width="10" height="20" rx="4" fill="${accent}" />
        <path d="M96 118 C72 108, 70 84, 88 74 C96 70, 104 72, 108 80" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" />
      `;
    case 'eagle':
      return `
        <path d="M128 56 L144 76 L128 100 L112 76 Z" fill="${accent}" />
        <path d="M128 92 C156 78, 188 82, 210 108 C186 110, 164 120, 146 136 C140 126, 134 108, 128 92 Z" fill="${accent}" opacity="0.95" />
        <path d="M128 92 C100 78, 68 82, 46 108 C70 110, 92 120, 110 136 C116 126, 122 108, 128 92 Z" fill="${accent}" opacity="0.95" />
        <path d="M116 108 L128 124 L140 108 L136 144 H120 Z" fill="${accent}" />
      `;
    case 'crown':
      return `
        <path d="M72 126 L86 72 L120 104 L128 64 L136 104 L170 72 L184 126 Z" fill="${accent}" />
        <rect x="72" y="126" width="112" height="20" rx="4" fill="${accent}" />
        <circle cx="86" cy="70" r="6" fill="#f8fafc" />
        <circle cx="128" cy="60" r="6" fill="#f8fafc" />
        <circle cx="170" cy="70" r="6" fill="#f8fafc" />
      `;
    case 'castle':
      return `
        <rect x="86" y="86" width="84" height="58" fill="${accent}" />
        <rect x="74" y="72" width="20" height="72" fill="${accent}" />
        <rect x="162" y="72" width="20" height="72" fill="${accent}" />
        <rect x="106" y="64" width="44" height="80" fill="${accent}" />
        <rect x="120" y="110" width="16" height="34" fill="#0f172a" />
        <rect x="78" y="72" width="6" height="10" fill="#0f172a" />
        <rect x="170" y="72" width="6" height="10" fill="#0f172a" />
      `;
    default:
      return `<polygon fill="${accent}" points="128,26 146,68 192,68 156,96 170,138 128,112 86,138 100,96 64,68 110,68" />`;
  }
}

export function createRandomCoatOfArmsPreset(): CoatOfArmsPreset {
  const [primaryColor, secondaryColor, accentColor] = pickRandom(COLOR_PALETTES);
  return {
    primaryColor,
    secondaryColor,
    accentColor,
    pattern: pickRandom(PATTERNS),
    symbol: pickRandom(SYMBOLS),
  };
}

export function buildCoatOfArmsSvg(input: CoatOfArmsPreset): string {
  const preset: CoatOfArmsPreset = {
    primaryColor: sanitizeHexColor(input.primaryColor, '#166534'),
    secondaryColor: sanitizeHexColor(input.secondaryColor, '#22c55e'),
    accentColor: sanitizeHexColor(input.accentColor, '#fef08a'),
    pattern: PATTERNS.includes(input.pattern) ? input.pattern : 'solid',
    symbol: SYMBOLS.includes(input.symbol) ? input.symbol : 'star',
  };

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320" viewBox="0 0 256 320">
  <defs>
    <clipPath id="shieldShape">
      <path d="M24 16 H232 V156 C232 236 180 284 128 306 C76 284 24 236 24 156 Z" />
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>

  <g filter="url(#shadow)">
    <g clip-path="url(#shieldShape)">
      ${renderPattern(preset)}
      <rect x="0" y="160" width="256" height="160" fill="${preset.primaryColor}" opacity="0.14" />
      ${renderSymbol(preset.symbol, preset.accentColor)}
    </g>
    <path d="M24 16 H232 V156 C232 236 180 284 128 306 C76 284 24 236 24 156 Z"
      fill="none" stroke="#111827" stroke-width="10" />
    <path d="M36 26 H220 V154 C220 226 173 272 128 292 C83 272 36 226 36 154 Z"
      fill="none" stroke="#ffffff" stroke-opacity="0.42" stroke-width="3" />
  </g>
</svg>`.trim();
}
