// aquarium.js — Aquarium (deko)
;(function () {
  ITEM_DEFS.add('aquarium', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const cabinet= makeMat(0x2a2a2a)  // schwarzes Unterschrank
    const glass  = makeMat(0x224488)  // Glas blau
    const water  = makeMat(0x1144aa)  // Wasser
    const sand   = makeMat(0xd4b870)  // Sand
    const coral1 = makeMat(0xff6644)  // Koralle orange
    const coral2 = makeMat(0xcc2266)  // Koralle pink
    const plant  = makeMat(0x228844)  // Wasserpflanzen
    const lid    = makeMat(0x333333)  // Deckel

    // Unterschrank
    g.add(box(0.82, 0.44, 0.44, cabinet, 0, 0.22, 0))
    // Schrank-Tür
    g.add(box(0.76, 0.38, 0.04, makeMat(0x3a3a3a), 0, 0.22, 0.23))
    // Tank-Außenwand (Glas blau)
    g.add(box(0.82, 0.48, 0.44, glass,  0, 0.68, 0))
    // Wasser-Füllung (innerhalb)
    g.add(box(0.74, 0.42, 0.36, water,  0, 0.68, 0))
    // Sand-Boden
    g.add(box(0.74, 0.04, 0.36, sand,   0, 0.46, 0))
    // Korallen + Pflanzen
    g.add(box(0.06, 0.20, 0.06, coral1, -0.24, 0.56, 0))
    g.add(box(0.06, 0.14, 0.06, coral2,  0.20, 0.52, -0.04))
    g.add(box(0.05, 0.26, 0.05, plant,  -0.08, 0.58, 0.08))
    g.add(box(0.05, 0.20, 0.05, plant,   0.10, 0.56, -0.08))
    // Fische (kleine farbige Klötzchen)
    g.add(box(0.08, 0.05, 0.05, makeMat(0xff8800), -0.10, 0.72, 0.04))
    g.add(box(0.06, 0.04, 0.04, makeMat(0xffffff),  0.14, 0.68,-0.06))
    // Deckel
    g.add(box(0.84, 0.04, 0.46, lid, 0, 0.94, 0))
    // Lampenlicht oben
    g.add(box(0.60, 0.04, 0.08, makeMat(0xaaddff), 0, 0.96, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
