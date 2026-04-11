// vase_tall.js — Hohe Deko-Vase (deko)
;(function () {
  ITEM_DEFS.add('vase_tall', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const vase   = makeMat(0x336688)  // blau-graue Keramik
    const accent = makeMat(0xd4af37)  // Gold-Dekor
    const stem   = makeMat(0x228844)  // Stängel
    const flower = makeMat(0xff6688)  // Blüte rosa
    const leaf   = makeMat(0x33aa55)  // Blatt

    // Vasenfuß
    g.add(box(0.26, 0.06, 0.26, vase,  0, 0.03, 0))
    // Vasen-Bauch
    g.add(box(0.24, 0.48, 0.24, vase,  0, 0.30, 0))
    // Vasen-Hals
    g.add(box(0.14, 0.24, 0.14, vase,  0, 0.66, 0))
    // Vasenrand
    g.add(box(0.20, 0.06, 0.20, vase,  0, 0.81, 0))
    // Gold-Dekorstreifen
    g.add(box(0.26, 0.04, 0.26, accent, 0, 0.20, 0))
    g.add(box(0.26, 0.04, 0.26, accent, 0, 0.52, 0))
    // Stängel
    g.add(box(0.04, 0.36, 0.04, stem,  -0.04, 0.96, 0))
    g.add(box(0.04, 0.28, 0.04, stem,   0.06, 0.90, 0.04))
    g.add(box(0.04, 0.22, 0.04, stem,  -0.02, 0.86,-0.04))
    // Blüten
    g.add(box(0.14, 0.10, 0.14, flower,-0.04, 1.32, 0))
    g.add(box(0.12, 0.08, 0.12, makeMat(0xff4499), 0.06, 1.18, 0.04))
    g.add(box(0.10, 0.08, 0.10, makeMat(0xffaa44),-0.02, 1.08,-0.04))
    // Blätter
    g.add(box(0.16, 0.04, 0.06, leaf,  0.08, 1.00, 0))
    g.add(box(0.16, 0.04, 0.06, leaf, -0.08, 1.10, 0))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
