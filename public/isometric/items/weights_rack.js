// weights_rack.js — Hantelregal (sport)
;(function () {
  ITEM_DEFS.add('weights_rack', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const frame = makeMat(0x333333)  // Rahmen schwarz
    const bar   = makeMat(0x888888)  // Hantelstange
    const w1    = makeMat(0xcc2222)  // 5kg rot
    const w2    = makeMat(0x2244cc)  // 10kg blau
    const w3    = makeMat(0x228844)  // 15kg grün
    const w4    = makeMat(0xffaa00)  // 20kg orange

    // Rahmen — 2 Seitenteile
    g.add(box(0.06, 0.86, 0.48, frame, -0.40, 0.43, 0))
    g.add(box(0.06, 0.86, 0.48, frame,  0.40, 0.43, 0))
    // Querstreben (3 Ebenen)
    g.add(box(0.78, 0.06, 0.06, frame, 0, 0.78, -0.18))
    g.add(box(0.78, 0.06, 0.06, frame, 0, 0.52, -0.18))
    g.add(box(0.78, 0.06, 0.06, frame, 0, 0.26, -0.18))
    // Boden-Querstreben
    g.add(box(0.78, 0.06, 0.06, frame, 0, 0.04, -0.18))
    g.add(box(0.78, 0.06, 0.06, frame, 0, 0.04,  0.18))

    // Hanteln auf den Ebenen
    // Ebene 1 (oben) — 2x 5kg (rot, dünn)
    g.add(box(0.30, 0.10, 0.10, w1, -0.18, 0.86, 0))
    g.add(box(0.04, 0.10, 0.10, bar, -0.04, 0.86, 0))
    g.add(box(0.30, 0.10, 0.10, w1,  0.18, 0.86, 0))
    // Ebene 2 (mitte) — 2x 10kg (blau)
    g.add(box(0.28, 0.14, 0.14, w2, -0.18, 0.60, 0))
    g.add(box(0.04, 0.14, 0.14, bar, -0.04, 0.60, 0))
    g.add(box(0.28, 0.14, 0.14, w2,  0.18, 0.60, 0))
    // Ebene 3 (unten) — 20kg (orange, dicker)
    g.add(box(0.26, 0.18, 0.18, w4, -0.18, 0.33, 0))
    g.add(box(0.04, 0.18, 0.18, bar, -0.04, 0.33, 0))
    g.add(box(0.26, 0.18, 0.18, w4,  0.18, 0.33, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
