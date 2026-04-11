// wardrobe_big.js — Großer Kleiderschrank (schlafzimmer)
;(function () {
  ITEM_DEFS.add('wardrobe_big', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const wood   = makeMat(0xb08050)  // helles Holz
    const woodD  = makeMat(0x886030)  // Dunkel-Kontur
    const door   = makeMat(0xc09060)
    const handle = makeMat(0xd4af37)  // Gold-Griff
    const mold   = makeMat(0x7a5030)  // Gesims

    // Korpus
    g.add(box(0.92, 1.40, 0.50, wood,  0, 0.70, 0))
    // Gesims oben
    g.add(box(0.96, 0.08, 0.54, mold,  0, 1.42, 0))
    // Sockel unten
    g.add(box(0.90, 0.08, 0.48, mold,  0, 0.04, 0))
    // Linke Tür
    g.add(box(0.42, 1.28, 0.04, door, -0.22, 0.72, 0.26))
    // Rechte Tür
    g.add(box(0.42, 1.28, 0.04, door,  0.22, 0.72, 0.26))
    // Türfuge
    g.add(box(0.02, 1.28, 0.04, woodD, 0, 0.72, 0.26))
    // Tür-Rahmen (Querleisten)
    g.add(box(0.88, 0.04, 0.04, woodD, 0, 0.72, 0.26))
    // Griffe
    g.add(box(0.04, 0.18, 0.05, handle, -0.12, 0.72, 0.29))
    g.add(box(0.04, 0.18, 0.05, handle,  0.12, 0.72, 0.29))
    // Spiegel auf linker Tür
    g.add(box(0.36, 0.72, 0.02, makeMat(0xd8e8f0), -0.22, 0.86, 0.28))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
