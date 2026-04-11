// microwave.js — Mikrowelle (kueche)
;(function () {
  ITEM_DEFS.add('microwave', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body   = makeMat(0x555555)  // Edelstahl-grau
    const door   = makeMat(0x333333)  // Tür dunkel
    const screen = makeMat(0x001122)  // Sichtfenster
    const panel  = makeMat(0x222222)  // Bedienfeld
    const btn    = makeMat(0x888888)

    // Korpus
    g.add(box(0.66, 0.38, 0.44, body,   0, 0.19, 0))
    // Tür (linke 2/3)
    g.add(box(0.44, 0.32, 0.04, door,  -0.10, 0.19, 0.23))
    // Sichtfenster
    g.add(box(0.36, 0.24, 0.03, screen,-0.10, 0.19, 0.24))
    // Bedienfeld (rechte 1/3)
    g.add(box(0.16, 0.34, 0.04, panel,  0.24, 0.19, 0.23))
    // Knöpfe
    g.add(box(0.08, 0.08, 0.03, btn,    0.24, 0.26, 0.25))
    g.add(box(0.10, 0.10, 0.03, makeMat(0x666666), 0.24, 0.12, 0.25))
    // Türgriff
    g.add(box(0.04, 0.26, 0.04, makeMat(0xaaaaaa),  0.14, 0.19, 0.26))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
