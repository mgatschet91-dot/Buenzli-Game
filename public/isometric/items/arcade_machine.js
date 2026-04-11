// arcade_machine.js — Arcade-Automat (gaming)
;(function () {
  ITEM_DEFS.add('arcade_machine', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body   = makeMat(0x1a1a6a)  // Dunkelblau
    const panel  = makeMat(0x111144)  // Bedienfeld
    const screen = makeMat(0x002244)  // Monitor
    const glow   = makeMat(0x44aaff)  // Bildschirm-Glow
    const marquee= makeMat(0xffd700)  // Leuchtschild gold
    const btn1   = makeMat(0xff2222)  // Knopf rot
    const btn2   = makeMat(0x2222ff)  // Knopf blau
    const stick  = makeMat(0x222222)  // Joystick
    const bezel  = makeMat(0x000011)  // Bildschirm-Blende

    // Korpus unten
    g.add(box(0.60, 0.72, 0.42, body,   0, 0.36, 0))
    // Korpus oben (schräg simuliert mit box)
    g.add(box(0.60, 0.56, 0.38, body,   0, 1.00, 0))
    // Rückseite obere Box
    g.add(box(0.60, 0.32, 0.10, body,   0, 1.38, -0.14))
    // Marquee (Leuchtreklame)
    g.add(box(0.60, 0.18, 0.06, marquee,0, 1.54, 0.02))
    g.add(box(0.54, 0.12, 0.04, makeMat(0xffa500), 0, 1.54, 0.05))
    // Monitor-Blende
    g.add(box(0.52, 0.38, 0.06, bezel,  0, 1.06, 0.22))
    // Bildschirm
    g.add(box(0.46, 0.32, 0.04, screen, 0, 1.06, 0.24))
    // Screen-Glow
    g.add(box(0.40, 0.26, 0.02, glow,   0, 1.06, 0.25))
    // Bedien-Panel (angewinkelt)
    g.add(box(0.56, 0.04, 0.36, panel,  0, 0.80, 0.10))
    // Joystick
    g.add(box(0.06, 0.14, 0.06, stick, -0.12, 0.86, 0.02))
    g.add(box(0.10, 0.06, 0.10, makeMat(0x111111), -0.12, 0.96, 0.02))
    // Knöpfe
    g.add(box(0.08, 0.06, 0.08, btn1,  0.10, 0.84, -0.02))
    g.add(box(0.08, 0.06, 0.08, btn2,  0.22, 0.84, -0.02))
    g.add(box(0.08, 0.06, 0.08, btn1,  0.10, 0.84,  0.10))
    g.add(box(0.08, 0.06, 0.08, btn2,  0.22, 0.84,  0.10))
    // Münzeinwurf
    g.add(box(0.12, 0.04, 0.08, makeMat(0x888888), 0, 0.66, 0.22))
    // Füßchen
    for (const [x, z] of [[-0.24, -0.16], [0.24, -0.16], [-0.24, 0.16], [0.24, 0.16]])
      g.add(box(0.08, 0.08, 0.08, makeMat(0x111111), x, 0.04, z))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
