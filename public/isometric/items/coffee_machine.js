// coffee_machine.js — Kaffeemaschine (kueche)
;(function () {
  ITEM_DEFS.add('coffee_machine', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    const body  = makeMat(0x111111)
    const silver= makeMat(0x999999)
    const red   = makeMat(0xcc2222)
    const water = makeMat(0x224488)
    const chrome= makeMat(0xcccccc)

    // Hauptkörper
    g.add(box(0.36, 0.44, 0.30, body,   0, 0.22, 0))
    // Wassertank (rechts oben, leicht blau-transparent)
    g.add(box(0.10, 0.32, 0.28, water,  0.24, 0.30, 0))
    // Display-Streifen oben
    g.add(box(0.30, 0.06, 0.04, silver, 0, 0.41, 0.16))
    // Tassenablage
    g.add(box(0.38, 0.04, 0.32, silver, 0, 0.04, 0))
    // Auslauf-Düse
    g.add(box(0.06, 0.08, 0.06, chrome, 0, 0.30, 0.17))
    g.add(box(0.06, 0.04, 0.10, chrome, 0, 0.26, 0.20))
    // Knopf
    g.add(box(0.08, 0.08, 0.04, red,    0.10, 0.36, 0.16))
    // Tasse darunter
    g.add(box(0.14, 0.10, 0.14, makeMat(0xfafafa), 0, 0.10, 0.04))

    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  })
})()
