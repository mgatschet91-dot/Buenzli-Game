// whiteboard.js — Whiteboard auf Ständer (buero)
;(function () {
  ITEM_DEFS.add('whiteboard', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const board  = makeMat(0xfafafa)
    const frame  = makeMat(0x666666)
    const leg    = makeMat(0x888888)
    const marker = makeMat(0x2244cc)  // blaue Schrift-Linie
    const tray   = makeMat(0x555555)  // Marker-Ablage

    // Brett-Rahmen
    g.add(box(0.88, 0.68, 0.06, frame, 0, 0.98, 0))
    // Weiße Fläche
    g.add(box(0.82, 0.62, 0.04, board, 0, 0.98, 0.02))
    // Marker-Linie oben (Diagramm-Imitation)
    g.add(box(0.50, 0.03, 0.02, marker, -0.10, 1.08, 0.05))
    g.add(box(0.30, 0.03, 0.02, makeMat(0xcc2222), 0.22, 0.96, 0.05))
    g.add(box(0.60, 0.03, 0.02, makeMat(0x228844), -0.06, 0.84, 0.05))
    // Marker-Ablage vorne unten
    g.add(box(0.80, 0.06, 0.08, tray, 0, 0.64, 0.06))
    // Ständer — 2 Beine
    g.add(box(0.04, 0.62, 0.04, leg,  -0.30, 0.32, 0))
    g.add(box(0.04, 0.62, 0.04, leg,   0.30, 0.32, 0))
    // Füße (schräg nach vorne/hinten)
    g.add(box(0.04, 0.04, 0.44, leg, -0.30, 0.04, 0))
    g.add(box(0.04, 0.04, 0.44, leg,  0.30, 0.04, 0))
    // Verbindungsrohr unten
    g.add(box(0.60, 0.04, 0.04, leg, 0, 0.56, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
