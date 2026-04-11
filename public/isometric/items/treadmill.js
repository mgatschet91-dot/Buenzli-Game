// treadmill.js — Laufband (sport)
;(function () {
  ITEM_DEFS.add('treadmill', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const frame  = makeMat(0x222222)  // schwarzer Rahmen
    const belt   = makeMat(0x111111)  // Laufband
    const beltS  = makeMat(0x333333)  // Seiten
    const rail   = makeMat(0x666666)  // Handläufe
    const console= makeMat(0x1a1a2e)  // Bedien-Konsole
    const screen = makeMat(0x001133)  // Display
    const red    = makeMat(0xcc0000)  // Not-Aus

    // Rahmen / Basis
    g.add(box(0.60, 0.14, 1.00, frame, 0, 0.07, 0))
    // Laufband-Fläche
    g.add(box(0.52, 0.06, 0.92, belt,  0, 0.17, 0))
    // Seitenverkleidung links/rechts
    g.add(box(0.06, 0.10, 0.94, beltS, -0.28, 0.12, 0))
    g.add(box(0.06, 0.10, 0.94, beltS,  0.28, 0.12, 0))
    // Handläufe (2 Stangen)
    g.add(box(0.05, 0.96, 0.05, rail, -0.28, 0.64, -0.16))
    g.add(box(0.05, 0.96, 0.05, rail,  0.28, 0.64, -0.16))
    // Querstrebe oben
    g.add(box(0.58, 0.05, 0.05, rail, 0, 1.10, -0.16))
    // Konsole oben
    g.add(box(0.54, 0.28, 0.14, console, 0, 1.00, -0.24))
    // Display
    g.add(box(0.38, 0.18, 0.04, screen,  0, 1.02, -0.31))
    // Not-Aus Knopf
    g.add(box(0.08, 0.08, 0.04, red, 0.20, 1.08, -0.31))
    // Fußstützen vorne / hinten
    g.add(box(0.54, 0.08, 0.06, frame, 0, 0.04, -0.49))
    g.add(box(0.54, 0.08, 0.06, frame, 0, 0.04,  0.49))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
