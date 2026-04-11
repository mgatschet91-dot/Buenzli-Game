// carpet_rectangle.js — Rechteckiger Teppich (teppich)
;(function () {
  ITEM_DEFS.add('carpet_rectangle', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const base   = makeMat(0xb22222)
    const inner  = makeMat(0xf5deb3)
    const border = makeMat(0x8b1a1a)
    const gold   = makeMat(0xffd700)

    g.add(box(2.00, 0.03, 1.40, base,   0, 0.01, 0))
    g.add(box(1.74, 0.03, 1.14, inner,  0, 0.02, 0))
    g.add(box(1.50, 0.03, 0.90, base,   0, 0.03, 0))
    // Längsstreifen
    for (const dx of [-0.55, 0, 0.55])
      g.add(box(0.06, 0.04, 0.80, border, dx, 0.03, 0))
    // Querstreifen
    for (const dz of [-0.32, 0, 0.32])
      g.add(box(1.40, 0.04, 0.06, border, 0, 0.03, dz))
    // Eck-Akzente
    for (const [dx, dz] of [[-0.62,-0.50],[0.62,-0.50],[-0.62,0.50],[0.62,0.50]])
      g.add(box(0.10, 0.04, 0.10, gold, dx, 0.03, dz))
    // Fransen
    for (let i = 0; i < 9; i++) {
      const dx = -0.72 + i * 0.18
      g.add(box(0.05, 0.03, 0.06, inner, dx, 0.01,  0.72))
      g.add(box(0.05, 0.03, 0.06, inner, dx, 0.01, -0.72))
    }

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
