// carpet_round.js — Runder Teppich (deko)
;(function () {
  ITEM_DEFS.add('carpet_round', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const c1 = makeMat(0x8833aa)  // Lila
    const c2 = makeMat(0xcc55cc)  // Helles Lila
    const c3 = makeMat(0xffd700)  // Gold
    const c4 = makeMat(0xff8844)  // Orange
    const c5 = makeMat(0xfafafa)  // Weiß

    // Außenring
    g.add(box(0.90, 0.03, 0.90, c1,  0, 0.01, 0))
    // Mittelring
    g.add(box(0.68, 0.04, 0.68, c2,  0, 0.01, 0))
    // Muster-Kreuz gold
    g.add(box(0.48, 0.04, 0.10, c3,  0, 0.02, 0))
    g.add(box(0.10, 0.04, 0.48, c3,  0, 0.02, 0))
    // Diagonalen orange
    g.add(box(0.32, 0.04, 0.07, c4,  0.14, 0.03,  0.14))
    g.add(box(0.32, 0.04, 0.07, c4, -0.14, 0.03,  0.14))
    g.add(box(0.32, 0.04, 0.07, c4,  0.14, 0.03, -0.14))
    g.add(box(0.32, 0.04, 0.07, c4, -0.14, 0.03, -0.14))
    // Zentrum
    g.add(box(0.18, 0.05, 0.18, c5,  0, 0.02, 0))
    g.add(box(0.08, 0.06, 0.08, c3,  0, 0.02, 0))
    // Fransenkante (kleine Streifen am Rand)
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const rx = Math.cos(a) * 0.46
      const rz = Math.sin(a) * 0.46
      g.add(box(0.06, 0.04, 0.06, c3, rx, 0.01, rz))
    }

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
