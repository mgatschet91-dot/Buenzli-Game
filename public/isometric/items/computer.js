// computer.js — Computer / Monitor + PC (buero)
;(function () {
  ITEM_DEFS.add('computer', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const frame  = makeMat(0x222222)
    const screen = makeMat(0x0a1a3a)  // Monitor-Screen dunkelblau
    const glow   = makeMat(0x2244aa)  // Leuchtstreifen
    const silver = makeMat(0x888888)
    const tower  = makeMat(0x333333)
    const light  = makeMat(0x00cc44)  // Power-LED grün

    // Monitor-Rahmen
    g.add(box(0.64, 0.42, 0.06, frame,  0, 1.02, 0.08))
    // Bildschirm
    g.add(box(0.58, 0.36, 0.03, screen, 0, 1.02, 0.10))
    // Screen-Glow (unterer Streifen)
    g.add(box(0.52, 0.03, 0.02, glow,   0, 0.84, 0.11))
    // Monitor-Fuß
    g.add(box(0.08, 0.22, 0.06, silver, 0, 0.80, 0.08))
    // Standfuß
    g.add(box(0.28, 0.04, 0.20, silver, 0, 0.69, 0.08))
    // PC-Tower (rechts)
    g.add(box(0.18, 0.44, 0.30, tower,  0.34, 0.52, -0.04))
    // Tower-Front: Laufwerk-Schlitz
    g.add(box(0.14, 0.03, 0.02, silver, 0.34, 0.62, 0.12))
    // Power-LED
    g.add(box(0.04, 0.04, 0.02, light,  0.34, 0.56, 0.12))
    // Tastatur
    g.add(box(0.50, 0.03, 0.18, makeMat(0x1a1a1a), -0.02, 0.73, 0.20))
    g.add(box(0.46, 0.02, 0.14, makeMat(0x333333), -0.02, 0.75, 0.20))
    // Maus
    g.add(box(0.10, 0.04, 0.14, frame, 0.29, 0.74, 0.18))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
