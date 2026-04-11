// chair_office.js — Bürostuhl (buero)
;(function () {
  ITEM_DEFS.add('chair_office', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const blk  = makeMat(0x111111)
    const mesh  = makeMat(0x222233)  // Rückenlehnen-Netz
    const red   = makeMat(0xcc1111)  // Akzentfarbe
    const met   = makeMat(0x999999)

    // Sitz
    g.add(box(0.58, 0.08, 0.58, blk,  0, 0.46, 0))
    g.add(box(0.52, 0.06, 0.52, makeMat(0x222222), 0, 0.50, 0))
    // Rückenlehne — Schale
    g.add(box(0.54, 0.68, 0.08, blk,  0, 0.88, -0.24))
    // Rückenlehne — seitliche Bolster (rot)
    g.add(box(0.07, 0.64, 0.09, red, -0.25, 0.88, -0.24))
    g.add(box(0.07, 0.64, 0.09, red,  0.25, 0.88, -0.24))
    // Netzgewebe Mitte
    g.add(box(0.38, 0.56, 0.04, mesh, 0, 0.88, -0.22))
    // Kopfstütze
    g.add(box(0.40, 0.18, 0.10, blk,  0, 1.26, -0.24))
    // Armlehnen
    g.add(box(0.06, 0.04, 0.34, blk, -0.28, 0.56, -0.04))
    g.add(box(0.06, 0.04, 0.34, blk,  0.28, 0.56, -0.04))
    // Mittelstange
    g.add(box(0.08, 0.40, 0.08, met, 0, 0.22, 0))
    // Stern-Basis (5 Arme als Kreuz)
    g.add(box(0.72, 0.04, 0.08, met, 0, 0.02, 0))
    g.add(box(0.08, 0.04, 0.72, met, 0, 0.02, 0))
    g.add(box(0.52, 0.04, 0.07, met, 0, 0.02,  0.30))
    g.add(box(0.52, 0.04, 0.07, met, 0, 0.02, -0.30))
    // Rollen (5)
    for (const [x, z] of [[-0.34,0],[0.34,0],[0,-0.34],[0,0.34]])
      g.add(box(0.08, 0.06, 0.08, blk, x, 0, z))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
