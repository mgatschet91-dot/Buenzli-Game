// carpet_runner.js — Teppich-Läufer / Flurläufer (teppich)
;(function () {
  ITEM_DEFS.add('carpet_runner', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const c1 = makeMat(0x7b2d2d)   // Weinrot
    const c2 = makeMat(0xc8a060)   // Goldbraun
    const c3 = makeMat(0x3a1010)   // Dunkelrot

    g.add(box(3.00, 0.03, 0.70, c1,  0, 0.01, 0))
    g.add(box(2.80, 0.03, 0.52, c2,  0, 0.02, 0))
    g.add(box(2.60, 0.03, 0.36, c1,  0, 0.03, 0))
    // Längs-Mitte
    g.add(box(2.40, 0.04, 0.08, c3,  0, 0.03, 0))
    // Quer-Markierungen
    for (const dx of [-1.00, -0.50, 0, 0.50, 1.00])
      g.add(box(0.06, 0.04, 0.26, c3, dx, 0.03, 0))
    // Eck-Ornamente
    for (const dx of [-1.30, 1.30]) {
      g.add(box(0.12, 0.04, 0.24, c2, dx, 0.03, 0))
      g.add(box(0.24, 0.04, 0.08, c2, dx, 0.03, 0))
    }
    // Fransen an den kurzen Enden
    for (let i = 0; i < 5; i++) {
      const dz = -0.24 + i * 0.12
      g.add(box(0.06, 0.03, 0.05, c2,  1.54, 0.01, dz))
      g.add(box(0.06, 0.03, 0.05, c2, -1.54, 0.01, dz))
    }

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
