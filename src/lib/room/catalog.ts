/**
 * catalog.ts — Katalog-Verwaltung (buildCatalogFromItems, findCatalogItem)
 *
 * Wird über ROOM_INIT mit SQL-Daten (shop_items Tabelle) befüllt.
 */
import type { CatalogItem } from './types'

// ─── Interne Typen ────────────────────────────────────────────────────────────

export interface CatalogEntry {
  id:        string
  label:     string
  icon:      string
  rotatable: boolean
}

export interface CatalogCategory {
  id:    string
  label: string
  icon:  string
  items: CatalogEntry[]
}

// ─── Kategorie-Metadaten ──────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; icon: string }> = {
  moebel:        { label: 'Möbel',        icon: '🛋️' },
  party:         { label: 'Party',        icon: '🎉' },
  bilder:        { label: 'Bilder',       icon: '🖼️' },
  hocker:        { label: 'Hocker',       icon: '🪑' },
  bar:           { label: 'Bar',          icon: '🍺' },
  kueche:        { label: 'Küche',        icon: '🍳' },
  buero:         { label: 'Büro',         icon: '💼' },
  schlafzimmer:  { label: 'Schlafzimmer', icon: '🛏️' },
  deko:          { label: 'Deko',         icon: '🕯️' },
  teppich:       { label: 'Teppiche',     icon: '🪵' },
  sport:         { label: 'Sport',        icon: '🏋️' },
  gaming:        { label: 'Gaming',       icon: '🎮' },
  spezial:       { label: 'Spezial',      icon: '✨' },
}

const CAT_ORDER = [
  'moebel','party','bilder','hocker','bar','kueche',
  'buero','schlafzimmer','deko','teppich','sport','gaming','spezial',
]

// ─── System ───────────────────────────────────────────────────────────────────

export interface CatalogSystem {
  build:    (apiItems: CatalogItem[]) => void
  find:     (id: string) => CatalogEntry | null
  getAll:   () => readonly CatalogCategory[]
  clear:    () => void
}

export function createCatalog(): CatalogSystem {
  let cats: CatalogCategory[] = []

  function build(apiItems: CatalogItem[]) {
    const catMap: Record<string, CatalogCategory> = {}
    for (const it of apiItems) {
      const catId = it.category || 'moebel'
      if (!catMap[catId]) {
        const meta = CAT_META[catId] || { label: catId, icon: '📦' }
        catMap[catId] = { id: catId, label: meta.label, icon: meta.icon, items: [] }
      }
      catMap[catId].items.push({
        id:        it.item_code,
        label:     it.display_name,
        icon:      it.icon || '📦',
        rotatable: it.rotatable === true,
      })
    }
    cats = [
      ...CAT_ORDER.filter(k => catMap[k]).map(k => catMap[k]),
      ...Object.values(catMap).filter(c => !CAT_ORDER.includes(c.id)),
    ]
  }

  function find(id: string): CatalogEntry | null {
    for (const cat of cats)
      for (const item of cat.items)
        if (item.id === id) return item
    return null
  }

  return {
    build,
    find,
    getAll:  () => cats as readonly CatalogCategory[],
    clear:   () => { cats = [] },
  }
}
