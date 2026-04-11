// carpet_rounded.js — Abgerundeter Teppich (teppich)
;(function () {
  ITEM_DEFS.add('carpet_rounded', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const c1 = makeMat(0x1a6b1a)
    const c2 = makeMat(0x4abf4a)
    const c3 = makeMat(0xffd700)
    const c4 = makeMat(0xffffff)

    g.add(box(2.00, 0.03, 1.40, c1, 0, 0.01, 0))
    g.add(box(1.80, 0.03, 1.20, c2, 0, 0.02, 0))
    g.add(box(1.60, 0.03, 1.00, c1, 0, 0.03, 0))
    // Blumen-Muster
    g.add(box(1.20, 0.04, 0.10, c3, 0, 0.03, 0))
    g.add(box(0.10, 0.04, 0.80, c3, 0, 0.03, 0))
    for (const [dx, dz] of [[-0.40,-0.25],[0.40,-0.25],[-0.40,0.25],[0.40,0.25]]) {
      g.add(box(0.22, 0.04, 0.12, c2, dx, 0.03, dz))
      g.add(box(0.12, 0.04, 0.22, c2, dx, 0.03, dz))
    }
    g.add(box(0.12, 0.05, 0.12, c3, 0, 0.04, 0))
    g.add(box(0.06, 0.06, 0.06, c4, 0, 0.04, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
