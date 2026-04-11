// test_lamp.js — Test Licht (GLB-Modell, Low Poly Furniture)
;(function () {
  ITEM_DEFS.add('test_lamp', function (wx, wz, facingY) {
    const { baseY } = _lvlBase(wx, wz)
    const g = new THREE.Group()
    g.rotation.y = facingY
    g.position.set(wx, baseY, wz)

    // Kollisions-Solid
    addSolid(wx - 0.22, wx + 0.22, wz - 0.22, wz + 0.22, 0)

    // Licht
    const light = new THREE.PointLight(0xffe8a0, 2.0, 6.0)
    light.position.set(0, 1.6, 0)
    g.add(light)

    // Toggle-State wie bei normaler Lampe
    g.userData._lampOn = true
    g.userData._light = light

    // Synchroner Platzhalter (für Preview + sofortige Sichtbarkeit)
    const pole    = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.40, 8), makeMat(0x888888))
    pole.position.set(0, 0.70, 0)
    const base    = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), makeMat(0x666666))
    base.position.set(0, 0.03, 0)
    const shade   = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.38, 0.44, 10, 1, true), makeMat(0xaa2222))
    shade.position.set(0, 1.50, 0)
    const shadeTop = new THREE.Mesh(new THREE.CircleGeometry(0.18, 10), makeMat(0xcc3333))
    shadeTop.rotation.x = -Math.PI / 2
    shadeTop.position.set(0, 1.72, 0)
    g.add(pole, base, shade, shadeTop)
    g.userData._shadeMat = shade.material

    scene.add(g)

    // GLB async drüber laden (ersetzt Platzhalter nicht, ergänzt)
    function loadModel() {
      const loader = new THREE.GLTFLoader()
      loader.load('/isometric/models/lamp_a.glb', function (gltf) {
        // Platzhalter entfernen
        g.remove(pole, base, shade, shadeTop)
        const model = gltf.scene
        model.scale.set(0.35, 0.35, 0.35)
        model.traverse(m => {
          if (m.isMesh) {
            m.castShadow = true
            m.receiveShadow = true
            m.userData.placedUUID = g.uuid
            if (typeof PLACED_MESHES !== 'undefined') PLACED_MESHES.push(m)
          }
        })
        g.add(model)
      })
    }

    if (THREE.GLTFLoader) {
      loadModel()
    } else {
      window.addEventListener('gltfloader-ready', loadModel, { once: true })
    }

    return g
  })
})()
