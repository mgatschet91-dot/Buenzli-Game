'use client'

import { useEffect, useRef } from 'react'

const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
  '/isometric/src/GLTFLoader.js',
  '/isometric/src/item-registry.js',
  '/isometric/src/game3d-core.js',
  '/isometric/src/game3d-rooms.js',
  '/isometric/src/game3d-furniture.js',
  '/isometric/src/game3d-placement.js',
  '/isometric/src/game3d-character.js',
  '/isometric/src/game3d.js',
  '/isometric/items/_legacy_items.js',
  '/isometric/items/counter_kitchen.js',
  '/isometric/items/stove.js',
  '/isometric/items/sink_kitchen.js',
  '/isometric/items/coffee_machine.js',
  '/isometric/items/microwave.js',
  '/isometric/items/desk_office.js',
  '/isometric/items/chair_office.js',
  '/isometric/items/computer.js',
  '/isometric/items/whiteboard.js',
  '/isometric/items/filing_cabinet.js',
  '/isometric/items/nightstand.js',
  '/isometric/items/wardrobe_big.js',
  '/isometric/items/mirror_stand.js',
  '/isometric/items/vanity_table.js',
  '/isometric/items/fireplace.js',
  '/isometric/items/aquarium.js',
  '/isometric/items/vase_tall.js',
  '/isometric/items/candles.js',
  '/isometric/items/carpet_round.js',
  '/isometric/items/carpet_rectangle.js',
  '/isometric/items/carpet_square.js',
  '/isometric/items/carpet_doormat.js',
  '/isometric/items/carpet_rounded.js',
  '/isometric/items/carpet_bath.js',
  '/isometric/items/carpet_runner.js',
  '/isometric/items/treadmill.js',
  '/isometric/items/punching_bag.js',
  '/isometric/items/yoga_mat.js',
  '/isometric/items/weights_rack.js',
  '/isometric/items/arcade_machine.js',
  '/isometric/items/pinball_machine.js',
  '/isometric/items/gaming_chair.js',
  '/isometric/items/pool_table.js',
  '/isometric/items/teleporter.js',
  '/isometric/items/jacuzzi.js',
  '/isometric/items/npc_room.js',
  '/isometric/items/test_lamp.js',
]

function loadScriptsSequentially(urls: string[]): Promise<void> {
  return urls.reduce<Promise<void>>((chain, url) => {
    return chain.then(() => new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = url
      s.onload = () => resolve()
      s.onerror = () => reject(new Error(`Failed to load ${url}`))
      document.body.appendChild(s)
    }))
  }, Promise.resolve())
}

export default function IsometricPage() {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    loadScriptsSequentially(SCRIPTS).then(() => {
      window.parent?.postMessage({ type: 'SCRIPTS_LOADED' }, '*')
    })
  }, [])

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #111520 !important; overflow: hidden !important;
          color: #e0e4ed;
          font-family: var(--font-sans), system-ui, sans-serif;
          -webkit-font-smoothing: none;
          -moz-osx-font-smoothing: auto;
        }

        /* ── Avatar Editor Panel ─────────────────────────────────────── */
        #av-panel {
          position: fixed; left: 0; top: 50%;
          transform: translate(calc(-100% - 6px), -50%);
          width: 300px; max-height: 82vh;
          background: rgba(23,28,38,0.97);
          border: 1px solid #2b303b;
          border-left: none;
          border-radius: 0 4px 4px 0;
          display: flex; flex-direction: column;
          font-family: inherit;
          z-index: 90;
          transition: transform 0.30s cubic-bezier(0.32,0.72,0,1);
          box-shadow: 8px 0 40px rgba(0,0,0,0.6);
          backdrop-filter: blur(14px);
          pointer-events: all;
          overflow: hidden;
        }
        #av-panel.av-open { transform: translate(0, -50%); }

        #av-titlebar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 14px 8px;
          border-bottom: 1px solid #2b303b;
          flex-shrink: 0;
        }
        #av-title { font-size: 13px; font-weight: 700; color: #e8a842; letter-spacing: 0.5px; }
        #av-close {
          background: rgba(200,50,50,0.15); border: 1px solid rgba(200,50,50,0.25);
          border-radius: 4px; padding: 4px 11px; color: #e86060;
          cursor: pointer; font: inherit; font-size: 11px;
          transition: background 0.12s;
        }
        #av-close:hover { background: rgba(200,50,50,0.40); color: #fff; }

        #av-cats {
          display: flex; gap: 3px; padding: 8px 10px 0;
          flex-shrink: 0; overflow-x: auto;
        }
        .av-cat {
          background: rgba(255,255,255,0.04);
          border: 1px solid #2b303b;
          border-bottom: none; border-radius: 4px 4px 0 0;
          padding: 6px 10px;
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          color: rgba(224,228,237,0.45); font-size: 10px; white-space: nowrap;
          cursor: pointer; font: inherit;
          transition: background 0.12s, color 0.12s;
        }
        .av-cat:hover { background: rgba(255,255,255,0.08); color: #e0e4ed; }
        .av-cat.av-active { background: rgba(232,168,66,0.18); border-color: #e8a842; color: #e8a842; }
        .av-cat-ic { font-size: 16px; line-height: 1; }
        .av-cat-lb { font-size: 9px; }

        #av-styles-wrap {
          overflow-y: auto; flex: 1; padding: 8px 10px 4px;
          border-top: 1px solid #2b303b;
        }
        #av-styles {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 6px;
          min-height: 10px;
        }
        .av-gender-lbl {
          grid-column: 1 / -1;
          font-size: 10px; font-weight: 700;
          color: #e8a842; letter-spacing: 0.5px;
          padding: 4px 2px 2px;
          border-bottom: 1px solid #2b303b;
          margin-bottom: 2px;
        }
        .av-si {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 8px 4px 7px;
          border-radius: 4px; border: 1px solid #2b303b;
          background: rgba(255,255,255,0.03);
          cursor: pointer; user-select: none;
          transition: background 0.12s, border-color 0.12s, transform 0.08s;
        }
        .av-si:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); transform: translateY(-2px); }
        .av-si.av-si-on { background: rgba(232,168,66,0.18); border-color: #e8a842; }
        .av-si-ic { font-size: 22px; line-height: 1; }
        .av-si-lb { font-size: 9px; color: #6b7080; text-align: center; }
        .av-si.av-si-on .av-si-lb { color: #e8a842; }

        #av-color-section {
          padding: 6px 10px 10px;
          border-top: 1px solid #2b303b;
          flex-shrink: 0;
        }
        #av-color-lbl { font-size: 10px; color: #6b7080; margin-bottom: 6px; }
        #av-colors { display: flex; flex-wrap: wrap; gap: 5px; }
        .av-swatch {
          width: 24px; height: 24px; border-radius: 4px;
          border: 2px solid #2b303b;
          cursor: pointer;
          transition: transform 0.08s, border-color 0.1s;
        }
        .av-swatch:hover { transform: scale(1.18); border-color: rgba(255,255,255,0.30); }
        .av-swatch.av-sw-on { border-color: #e8a842; box-shadow: 0 0 6px rgba(232,168,66,0.5); transform: scale(1.12); }

        /* ── Place Hint ──────────────────────────────────────────────── */
        #place-hint {
          position: fixed; bottom: 100px; left: 50%;
          transform: translateX(-50%);
          background: rgba(23,28,38,0.92); color: #e8a842;
          border: 1px solid #2b303b;
          padding: 7px 18px; border-radius: 4px;
          font-size: 11px; font-family: inherit;
          pointer-events: none; display: none;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        }

        #obj-menu { display: none !important; }

        /* ── Furniture Panel ─────────────────────────────────────────── */
        #furniture-panel {
          position: fixed; right: 16px; bottom: 16px;
          display: none; flex-direction: column;
          width: 238px;
          background: rgba(23,28,38,0.97);
          border: 1px solid #2b303b;
          border-radius: 4px; overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.6);
          backdrop-filter: blur(14px);
          font-family: inherit;
          z-index: 60; pointer-events: all;
          transition: opacity 0.15s, transform 0.15s;
        }
        #furniture-panel.fp-in { opacity: 1; transform: translateY(0); }
        #furniture-panel .fp-header {
          display: flex; align-items: center; gap: 9px;
          padding: 11px 12px 9px;
          border-bottom: 1px solid #2b303b;
        }
        #furniture-panel .fp-icon-sm { font-size: 26px; line-height: 1; flex-shrink: 0; }
        #furniture-panel .fp-title {
          font-size: 13px; font-weight: 700;
          color: #e0e4ed; letter-spacing: 0.2px; flex: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        #furniture-panel .fp-close {
          background: none; border: none; color: #6b7080; cursor: pointer;
          font-size: 15px; line-height: 1; padding: 2px 4px;
          border-radius: 4px; transition: color 0.1s, background 0.1s;
          flex-shrink: 0;
        }
        #furniture-panel .fp-close:hover { color: #fff; background: rgba(200,50,50,0.3); }
        #furniture-panel .fp-actions {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 7px; padding: 10px;
        }
        #furniture-panel .fp-actions button {
          display: flex; flex-direction: column; align-items: center;
          gap: 5px; padding: 10px 6px 9px;
          border-radius: 4px; border: 1px solid #2b303b;
          background: rgba(255,255,255,0.04); color: #e0e4ed;
          cursor: pointer; font: inherit; font-size: 11px;
          transition: background 0.12s, transform 0.08s, border-color 0.12s;
          user-select: none;
        }
        #furniture-panel .fp-actions button:hover {
          background: rgba(255,255,255,0.10); color: #fff;
          transform: translateY(-2px);
        }
        #furniture-panel .fp-actions button .bic { font-size: 20px; line-height: 1; }
        #fp-rotate {
          background: rgba(232,168,66,0.12) !important;
          border-color: rgba(232,168,66,0.30) !important; color: #e8a842 !important;
        }
        #fp-rotate:hover { background: rgba(232,168,66,0.30) !important; }
        #fp-move {
          background: rgba(58,162,88,0.12) !important;
          border-color: rgba(58,162,88,0.30) !important; color: #3aa258 !important;
        }
        #fp-move:hover { background: rgba(58,162,88,0.30) !important; }
        #fp-pickup {
          background: rgba(232,168,66,0.12) !important;
          border-color: rgba(232,168,66,0.25) !important; color: #e8a842 !important;
        }
        #fp-pickup:hover { background: rgba(232,168,66,0.30) !important; }
        #fp-delete:hover {
          background: rgba(200,50,50,0.35) !important;
          border-color: rgba(200,50,50,0.50) !important; color: #fff !important;
        }

        /* ── Scrollbar (Art Deco style) ──────────────────────────────── */
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #111520; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(180deg, hsl(42,82%,45%) 0%, hsl(35,78%,36%) 100%); border-radius: 0; }
        ::-webkit-scrollbar-thumb:hover { background: linear-gradient(180deg, hsl(42,95%,62%) 0%, hsl(35,82%,45%) 100%); }
      `}</style>

      {/* Avatar editor panel */}
      <div id="av-panel">
        <div id="av-titlebar">
          <span id="av-title">&#x1f464; Avatar Editor</span>
          <button id="av-close">&#x2715; Schlie&szlig;en</button>
        </div>
        <div id="av-cats"></div>
        <div id="av-styles-wrap">
          <div id="av-styles"></div>
        </div>
        <div id="av-color-section">
          <div id="av-color-lbl"></div>
          <div id="av-colors"></div>
        </div>
      </div>

      {/* Placement hint */}
      <div id="place-hint">&#x1f5b1;&#xfe0f; Klicken zum Platzieren &nbsp;&middot;&nbsp; &#x1f5b1;&#xfe0f; Scroll = Drehen &nbsp;&middot;&nbsp; ESC = Abbrechen</div>

      {/* Furniture panel */}
      <div id="furniture-panel">
        <div className="fp-header">
          <span className="fp-icon-sm" id="fp-icon-sm">&#x1f4e6;</span>
          <span className="fp-title" id="fp-title">M&ouml;bel</span>
          <button className="fp-close" id="fp-close">&#x2715;</button>
        </div>
        <div className="fp-actions">
          <button id="fp-rotate"><span className="bic">&#x21a9;&#xfe0f;</span><span>Drehen</span></button>
          <button id="fp-move"><span className="bic">&#x270b;</span><span>Bewegen</span></button>
          <button id="fp-pickup"><span className="bic">&#x1f4e6;</span><span>Aufnehmen</span></button>
          <button id="fp-delete"><span className="bic">&#x1f5d1;&#xfe0f;</span><span>L&ouml;schen</span></button>
        </div>
      </div>

      {/* Hidden legacy menu */}
      <div id="obj-menu" style={{ display: 'none' }}>
        <div className="om-card">
          <button id="om-rotate"><span className="bic">&#x21a9;&#xfe0f;</span><span>Drehen</span></button>
          <button id="om-delete"><span className="bic">&#x1f5d1;&#xfe0f;</span><span>L&ouml;schen</span></button>
        </div>
      </div>
    </>
  )
}
