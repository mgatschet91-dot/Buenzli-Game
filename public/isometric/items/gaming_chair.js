// gaming_chair.js — Gaming-Stuhl (gaming)
;(function () {
  ITEM_DEFS.add('gaming_chair', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const blk  = makeMat(0x0a0a0a)   // Schwarz
    const red  = makeMat(0xdd1111)   // Rot-Akzente
    const gray = makeMat(0x333333)   // Grau
    const met  = makeMat(0x888888)   // Aluminium

    // Sitz
    g.add(box(0.62, 0.10, 0.62, blk, 0, 0.44, 0))
    g.add(box(0.56, 0.06, 0.56, gray,0, 0.48, 0))
    // Seitenbolster Sitz
    g.add(box(0.06, 0.14, 0.56, red, -0.28, 0.50, 0))
    g.add(box(0.06, 0.14, 0.56, red,  0.28, 0.50, 0))
    // Rückenlehne Schale
    g.add(box(0.58, 0.86, 0.10, blk, 0, 0.94, -0.24))
    // Rückenlehne Polster
    g.add(box(0.44, 0.76, 0.06, gray,0, 0.94, -0.22))
    // Seitenbolster Rücken
    g.add(box(0.07, 0.82, 0.12, red, -0.27, 0.94, -0.24))
    g.add(box(0.07, 0.82, 0.12, red,  0.27, 0.94, -0.24))
    // Lordosenstütze (Lendenkissen)
    g.add(box(0.38, 0.18, 0.08, red, 0, 0.68, -0.20))
    // Kopfstütze
    g.add(box(0.42, 0.22, 0.12, blk, 0, 1.42, -0.23))
    g.add(box(0.36, 0.16, 0.08, red, 0, 1.42, -0.21))
    // Armlehnen (4D)
    g.add(box(0.07, 0.06, 0.30, gray, -0.30, 0.56, -0.02))
    g.add(box(0.07, 0.06, 0.30, gray,  0.30, 0.56, -0.02))
    g.add(box(0.08, 0.18, 0.08, blk, -0.30, 0.44, -0.02))
    g.add(box(0.08, 0.18, 0.08, blk,  0.30, 0.44, -0.02))
    // Mittelstange
    g.add(box(0.10, 0.40, 0.10, met, 0, 0.22, 0))
    // Stern-Basis
    g.add(box(0.72, 0.05, 0.10, met, 0, 0.02, 0))
    g.add(box(0.10, 0.05, 0.72, met, 0, 0.02, 0))
    g.add(box(0.54, 0.05, 0.08, met, 0, 0.02, 0.30))
    g.add(box(0.54, 0.05, 0.08, met, 0, 0.02,-0.30))
    // Rollen
    for (const [x, z] of [[-0.34,0],[0.34,0],[0,-0.34],[0,0.34]])
      g.add(box(0.08, 0.06, 0.08, blk, x, 0, z))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
