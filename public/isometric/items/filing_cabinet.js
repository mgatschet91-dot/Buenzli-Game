// filing_cabinet.js — Aktenschrank (buero)
;(function () {
  ITEM_DEFS.add('filing_cabinet', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body   = makeMat(0x778888)  // stahlgrau
    const drawer = makeMat(0x8899aa)
    const handle = makeMat(0xbbbbbb)
    const dark   = makeMat(0x445555)

    // Korpus
    g.add(box(0.50, 0.90, 0.50, body, 0, 0.45, 0))
    // Deckel
    g.add(box(0.52, 0.04, 0.52, dark, 0, 0.92, 0))
    // 3 Schubladen-Fronten
    for (let i = 0; i < 3; i++) {
      const y = 0.76 - i * 0.28
      g.add(box(0.44, 0.24, 0.04, drawer, 0, y, 0.26))
      // Griff
      g.add(box(0.22, 0.04, 0.04, handle, 0, y + 0.04, 0.29))
      // Etikettenrahmen
      g.add(box(0.20, 0.06, 0.02, makeMat(0xeeeedd), 0, y - 0.06, 0.28))
    }
    // Füßchen
    for (const [x, z] of [[-0.20, -0.20], [0.20, -0.20], [-0.20, 0.20], [0.20, 0.20]])
      g.add(box(0.06, 0.06, 0.06, dark, x, 0.03, z))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
