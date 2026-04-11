// counter_kitchen.js — Küchenblock (kueche)
;(function () {
  ITEM_DEFS.add('counter_kitchen', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body  = makeMat(0xf0ede6)  // weißer Schrank
    const top   = makeMat(0x4a4a4a)  // dunkle Arbeitsfläche
    const door  = makeMat(0xe8e4dc)  // Türen leicht heller
    const handle= makeMat(0xb8a898)  // gebürstetes Metall
    const dark  = makeMat(0x2a2a2a)  // Sockel / Schatten

    // Korpus
    g.add(box(0.90, 0.76, 0.54, body,  0, 0.38, 0))
    // Arbeitsfläche
    g.add(box(0.94, 0.05, 0.58, top,   0, 0.77, 0))
    // Sockelleiste
    g.add(box(0.88, 0.08, 0.52, dark,  0, 0.04, 0))
    // Linke Tür
    g.add(box(0.40, 0.62, 0.03, door, -0.22, 0.40, 0.27))
    // Rechte Tür
    g.add(box(0.40, 0.62, 0.03, door,  0.22, 0.40, 0.27))
    // Türspalt (dunkle Linie)
    g.add(box(0.02, 0.62, 0.03, dark,  0,    0.40, 0.27))
    // Griffe
    g.add(box(0.18, 0.03, 0.04, handle, -0.22, 0.52, 0.29))
    g.add(box(0.18, 0.03, 0.04, handle,  0.22, 0.52, 0.29))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
