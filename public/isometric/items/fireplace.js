// fireplace.js — Kamin (deko)
;(function () {
  ITEM_DEFS.add('fireplace', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const stone  = makeMat(0x999088)  // Stein
    const stoneD = makeMat(0x776655)  // dunkler Stein
    const mantel = makeMat(0x887766)  // Kaminsims
    const opening= makeMat(0x111111)  // Brennkammer dunkel
    const brick  = makeMat(0x884422)  // Ziegel innen
    const fire1  = makeMat(0xff6600)  // Flamme Orange
    const fire2  = makeMat(0xffcc00)  // Flamme Gelb
    const ember  = makeMat(0xff2200)  // Glut

    // Rückwand / Corpus
    g.add(box(0.96, 1.02, 0.42, stone,  0, 0.51, 0))
    // Seitenteile (Vorderkante dunkler)
    g.add(box(0.16, 0.72, 0.46, stoneD, -0.40, 0.52, 0.02))
    g.add(box(0.16, 0.72, 0.46, stoneD,  0.40, 0.52, 0.02))
    // Brennkammer öffnung (dunkel)
    g.add(box(0.58, 0.58, 0.30, opening, 0, 0.42, 0.10))
    // Innenwand (Ziegelrot)
    g.add(box(0.54, 0.52, 0.04, brick, 0, 0.42, -0.05))
    // Holzscheite
    g.add(box(0.44, 0.06, 0.10, makeMat(0x5c3a1e), 0, 0.18, 0.14))
    g.add(box(0.36, 0.06, 0.08, makeMat(0x4a2e10), 0, 0.22, 0.18))
    // Glut
    g.add(box(0.40, 0.04, 0.10, ember, 0, 0.17, 0.14))
    // Flammen
    g.add(box(0.12, 0.22, 0.08, fire1, -0.10, 0.32, 0.12))
    g.add(box(0.10, 0.30, 0.08, fire2,  0.00, 0.36, 0.12))
    g.add(box(0.10, 0.18, 0.08, fire1,  0.12, 0.30, 0.12))
    // Kaminsims (Mantel)
    g.add(box(1.02, 0.08, 0.52, mantel, 0, 1.04, 0))
    // Dekoration auf Sims
    g.add(box(0.06, 0.16, 0.06, makeMat(0xfafafa),  0.34, 1.10, 0.04))  // Vase
    g.add(box(0.06, 0.16, 0.06, makeMat(0xfafafa), -0.34, 1.10, 0.04))
    g.add(box(0.14, 0.08, 0.12, makeMat(0x886633),   0, 1.10, 0.04))   // Uhr

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
