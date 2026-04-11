// carpet_bath.js — Badematte (teppich)
;(function () {
  ITEM_DEFS.add('carpet_bath', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const c1 = makeMat(0x4a90c4)   // Hellblau
    const c2 = makeMat(0x7ab8e0)   // Mittelblau
    const c3 = makeMat(0xffffff)   // Weiß

    // Weiche Matte (etwas dicker für fluffigen Look)
    g.add(box(1.00, 0.06, 0.60, c1, 0, 0.01, 0))
    // Flauschige Streifen (heller)
    for (let i = 0; i < 4; i++) {
      const dz = -0.20 + i * 0.14
      g.add(box(0.92, 0.07, 0.06, c2, 0, 0.02, dz))
    }
    // Weiße Rand-Borte
    g.add(box(0.96, 0.05, 0.04, c3, 0, 0.04,  0.30))
    g.add(box(0.96, 0.05, 0.04, c3, 0, 0.04, -0.30))
    // Kleine Noppen (Textur-Effekt)
    for (let xi = 0; xi < 5; xi++)
      for (let zi = 0; zi < 3; zi++)
        g.add(box(0.06, 0.08, 0.06, c2, -0.32 + xi * 0.16, 0.04, -0.14 + zi * 0.14))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
