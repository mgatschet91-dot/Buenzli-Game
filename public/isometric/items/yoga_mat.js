// yoga_mat.js — Yogamatte (sport)
;(function () {
  ITEM_DEFS.add('yoga_mat', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const mat    = makeMat(0x6622aa)  // lila Matte
    const stripe = makeMat(0x9944ee)  // Streifen
    const line   = makeMat(0xfafafa)  // weiße Mittelachse
    const roll   = makeMat(0x551199)  // aufgerolltes Ende

    // Matte (ausgerollt, flach)
    g.add(box(0.54, 0.03, 0.88, mat, 0, 0.01, 0))
    // Dekor-Streifen längs
    g.add(box(0.04, 0.04, 0.86, stripe, -0.18, 0.01, 0))
    g.add(box(0.04, 0.04, 0.86, stripe,  0.18, 0.01, 0))
    // Mittel-Linie
    g.add(box(0.02, 0.04, 0.88, line, 0, 0.01, 0))
    // Ausrichtungs-Markierungen (quer)
    for (const dz of [-0.30, 0, 0.30])
      g.add(box(0.50, 0.04, 0.02, stripe, 0, 0.02, dz))
    // Aufgerolltes Ende vorne (dekorativ)
    g.add(box(0.54, 0.10, 0.08, roll, 0, 0.06, 0.44))
    g.add(box(0.54, 0.04, 0.04, mat,  0, 0.02, 0.48))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
