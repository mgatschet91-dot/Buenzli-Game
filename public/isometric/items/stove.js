// stove.js — Herd / Kochfeld (kueche)
;(function () {
  ITEM_DEFS.add('stove', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body    = makeMat(0x1a1a1a)  // schwarzer Herd
    const surface = makeMat(0x111111)  // Kochfläche
    const burner  = makeMat(0x333333)  // Kochplatten
    const hot     = makeMat(0xcc4400)  // heißer Rost
    const knob    = makeMat(0x888888)  // Drehknöpfe
    const chrome  = makeMat(0xaaaaaa)

    // Korpus
    g.add(box(0.88, 0.78, 0.56, body,    0, 0.39, 0))
    // Kochfläche
    g.add(box(0.86, 0.04, 0.54, surface, 0, 0.80, 0))
    // 4 Kochplatten
    g.add(box(0.24, 0.03, 0.24, burner, -0.24, 0.82, -0.10))
    g.add(box(0.24, 0.03, 0.24, burner,  0.24, 0.82, -0.10))
    g.add(box(0.20, 0.03, 0.20, burner, -0.24, 0.82,  0.16))
    g.add(box(0.20, 0.03, 0.20, burner,  0.24, 0.82,  0.16))
    // Rost-Streifen
    for (let i = -1; i <= 1; i++) {
      g.add(box(0.80, 0.02, 0.03, hot, 0, 0.84, i * 0.10))
    }
    // Rückwand / Spritzschutz
    g.add(box(0.88, 0.26, 0.04, body,   0, 0.96, -0.26))
    // Drehknöpfe (Frontleiste)
    for (let i = -2; i <= 2; i++) {
      g.add(box(0.07, 0.07, 0.06, knob, i * 0.17, 0.62, 0.29))
    }
    // Griff Backofentür
    g.add(box(0.60, 0.04, 0.05, chrome, 0, 0.28, 0.29))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
