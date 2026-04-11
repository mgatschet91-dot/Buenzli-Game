// pool_table.js — Billardtisch (gaming)
;(function () {
  ITEM_DEFS.add('pool_table', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const felt  = makeMat(0x1a6b35)  // grüner Filz
    const rail  = makeMat(0x5c3a1e)  // Bande holz
    const leg   = makeMat(0x3a2010)  // Beine dunkles Holz
    const pocket= makeMat(0x111111)  // Taschen
    const ball  = makeMat(0xfafafa)  // weiße Kugel
    const cue   = makeMat(0xd4b870)  // Queue Holz

    // Spielfläche
    g.add(box(0.90, 0.06, 0.58, felt, 0, 0.74, 0))
    // Bande (Rahmen)
    g.add(box(0.96, 0.10, 0.08, rail, 0, 0.75,  0.31))
    g.add(box(0.96, 0.10, 0.08, rail, 0, 0.75, -0.31))
    g.add(box(0.08, 0.10, 0.58, rail, -0.47, 0.75, 0))
    g.add(box(0.08, 0.10, 0.58, rail,  0.47, 0.75, 0))
    // Taschen (6 Stück: 4 Ecken + 2 Mittel)
    for (const [x, z] of [[-0.44, -0.28], [0, -0.28], [0.44, -0.28],
                           [-0.44,  0.28], [0,  0.28], [0.44,  0.28]])
      g.add(box(0.10, 0.10, 0.10, pocket, x, 0.73, z))
    // Tisch-Korpus
    g.add(box(0.90, 0.16, 0.58, makeMat(0x4a2e10), 0, 0.60, 0))
    // 4 Beine
    for (const [x, z] of [[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]])
      g.add(box(0.10, 0.56, 0.10, leg, x, 0.28, z))
    // Querverstrebungen
    g.add(box(0.76, 0.06, 0.06, leg, 0, 0.16, -0.20))
    g.add(box(0.76, 0.06, 0.06, leg, 0, 0.16,  0.20))
    // Kugeln auf dem Tisch
    g.add(box(0.07, 0.07, 0.07, ball,         -0.10, 0.80, -0.06))
    g.add(box(0.07, 0.07, 0.07, makeMat(0xffcc00),  0.08, 0.80, 0.02))
    g.add(box(0.07, 0.07, 0.07, makeMat(0xff2200), -0.04, 0.80, 0.10))
    // Queue (Billardstock, diagonal)
    g.add(box(0.04, 0.04, 0.80, cue, 0.22, 0.84, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
