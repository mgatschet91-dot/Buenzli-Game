// carpet_doormat.js — Fußmatte (teppich)
;(function () {
  ITEM_DEFS.add('carpet_doormat', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const c1 = makeMat(0x4a3010)
    const c2 = makeMat(0x8b6914)
    const c3 = makeMat(0xd4a857)

    g.add(box(1.00, 0.04, 0.60, c1, 0, 0.01, 0))
    // Kokos-Streifen
    for (let i = 0; i < 5; i++) {
      const dx = -0.36 + i * 0.18
      g.add(box(0.10, 0.04, 0.48, (i % 2 === 0 ? c2 : c3), dx, 0.02, 0))
    }
    // Rahmen
    g.add(box(0.96, 0.03, 0.06, c1, 0, 0.02,  0.29))
    g.add(box(0.96, 0.03, 0.06, c1, 0, 0.02, -0.29))
    g.add(box(0.06, 0.03, 0.56, c1,  0.49, 0.02, 0))
    g.add(box(0.06, 0.03, 0.56, c1, -0.49, 0.02, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
