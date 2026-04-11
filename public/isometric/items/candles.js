// candles.js — Kerzenständer (deko)
;(function () {
  ITEM_DEFS.add('candles', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const gold   = makeMat(0xd4af37)
    const wax    = makeMat(0xfafafa)   // Kerzenwachs weiß
    const waxR   = makeMat(0xffd0d0)  // Kerze rosa
    const flame  = makeMat(0xff8800)
    const wick   = makeMat(0x111111)

    // Basis-Tablett
    g.add(box(0.56, 0.04, 0.30, gold, 0, 0.02, 0))

    // Kerze 1 — groß links
    g.add(box(0.10, 0.36, 0.10, wax,  -0.18, 0.22, -0.04))
    g.add(box(0.03, 0.06, 0.03, wick, -0.18, 0.42, -0.04))
    g.add(box(0.06, 0.10, 0.06, flame,-0.18, 0.50, -0.04))

    // Kerze 2 — mittel mitte
    g.add(box(0.08, 0.24, 0.08, waxR,  0.02, 0.16, 0.02))
    g.add(box(0.03, 0.05, 0.03, wick,  0.02, 0.32, 0.02))
    g.add(box(0.05, 0.08, 0.05, flame, 0.02, 0.38, 0.02))

    // Kerze 3 — klein rechts hoch
    g.add(box(0.08, 0.42, 0.08, wax,   0.20, 0.25, -0.02))
    g.add(box(0.03, 0.06, 0.03, wick,  0.20, 0.49, -0.02))
    g.add(box(0.05, 0.09, 0.05, flame, 0.20, 0.56, -0.02))

    // Kerze 4 — klein vorne
    g.add(box(0.07, 0.16, 0.07, waxR, -0.06, 0.12, 0.08))
    g.add(box(0.03, 0.04, 0.03, wick, -0.06, 0.24, 0.08))
    g.add(box(0.05, 0.07, 0.05, flame,-0.06, 0.29, 0.08))

    // Kerzenhalter-Ringe (gold)
    g.add(box(0.14, 0.04, 0.14, gold, -0.18, 0.06, -0.04))
    g.add(box(0.12, 0.04, 0.12, gold,  0.02, 0.06,  0.02))
    g.add(box(0.12, 0.04, 0.12, gold,  0.20, 0.06, -0.02))
    g.add(box(0.10, 0.04, 0.10, gold, -0.06, 0.06,  0.08))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
