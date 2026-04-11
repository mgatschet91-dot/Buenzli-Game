/**
 * item-registry.js — Globale Möbel-Registry
 *
 * Jede Möbel-Datei in /isometric/items/ ruft ITEM_DEFS.add(item_code, buildFn) auf.
 * game3d.js prüft die Registry zuerst, bevor es auf eingebaute Builder zurückfällt.
 * item_code muss exakt dem Eintrag in der shop_items SQL-Tabelle entsprechen.
 *
 * Ladereihenfolge in index.html:
 *   1. three.min.js
 *   2. src/item-registry.js   ← dieses File (ITEM_DEFS global definieren)
 *   3. src/game3d.js          ← nutzt ITEM_DEFS in spawnPlaced()
 *   4. items/*.js             ← registrieren sich hier
 */

'use strict';

const ITEM_DEFS = (function () {
  const _items = Object.create(null);

  return {
    /**
     * Möbel registrieren.
     * @param {string}   id       — item_code (z.B. 'chair_office')
     * @param {Function} buildFn  — function(wx, wz, facingY) → THREE.Group
     */
    add(id, buildFn) {
      _items[id] = buildFn;
    },

    /**
     * Builder-Funktion für ein item_code holen.
     * @returns {Function|null}
     */
    get(id) {
      return _items[id] || null;
    },

    /** Alle registrierten item_codes */
    ids() {
      return Object.keys(_items);
    },
  };
})();
