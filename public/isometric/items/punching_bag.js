// punching_bag.js — Boxsack (sport)
;(function () {
  ITEM_DEFS.add('punching_bag', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const bag    = makeMat(0x8b1a1a)  // dunkelrot
    const bagD   = makeMat(0x5a1010)  // Naht-Streifen
    const chain  = makeMat(0x888888)
    const beam   = makeMat(0x444444)  // Deckenhalter
    const swivel = makeMat(0x666666)

    // Deckenbefestigung (Wandhalter)
    g.add(box(0.10, 0.08, 0.10, beam,   0, 1.58, 0))
    g.add(box(0.06, 0.36, 0.06, beam,   0, 1.40, 0))
    // Kette (mehrere Glieder)
    for (let i = 0; i < 5; i++)
      g.add(box(0.06, 0.08, 0.04, chain, 0, 1.20 - i * 0.08, 0))
    // Drehelement
    g.add(box(0.08, 0.10, 0.08, swivel, 0, 0.90, 0))
    // Sackoberteil (trapez)
    g.add(box(0.26, 0.10, 0.26, bagD, 0, 0.84, 0))
    // Sack-Hauptkörper
    g.add(box(0.34, 0.62, 0.34, bag,  0, 0.52, 0))
    // Naht-Streifen horizontal
    g.add(box(0.36, 0.04, 0.36, bagD, 0, 0.72, 0))
    g.add(box(0.36, 0.04, 0.36, bagD, 0, 0.52, 0))
    g.add(box(0.36, 0.04, 0.36, bagD, 0, 0.32, 0))
    // Sackboden
    g.add(box(0.26, 0.10, 0.26, bagD, 0, 0.21, 0))
    // Unterkette
    g.add(box(0.04, 0.12, 0.04, chain, 0, 0.12, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
