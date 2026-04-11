'use client'

import { useEffect, useRef } from 'react'

const SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js',
  '/isometric/src/editor.js',
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

export default function EditorPage() {
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true
    loadScriptsSequentially(SCRIPTS)
  }, [])

  return (
    <>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #1a1a2e !important; color: #eee !important; font: 13px/1.4 'Segoe UI', sans-serif !important; overflow: hidden !important; }
        #canvas-host { position: fixed; inset: 0; z-index: 0; }
        #ui { position: fixed; inset: 0; z-index: 1; pointer-events: none; display: flex; flex-direction: column; }

        #toolbar {
          display: flex; align-items: center; gap: 5px; padding: 8px 12px;
          background: rgba(10,10,30,0.85); backdrop-filter: blur(6px);
          border-bottom: 1px solid rgba(255,255,255,0.09); pointer-events: all;
        }
        #toolbar .sep { flex: 1; }
        #toolbar .label { font-size: 11px; color: #555; margin-right: 2px; }
        .tb-btn {
          padding: 6px 11px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer; font: inherit; font-size: 12px; font-weight: 600;
          background: rgba(255,255,255,0.07); color: #bbb; white-space: nowrap;
          transition: background 0.12s, border-color 0.12s;
        }
        .tb-btn:hover { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.2); }
        .tb-btn.active { background: #2563b0; border-color: #3a7bd5; color: #fff; }
        .tb-btn.green { background: rgba(40,160,70,0.3); border-color: rgba(40,200,80,0.3); color: #7edc9a; }
        .tb-btn.green:hover { background: rgba(40,160,70,0.55); }

        #main { flex: 1; display: flex; overflow: hidden; }

        #left-panel {
          width: 175px; display: flex; flex-direction: column;
          background: rgba(10,10,30,0.78); backdrop-filter: blur(6px);
          border-right: 1px solid rgba(255,255,255,0.07); pointer-events: all;
        }
        #left-panel .ph { padding: 9px 12px; font-size: 10px; text-transform: uppercase;
          letter-spacing: 1px; color: #555; border-bottom: 1px solid rgba(255,255,255,0.05); }
        #floor-list { flex: 1; overflow-y: auto; padding: 3px 0; }
        .li {
          padding: 7px 10px; cursor: pointer; font-size: 12px;
          display: flex; align-items: center; gap: 7px;
          border-left: 3px solid transparent; user-select: none;
        }
        .li:hover { background: rgba(255,255,255,0.05); }
        .li.sel { background: rgba(37,99,176,0.22); border-left-color: #3a7bd5; }
        .li .ic { font-size: 13px; opacity: 0.7; flex-shrink: 0; }
        .li .nm { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        #canvas-space { flex: 1; }

        #right-panel {
          width: 240px; background: rgba(10,10,30,0.78); backdrop-filter: blur(6px);
          border-left: 1px solid rgba(255,255,255,0.07); pointer-events: all; overflow-y: auto;
        }
        #right-panel .ph { padding: 9px 12px; font-size: 10px; text-transform: uppercase;
          letter-spacing: 1px; color: #555; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .psec { padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .psec h5 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #555; margin-bottom: 8px; }
        .pr { margin-bottom: 7px; }
        .pr label { display: block; font-size: 11px; color: #666; margin-bottom: 3px; }
        .pr input[type="number"], .pr input[type="text"], .pr select {
          width: 100%; padding: 5px 8px; border-radius: 5px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: #ddd; font: inherit; font-size: 12px;
        }
        .pr select option { background: #1a1a3a; }
        .pr.two { display: flex; gap: 6px; }
        .pr.two > div { flex: 1; }
        .pr input[type="color"] { width: 100%; height: 28px; border-radius: 4px; border: none; cursor: pointer; }
        .pval { font-size: 12px; color: #aaa; padding: 2px 0; }
        #props-empty { padding: 20px 12px; font-size: 12px; color: #444; text-align: center; line-height: 1.8; }

        .compass { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; }
        .compass-cell { display: flex; gap: 3px; justify-content: center; align-items: center; }
        .compass-center { font-size: 11px; color: #555; text-align: center; padding: 2px; }
        .rb {
          flex: 1; padding: 5px 3px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);
          cursor: pointer; font: inherit; font-size: 11px; font-weight: 700;
          background: rgba(255,255,255,0.06); color: #aaa; text-align: center;
        }
        .rb:hover { background: rgba(37,99,176,0.4); border-color: #3a7bd5; color: #fff; }

        .wall-row { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
        .wall-row label { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #aaa; cursor: pointer; flex: 1; }
        .wall-row input[type="checkbox"] { accent-color: #3a7bd5; width: 14px; height: 14px; cursor: pointer; flex-shrink: 0; }
        .door-lbl { font-size: 11px; color: #777; cursor: pointer; display: flex; align-items: center; gap: 4px; }
        .door-lbl input[type="checkbox"] { accent-color: #d4a020; width: 12px; height: 12px; }

        .del-btn {
          width: 100%; padding: 7px; border-radius: 6px; border: 1px solid rgba(200,50,50,0.3);
          background: rgba(200,50,50,0.12); color: #e88; cursor: pointer; font: inherit; font-size: 12px; font-weight: 600;
        }
        .del-btn:hover { background: rgba(200,50,50,0.35); border-color: rgba(200,50,50,0.6); }

        .modal {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
          background: rgba(14,14,34,0.97); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 10px; padding: 20px; width: 290px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.7); pointer-events: all; z-index: 100;
        }
        .modal.hidden { display: none; }
        .modal h3 { font-size: 14px; margin-bottom: 16px; color: #9bbfee; }
        .mr { margin-bottom: 10px; }
        .mr > label { display: block; font-size: 11px; color: #666; margin-bottom: 4px; }
        .mr input, .mr select {
          width: 100%; padding: 6px 9px; border-radius: 5px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12);
          color: #eee; font: inherit; font-size: 12px;
        }
        .mr select option { background: #1a1a3a; }
        .mr .row2 { display: flex; gap: 8px; }
        .mr .row2 > div { flex: 1; }
        .mr .row2 label { display: block; font-size: 11px; color: #666; margin-bottom: 4px; }
        .dir-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
        .style-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; }
        .db {
          padding: 7px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05); color: #888; cursor: pointer; font: inherit;
          font-size: 13px; text-align: center;
        }
        .db.sel { background: #2563b0; border-color: #3a7bd5; color: #fff; }
        .modal-btns { display: flex; gap: 7px; margin-top: 16px; }
        .modal-btns button { flex: 1; padding: 9px; border-radius: 6px; border: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; }
        .modal-btns .ok  { background: #2563b0; color: #fff; }
        .modal-btns .ok:hover { background: #3a7bd5; }
        .modal-btns .cx  { background: rgba(255,255,255,0.08); color: #888; }
        .modal-btns .cx:hover { background: rgba(255,255,255,0.15); }
        .modal-sep { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 12px 0; }

        #hint {
          position: fixed; bottom: 48px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.75); color: #aaa; padding: 6px 16px; border-radius: 20px;
          font-size: 12px; pointer-events: none; opacity: 0; transition: opacity 0.2s;
          z-index: 50; white-space: nowrap;
        }
        #hint.show { opacity: 1; }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
      `}</style>

      <div id="canvas-host"></div>

      <div id="ui">
        <div id="toolbar">
          <button className="tb-btn active" data-tool="select">&#x25b6; Ausw&auml;hlen</button>
          <button className="tb-btn" data-tool="floor">&#x1f7e9; Etage</button>
          <button className="tb-btn" data-tool="stair">&#x1fa9c; Treppe</button>
          <button className="tb-btn" data-tool="roller">&#x1f504; Roller</button>
          <button className="tb-btn" data-tool="spawn">&#x2b50; Spawn</button>
          <button className="tb-btn" data-tool="hole">&#x2b1c; Tile</button>
          <div className="sep"></div>
          <span className="label">Ansicht:</span>
          <button className="tb-btn" id="btn-rot-l">&#x25c0; Drehen</button>
          <button className="tb-btn" id="btn-rot-r">Drehen &#x25b6;</button>
          <button className="tb-btn green" id="btn-save">&#x1f4be; Speichern</button>
          <button className="tb-btn" id="btn-close" style={{ background: 'rgba(160,40,40,0.35)', borderColor: 'rgba(220,60,60,0.3)', color: '#f88' }}>&#x2715; Schlie&szlig;en</button>
        </div>

        <div id="main">
          <div id="left-panel">
            <div className="ph">Objekte</div>
            <div id="floor-list"></div>
          </div>
          <div id="canvas-space"></div>
          <div id="right-panel">
            <div className="ph">Eigenschaften</div>
            <div id="props-content">
              <div id="props-empty">Klicke auf ein Objekt<br />um es zu bearbeiten</div>
            </div>
          </div>
        </div>
      </div>

      {/* Floor Modal */}
      <div id="floor-modal" className="modal hidden">
        <h3>&#x1f7e9; Neue Etage</h3>
        <div className="mr">
          <label>Name</label>
          <input type="text" id="fm-name" defaultValue="Etage" />
        </div>
        <div className="mr">
          <label>H&ouml;he Y (m) &mdash; wie hoch schwebt diese Etage?</label>
          <input type="number" id="fm-y" defaultValue={0} step={0.5} min={0} />
        </div>
        <hr className="modal-sep" />
        <div className="mr">
          <label>Startgr&ouml;&szlig;e</label>
          <div className="row2">
            <div><label>Breite (X-Kacheln)</label><input type="number" id="fm-tx" defaultValue={10} min={1} max={50} /></div>
            <div><label>Tiefe (Z-Kacheln)</label><input type="number" id="fm-tz" defaultValue={10} min={1} max={50} /></div>
          </div>
        </div>
        <div className="mr">
          <div className="row2">
            <div><label>Farbe A</label><input type="color" id="fm-ca" defaultValue="#4a7a5a" /></div>
            <div><label>Farbe B</label><input type="color" id="fm-cb" defaultValue="#527d63" /></div>
          </div>
        </div>
        <div className="modal-btns">
          <button className="ok" id="fm-ok">Erstellen</button>
          <button className="cx" id="fm-cancel">Abbrechen</button>
        </div>
      </div>

      {/* Stair Modal */}
      <div id="stair-modal" className="modal hidden">
        <h3>&#x1fa9c; Treppe platzieren</h3>
        <div className="mr">
          <label>Typ</label>
          <div className="style-grid" id="stair-style-grid">
            <button className="db sel" data-style="classic">Klassisch</button>
            <button className="db" data-style="wood">&#x1fab5; Holz</button>
            <button className="db" data-style="stone">&#x1f9f1; Stein</button>
            <button className="db" data-style="metal">&#x2699;&#xfe0f; Metall</button>
            <button className="db" data-style="open">&#x2728; Glas</button>
            <button className="db" data-style="down">&#x2b07;&#xfe0f; Keller</button>
          </div>
        </div>
        <hr className="modal-sep" />
        <div className="mr">
          <label>Richtung (Treppe steigt in diese Richtung)</label>
          <div className="dir-grid">
            <button className="db sel" data-dir="N">&#x2191; Nord</button>
            <button className="db" data-dir="S">&#x2193; S&uuml;d</button>
            <button className="db" data-dir="W">&#x2190; West</button>
            <button className="db" data-dir="E">&#x2192; Ost</button>
          </div>
        </div>
        <hr className="modal-sep" />
        <div className="mr">
          <div className="row2">
            <div><label>Breite (Kacheln)</label><input type="number" id="stair-width" defaultValue={3} min={1} max={10} /></div>
            <div><label>Anzahl Stufen</label><input type="number" id="stair-steps" defaultValue={14} min={4} max={40} /></div>
          </div>
        </div>
        <hr className="modal-sep" />
        <div className="mr">
          <label>Obere Etage verbinden</label>
          <select id="stair-new-floor" defaultValue="new">
            <option value="new">+ Neue Etage automatisch erstellen</option>
            <option value="none">Nur Treppe (keine obere Etage)</option>
          </select>
        </div>
        <div className="mr" id="stair-height-row">
          <label>H&ouml;he der neuen oberen Etage (m)</label>
          <input type="number" id="stair-height" defaultValue={7} min={1} max={40} step={0.5} />
        </div>
        <div className="modal-btns">
          <button className="ok" id="stair-ok">Treppe erstellen</button>
          <button className="cx" id="stair-cancel">Abbrechen</button>
        </div>
      </div>

      {/* Roller Modal */}
      <div id="roller-modal" className="modal hidden">
        <h3>&#x1f504; Roller platzieren</h3>
        <div className="mr">
          <label>Schubrichtung</label>
          <div className="dir-grid">
            <button className="db" data-dir="N">&#x2191; Nord</button>
            <button className="db sel" data-dir="S">&#x2193; S&uuml;d</button>
            <button className="db" data-dir="W">&#x2190; West</button>
            <button className="db" data-dir="E">&#x2192; Ost</button>
          </div>
        </div>
        <div className="modal-btns">
          <button className="ok" id="roller-ok">Roller erstellen</button>
          <button className="cx" id="roller-cancel">Abbrechen</button>
        </div>
      </div>

      <div id="hint"></div>
    </>
  )
}
