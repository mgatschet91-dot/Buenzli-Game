// carpet_square.js — Quadratischer Teppich (teppich)
;(function () {
  ITEM_DEFS.add('carpet_square', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const c1 = makeMat(0x1a4a7a)
    const c2 = makeMat(0xf0f0f0)
    const c3 = makeMat(0x4a9fd4)
    const c4 = makeMat(0xffd700)

    g.add(box(2.00, 0.03, 2.00, c1, 0, 0.01, 0))
    g.add(box(1.74, 0.03, 1.74, c2, 0, 0.02, 0))
    g.add(box(1.48, 0.03, 1.48, c1, 0, 0.03, 0))
    // Kreuz
    g.add(box(1.30, 0.04, 0.10, c3, 0, 0.03, 0))
    g.add(box(0.10, 0.04, 1.30, c3, 0, 0.03, 0))
    // Eck-Quadrate
    for (const [dx, dz] of [[-0.55,-0.55],[0.55,-0.55],[-0.55,0.55],[0.55,0.55]]) {
      g.add(box(0.28, 0.04, 0.28, c3, dx, 0.03, dz))
      g.add(box(0.12, 0.05, 0.12, c2, dx, 0.03, dz))
    }
    // Zentrum
    g.add(box(0.14, 0.05, 0.14, c4, 0, 0.04, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
