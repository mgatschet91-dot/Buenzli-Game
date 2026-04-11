// sink_kitchen.js — Küchenspüle (kueche)
;(function () {
  ITEM_DEFS.add('sink_kitchen', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body   = makeMat(0xf0ede6)
    const top    = makeMat(0xd4d0c8)  // Edelstahl-Arbeitsplatte
    const basin  = makeMat(0xb8b4ac)  // Becken innen
    const chrome = makeMat(0xcccccc)  // Armatur
    const dark   = makeMat(0x2a2a2a)

    // Korpus
    g.add(box(0.90, 0.76, 0.54, body, 0, 0.38, 0))
    // Edelstahl-Arbeitsplatte
    g.add(box(0.94, 0.04, 0.58, top,  0, 0.77, 0))
    // Sockel
    g.add(box(0.88, 0.08, 0.52, dark, 0, 0.04, 0))
    // Becken (recessed)
    g.add(box(0.54, 0.10, 0.36, basin, 0, 0.72, 0))
    // Becken Boden
    g.add(box(0.50, 0.03, 0.32, makeMat(0x999994), 0, 0.67, 0))
    // Armatur — Hals
    g.add(box(0.04, 0.22, 0.04, chrome,  0.16, 0.88, 0))
    // Armatur — Bogen
    g.add(box(0.20, 0.04, 0.04, chrome,  0.06, 1.10, 0))
    // Armatur — Auslauf
    g.add(box(0.04, 0.08, 0.04, chrome, -0.04, 1.06, 0))
    // Hebel
    g.add(box(0.14, 0.04, 0.04, chrome, 0.16, 1.00, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
