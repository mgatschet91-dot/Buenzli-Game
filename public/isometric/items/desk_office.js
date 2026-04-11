// desk_office.js — Schreibtisch (buero)
;(function () {
  ITEM_DEFS.add('desk_office', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const top   = makeMat(0xd4c4a0)  // helles Holz / Laminat
    const leg   = makeMat(0xaaaaaa)  // Metall-Beine
    const draw  = makeMat(0xb8a888)  // Schublade
    const hndl  = makeMat(0x666666)

    // Tischplatte
    g.add(box(0.94, 0.05, 0.62, top, 0, 0.74, 0))
    // Rückwand (Cable Tray)
    g.add(box(0.92, 0.08, 0.04, makeMat(0x888888), 0, 0.71, -0.30))
    // 4 Metall-Beine
    for (const [lx, lz] of [[-0.42, -0.26], [0.42, -0.26], [-0.42, 0.26], [0.42, 0.26]])
      g.add(box(0.05, 0.72, 0.05, leg, lx, 0.36, lz))
    // Querstrebe
    g.add(box(0.84, 0.04, 0.05, leg, 0, 0.20, -0.26))
    // Schubladen-Container (rechts)
    g.add(box(0.24, 0.56, 0.46, draw, 0.34, 0.44, 0))
    // Schubladenfronten
    g.add(box(0.22, 0.14, 0.04, top, 0.34, 0.58, 0.24))
    g.add(box(0.22, 0.14, 0.04, top, 0.34, 0.40, 0.24))
    g.add(box(0.22, 0.14, 0.04, top, 0.34, 0.22, 0.24))
    // Griffe
    for (const y of [0.58, 0.40, 0.22])
      g.add(box(0.10, 0.03, 0.03, hndl, 0.34, y, 0.27))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
