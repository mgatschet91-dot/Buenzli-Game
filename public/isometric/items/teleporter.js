;(function () {
  ITEM_DEFS.add('teleporter', function (wx, wz /*, facingY – not used, rotatable=false */) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()

    // ── Base platform (dark octagon approximated as cylinder) ─────────────
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.46, 0.07, 8),
      new THREE.MeshLambertMaterial({ color: 0x0d0033 })
    )
    platform.position.y = 0.035
    g.add(platform)

    // ── Outer glowing ring ─────────────────────────────────────────────────
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.40, 0.045, 8, 24),
      new THREE.MeshLambertMaterial({ color: 0x3333ff, emissive: 0x2222bb, emissiveIntensity: 0.9 })
    )
    ring.position.y = 0.07
    ring.rotation.x = Math.PI / 2
    g.add(ring)

    // ── Inner glow disc (semi-transparent floor) ───────────────────────────
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.012, 16),
      new THREE.MeshLambertMaterial({
        color: 0x5555ff, emissive: 0x4444ee, emissiveIntensity: 0.55,
        transparent: true, opacity: 0.65,
      })
    )
    disc.position.y = 0.09
    g.add(disc)

    // ── Vertical light beam ────────────────────────────────────────────────
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.14, 1.6, 8),
      new THREE.MeshLambertMaterial({
        color: 0x8888ff, emissive: 0x6666ff, emissiveIntensity: 0.50,
        transparent: true, opacity: 0.30,
      })
    )
    beam.position.y = 0.89
    g.add(beam)

    // ── Top ring cap ────────────────────────────────────────────────────────
    const topRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.12, 0.03, 6, 16),
      new THREE.MeshLambertMaterial({ color: 0xaaaaff, emissive: 0x8888ff, emissiveIntensity: 1.0 })
    )
    topRing.position.y = 1.68
    topRing.rotation.x = Math.PI / 2
    g.add(topRing)

    g.position.set(wx, baseY, wz)
    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)

    // Register teleport zone so checkTeleport() can find it
    addTeleportZone(g.uuid, wx, wz)

    return g
  })
})()
