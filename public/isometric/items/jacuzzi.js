// jacuzzi.js — Whirlpool / Jacuzzi für 4 Personen, 4×4 Tiles (deko)
;(function () {
  ITEM_DEFS.add('jacuzzi', function (wx, wz) {
    const { lvl, baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()

    const outer  = makeMat(0x5a4a3a)   // Holzverkleidung außen (dunkelbraun)
    const outerL = makeMat(0x7a6a58)   // Holz heller für Seiten
    const inner  = makeMat(0xf0ece4)   // weiße Innenkacheln
    const rim    = makeMat(0xc8c0b0)   // Steinrand oben
    const water  = new THREE.MeshLambertMaterial({ color: 0x1e90e8, transparent: true, opacity: 0.82 })
    const waterS = new THREE.MeshLambertMaterial({ color: 0x44aaff, transparent: true, opacity: 0.60 })
    const jet    = makeMat(0x999aaa)   // Düsen Chrom
    const step   = makeMat(0xaa9980)   // Treppenstufen

    // Größen — 4×4 Tiles Außenmaß
    const OW = 4.10   // Außenwanne Breite/Tiefe
    const IW = 3.30   // Innenwanne Breite/Tiefe
    const WH = 0.78   // Wandhöhe
    const WT = 0.18   // Wanddicke
    const OA = OW / 2 // Außen-Abstand vom Zentrum

    // ── Außenverkleidung ────────────────────────────────────────────────────
    g.add(box(OW + 0.10, 0.10, OW + 0.10, outer,  0, 0.05, 0))              // Bodenplatte
    g.add(box(OW, WH, WT,  outer,     0,       WH/2, -(OA + WT/2)))         // N
    g.add(box(OW, WH, WT,  outer,     0,       WH/2,  (OA + WT/2)))         // S
    g.add(box(WT, WH, OW,  outerL,  -(OA + WT/2), WH/2, 0))                // W
    g.add(box(WT, WH, OW,  outerL,   (OA + WT/2), WH/2, 0))                // E

    // Steinrand — breit, oben
    const RA = OA + WT + 0.12
    g.add(box(OW + WT*2 + 0.26, 0.10, 0.30, rim,  0,  WH + 0.05, -(OA + WT/2)))  // N
    g.add(box(OW + WT*2 + 0.26, 0.10, 0.30, rim,  0,  WH + 0.05,  (OA + WT/2)))  // S
    g.add(box(0.30, 0.10, OW + WT*2 + 0.26, rim, -(OA + WT/2), WH + 0.05, 0))    // W
    g.add(box(0.30, 0.10, OW + WT*2 + 0.26, rim,  (OA + WT/2), WH + 0.05, 0))    // E
    for (const [ex, ez] of [[-1,-1],[-1,1],[1,-1],[1,1]])
      g.add(box(0.30, 0.10, 0.30, rim, ex * (OA + WT/2), WH + 0.05, ez * (OA + WT/2)))

    // ── Innenwanne ──────────────────────────────────────────────────────────
    const IA = IW / 2
    g.add(box(IW, 0.08, IW, inner,  0, 0.12, 0))                            // Innenboden
    g.add(box(IW, WH - 0.02, 0.08, inner,  0,       WH/2 + 0.04, -IA))     // N innen
    g.add(box(IW, WH - 0.02, 0.08, inner,  0,       WH/2 + 0.04,  IA))     // S innen
    g.add(box(0.08, WH - 0.02, IW, inner, -IA, WH/2 + 0.04, 0))            // W innen
    g.add(box(0.08, WH - 0.02, IW, inner,  IA, WH/2 + 0.04, 0))            // E innen

    // Sitzabsätze (an jeder Innenwand)
    const SB = IA - 0.14   // Sitzbank-Abstand vom Zentrum
    g.add(box(IW - 0.04, 0.20, 0.26, inner,  0,    0.25,  -SB))            // N-Sitz
    g.add(box(IW - 0.04, 0.20, 0.26, inner,  0,    0.25,   SB))            // S-Sitz
    g.add(box(0.26, 0.20, IW - 0.04, inner, -SB,   0.25,   0))             // W-Sitz
    g.add(box(0.26, 0.20, IW - 0.04, inner,  SB,   0.25,   0))             // E-Sitz

    // ── Wasserfüllung ───────────────────────────────────────────────────────
    const waterFill = new THREE.Mesh(new THREE.BoxGeometry(IW - 0.10, 0.46, IW - 0.10), water)
    waterFill.position.set(0, 0.37, 0)
    g.add(waterFill)
    const waterTop = new THREE.Mesh(new THREE.BoxGeometry(IW - 0.10, 0.02, IW - 0.10), waterS)
    waterTop.position.set(0, 0.605, 0)
    g.add(waterTop)

    // ── Düsen ──────────────────────────────────────────────────────────────
    const DJ = IA - 0.04
    for (const [jx, jz] of [[-0.7,-DJ],[0,- DJ],[0.7,-DJ],[-0.7,DJ],[0,DJ],[0.7,DJ]])
      g.add(box(0.10, 0.07, 0.04, jet, jx, 0.36, jz))
    for (const [jx, jz] of [[-DJ,-0.7],[-DJ,0],[-DJ,0.7],[DJ,-0.7],[DJ,0],[DJ,0.7]])
      g.add(box(0.04, 0.07, 0.10, jet, jx, 0.36, jz))

    // ── Einstiegsstufen (S-Seite, mittig) ──────────────────────────────────
    g.add(box(0.80, 0.14, 0.22, step,  0, 0.07, OA + WT + 0.11))
    g.add(box(0.76, 0.07, 0.18, step,  0, 0.03, OA + WT + 0.30))

    // ── Blubber-Blasen ──────────────────────────────────────────────────────
    const bubbles = []
    for (let i = 0; i < 22; i++) {
      const bx = (Math.random() - 0.5) * (IW - 0.3)
      const bz = (Math.random() - 0.5) * (IW - 0.3)
      const r  = 0.025 + Math.random() * 0.032
      const bMesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 5, 4),
        new THREE.MeshLambertMaterial({ color: 0xddf4ff, transparent: true, opacity: 0.76 })
      )
      bMesh.position.set(bx, 0.15 + Math.random() * 0.40, bz)
      bMesh.userData = {
        phase:   Math.random() * Math.PI * 2,
        speed:   0.16 + Math.random() * 0.28,
        bottomY: 0.14,
        topY:    0.62,
      }
      bMesh.visible = false
      bMesh.renderOrder = 1
      g.add(bMesh)
      bubbles.push(bMesh)
    }

    g.position.set(wx, baseY, wz)
    g.traverse(m => {
      if (m.isMesh && !bubbles.includes(m)) { m.castShadow = true; m.receiveShadow = true }
    })
    scene.add(g)

    // 5 Sitzpositionen — 4 Seiten (nach innen schauend) + 1 Mitte
    const SD = SB - 0.05   // Sitz-Offset vom Zentrum (etwas näher als SB)
    const seatFacings = [
      { dx:  0.00, dz: -SD, fy: 0 },               // N-Bank → schaut nach Süden (innen)
      { dx:  0.00, dz:  SD, fy: Math.PI },          // S-Bank → schaut nach Norden (innen)
      { dx: -SD,   dz: 0,   fy: -Math.PI / 2 },    // W-Bank → schaut nach Osten (innen)
      { dx:  SD,   dz: 0,   fy: -Math.PI / 2 },    // E-Bank → schaut nach Westen (innen)
      { dx:  0.00, dz: 0,   fy: 0 },               // Mitte
    ]
    for (const s of seatFacings) {
      SEATS.push({ x: wx + s.dx, z: wz + s.dz, facingY: s.fy, level: lvl, jacuzziCenter: { wx, wz } })
    }

    JACUZZI_OBJECTS.push({ wx, wz, bubbles, group: g })
    return g
  })
})()
