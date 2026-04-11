// nightstand.js — Nachttisch (schlafzimmer)
;(function () {
  ITEM_DEFS.add('nightstand', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const wood   = makeMat(0xb08060)
    const woodD  = makeMat(0x8b6040)
    const handle = makeMat(0xd4af37)
    const lamp   = makeMat(0xffe8b0)  // Lampenschirm
    const lampB  = makeMat(0xddccaa)  // Lampenfuß

    // Korpus
    g.add(box(0.46, 0.56, 0.40, wood,  0, 0.28, 0))
    // Oberfläche
    g.add(box(0.48, 0.04, 0.42, woodD, 0, 0.58, 0))
    // Schublade
    g.add(box(0.40, 0.18, 0.04, woodD, 0, 0.36, 0.21))
    g.add(box(0.16, 0.03, 0.04, handle,0, 0.36, 0.23))
    // Füße
    for (const [x, z] of [[-0.18, -0.16], [0.18, -0.16], [-0.18, 0.16], [0.18, 0.16]])
      g.add(box(0.06, 0.10, 0.06, woodD, x, 0.05, z))
    // Tischlampe
    g.add(box(0.06, 0.26, 0.06, lampB, 0, 0.73, 0))  // Ständer
    g.add(box(0.26, 0.22, 0.26, lamp,  0, 0.96, 0))  // Schirm

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
