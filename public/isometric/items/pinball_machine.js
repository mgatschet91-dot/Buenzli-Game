// pinball_machine.js — Flipperautomat (gaming)
;(function () {
  ITEM_DEFS.add('pinball_machine', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const cab    = makeMat(0x222266)  // Kabinett-Farbe
    const felt   = makeMat(0x115533)  // Spielfeld grün
    const glass  = makeMat(0x334466)  // Glasscheibe
    const back   = makeMat(0xcc2222)  // Backglass rot
    const backG  = makeMat(0xffcc00)  // Backglass gold
    const leg    = makeMat(0x888888)
    const plunger= makeMat(0xaaaaaa)

    // Kabinett-Seiten (L+R)
    g.add(box(0.08, 0.78, 0.76, cab, -0.32, 0.39, 0))
    g.add(box(0.08, 0.78, 0.76, cab,  0.32, 0.39, 0))
    // Spielfeld-Fläche (schräg, simuliert mit zwei Boxen)
    g.add(box(0.58, 0.06, 0.70, felt, 0, 0.68, 0))
    // Glasabdeckung
    g.add(box(0.58, 0.04, 0.72, glass, 0, 0.72, 0))
    // Front-Box (Münzeinwurf etc)
    g.add(box(0.66, 0.24, 0.08, cab, 0, 0.12, 0.38))
    g.add(box(0.16, 0.06, 0.05, makeMat(0x111111), 0, 0.12, 0.42))
    // Rücken-Glass (Backglass, vertikal oben)
    g.add(box(0.68, 0.62, 0.08, back, 0, 1.10, -0.34))
    g.add(box(0.60, 0.50, 0.04, backG, 0, 1.10, -0.31))
    // Flipper-Hebel (L+R vorne)
    g.add(box(0.16, 0.04, 0.06, leg, -0.14, 0.76,  0.28))
    g.add(box(0.16, 0.04, 0.06, leg,  0.14, 0.76,  0.28))
    // Bumper (runde Hindernisse, als Boxen)
    g.add(box(0.10, 0.12, 0.10, makeMat(0xff4400), -0.10, 0.74, -0.08))
    g.add(box(0.10, 0.12, 0.10, makeMat(0x4422ff),  0.10, 0.74,  0.06))
    g.add(box(0.10, 0.12, 0.10, makeMat(0x22cc44),  0.00, 0.74, -0.18))
    // Plunger (Abschuss)
    g.add(box(0.04, 0.28, 0.04, plunger, 0.26, 0.56, 0.28))
    // Beine
    for (const [x, z] of [[-0.26, -0.34], [0.26, -0.34], [-0.26, 0.34], [0.26, 0.34]])
      g.add(box(0.06, 0.20, 0.06, leg, x, 0.10, z))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
