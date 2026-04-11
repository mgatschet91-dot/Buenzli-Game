// vanity_table.js — Schminktisch (schlafzimmer)
;(function () {
  ITEM_DEFS.add('vanity_table', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const wood   = makeMat(0xc8a87a)
    const woodD  = makeMat(0xa08050)
    const mirror = makeMat(0xd8eef8)
    const frame  = makeMat(0xd4af37)
    const handle = makeMat(0xd4af37)
    const bulb   = makeMat(0xffee88)  // Glühbirnen

    // Tischplatte
    g.add(box(0.82, 0.05, 0.48, woodD, 0, 0.72, 0))
    // Linker Schublade-Block
    g.add(box(0.22, 0.68, 0.44, wood, -0.28, 0.38, 0))
    // Rechter Schublade-Block
    g.add(box(0.22, 0.68, 0.44, wood,  0.28, 0.38, 0))
    // Schubladenfronten
    for (const [bx, y] of [[-0.28, 0.56], [-0.28, 0.36], [0.28, 0.56], [0.28, 0.36]])
      g.add(box(0.18, 0.18, 0.04, woodD, bx, y, 0.23))
    // Griffe
    for (const [bx, y] of [[-0.28, 0.56], [-0.28, 0.36], [0.28, 0.56], [0.28, 0.36]])
      g.add(box(0.10, 0.03, 0.03, handle, bx, y, 0.26))
    // Mittelteil Hohlraum (Sitz-Nische) — nur Boden
    g.add(box(0.34, 0.04, 0.44, woodD, 0, 0.06, 0))
    // Spiegel-Rahmen
    g.add(box(0.64, 0.72, 0.05, frame, 0, 1.12, 0))
    // Spiegel
    g.add(box(0.58, 0.66, 0.03, mirror, 0, 1.12, 0.02))
    // Glühbirnen (Schminkspiegel-Licht)
    for (let i = -3; i <= 3; i++)
      g.add(box(0.06, 0.06, 0.05, bulb, i * 0.09, 1.48, 0.04))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
