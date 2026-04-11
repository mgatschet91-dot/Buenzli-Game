// mirror_stand.js — Standspiegel (schlafzimmer)
;(function () {
  ITEM_DEFS.add('mirror_stand', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const frame   = makeMat(0xd4af37)  // Gold-Rahmen
    const mirror  = makeMat(0xd8eef8)  // Spiegel-Reflex
    const stand   = makeMat(0xb8941c)  // Ständer dunkel-gold
    const foot    = makeMat(0x8b7010)

    // Rahmen außen
    g.add(box(0.44, 1.14, 0.06, frame, 0, 0.84, 0))
    // Spiegelfläche
    g.add(box(0.36, 1.06, 0.03, mirror, 0, 0.84, 0.02))
    // Rahmen — oberer Bogen-Abschluss (simuliert)
    g.add(box(0.44, 0.06, 0.08, frame, 0, 1.44, 0))
    // Ständerstange (hinten unten)
    g.add(box(0.06, 0.28, 0.06, stand, 0, 0.22, -0.08))
    // Fuß links + rechts
    g.add(box(0.04, 0.04, 0.44, foot, -0.16, 0.06, -0.06))
    g.add(box(0.04, 0.04, 0.44, foot,  0.16, 0.06, -0.06))
    // Querstrebe Fuß
    g.add(box(0.34, 0.04, 0.06, foot, 0, 0.06, 0.12))
    // Scharnier-Knöpfe
    g.add(box(0.06, 0.06, 0.08, frame, -0.19, 0.28, 0.02))
    g.add(box(0.06, 0.06, 0.08, frame,  0.19, 0.28, 0.02))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
