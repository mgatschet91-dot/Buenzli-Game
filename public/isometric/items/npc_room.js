// npc_room.js — Platzierbare NPCs im Raum (3 Styles, mit Namensschild)
;(function () {

  // NPC Style Definitionen
  const NPC_STYLES = {
    1: { // Arbeiter — blaues Outfit, Helm
      skin: 0xd4a574, hair: 0x3a2a1a, shirt: 0x2563b0, pants: 0x3a3a4a, shoes: 0x4a3a2a,
      hat: 0xf0c030, hatType: 'helm', label: 'Arbeiter'
    },
    2: { // Butler — schwarzer Anzug, weiss
      skin: 0xc8a882, hair: 0x1a1a1a, shirt: 0x1a1a2a, pants: 0x1a1a2a, shoes: 0x0a0a0a,
      hat: null, hatType: null, label: 'Butler',
      vest: 0xeeeeee // weisses Hemd darunter
    },
    3: { // Haustier (Hund) — komplett andere Geometrie
      fur: 0xb8875a, furDark: 0x8a6540, nose: 0x2a2a2a, label: 'Haustier'
    }
  }

  function buildNpc(wx, wz, facingY, meta) {
    const { lvl, baseY } = _lvlBase(wx, wz)
    const style = NPC_STYLES[meta?.npc_style || 1]
    const g = new THREE.Group()

    if ((meta?.npc_style || 1) === 3) {
      // ── Haustier (Hund) ─────────────────────────────────────────────
      const fur     = makeMat(style.fur)
      const furDark = makeMat(style.furDark)
      const nose    = makeMat(style.nose)
      const eyeW    = makeMat(0xffffff)
      const eyeD    = makeMat(0x0e0e1e)

      // Koerper
      g.add(box(0.40, 0.30, 0.65, fur,     0,    0.28, 0))
      g.add(box(0.36, 0.26, 0.60, furDark,  0,    0.28, 0.01))
      // Kopf
      g.add(box(0.34, 0.30, 0.32, fur,     0,    0.48, 0.38))
      // Schnauze
      g.add(box(0.20, 0.14, 0.16, furDark,  0,    0.40, 0.54))
      g.add(box(0.08, 0.06, 0.06, nose,    0,    0.44, 0.60))
      // Augen
      g.add(box(0.08, 0.08, 0.04, eyeW,   -0.10, 0.52, 0.52))
      g.add(box(0.08, 0.08, 0.04, eyeW,    0.10, 0.52, 0.52))
      g.add(box(0.05, 0.06, 0.03, eyeD,   -0.10, 0.51, 0.54))
      g.add(box(0.05, 0.06, 0.03, eyeD,    0.10, 0.51, 0.54))
      // Ohren (Schlappohren)
      g.add(box(0.10, 0.18, 0.08, furDark, -0.18, 0.56, 0.32))
      g.add(box(0.10, 0.18, 0.08, furDark,  0.18, 0.56, 0.32))
      // Beine
      g.add(box(0.12, 0.20, 0.12, fur,    -0.12, 0.10, -0.22))
      g.add(box(0.12, 0.20, 0.12, fur,     0.12, 0.10, -0.22))
      g.add(box(0.12, 0.20, 0.12, fur,    -0.12, 0.10,  0.22))
      g.add(box(0.12, 0.20, 0.12, fur,     0.12, 0.10,  0.22))
      // Schwanz
      g.add(box(0.08, 0.22, 0.08, furDark,  0,    0.44, -0.36))

    } else {
      // ── Humanoid NPC (Style 1 + 2) ────────────────────────────────────
      const skin      = makeMat(style.skin)
      const skinDark  = makeMat(shadeHex(style.skin, -0.18))
      const hairM     = makeMat(style.hair)
      const shirtM    = makeMat(style.shirt)
      const shirtDark = makeMat(shadeHex(style.shirt, -0.25))
      const pantsM    = makeMat(style.pants)
      const shoeM     = makeMat(style.shoes)
      const eyeW      = makeMat(0xffffff)
      const eyeD      = makeMat(0x0e0e1e)
      const mouthM    = makeMat(0x8b3320)

      // Kopf
      const head = new THREE.Group()
      head.add(box(0.58, 0.54, 0.52, skin,  0,    0,     0))
      // Ohren
      head.add(box(0.08, 0.14, 0.13, skin, -0.33, 0.02,  0))
      head.add(box(0.08, 0.14, 0.13, skin,  0.33, 0.02,  0))
      // Haare
      head.add(box(0.62, 0.16, 0.56, hairM, 0,    0.30,  -0.02))
      head.add(box(0.62, 0.40, 0.10, hairM, 0,    0.08,  -0.26))
      // Augen
      head.add(box(0.16, 0.14, 0.05, eyeW, -0.13, 0.06,  0.27))
      head.add(box(0.16, 0.14, 0.05, eyeW,  0.13, 0.06,  0.27))
      head.add(box(0.10, 0.12, 0.04, eyeD, -0.13, 0.03,  0.29))
      head.add(box(0.10, 0.12, 0.04, eyeD,  0.13, 0.03,  0.29))
      head.add(box(0.04, 0.04, 0.03, eyeW, -0.09, 0.08,  0.30))
      head.add(box(0.04, 0.04, 0.03, eyeW,  0.09, 0.08,  0.30))
      // Nase
      head.add(box(0.08, 0.08, 0.08, skinDark, 0, -0.02, 0.28))
      // Mund
      head.add(box(0.18, 0.05, 0.04, mouthM,  0,  -0.14, 0.28))
      head.position.set(0, 1.52, 0)

      // Helm (Style 1)
      if (style.hatType === 'helm') {
        const helmM = makeMat(style.hat)
        head.add(box(0.66, 0.14, 0.58, helmM,  0,    0.32, 0))
        head.add(box(0.72, 0.06, 0.64, helmM,  0,    0.24, 0))
        head.add(box(0.60, 0.04, 0.12, helmM,  0,    0.18, 0.28)) // Schirm
      }

      g.add(head)

      // Torso
      const torso = new THREE.Group()
      torso.add(box(0.56, 0.52, 0.34, shirtM,    0,    0, 0))
      torso.add(box(0.58, 0.08, 0.36, shirtDark,  0,    0.26, 0)) // Schultern
      // Butler: weisses Hemd vorne
      if (style.vest) {
        const vestM = makeMat(style.vest)
        torso.add(box(0.30, 0.44, 0.05, vestM,    0,   -0.02, 0.16))
        // Knoepfe
        const btnM = makeMat(0x222222)
        torso.add(box(0.04, 0.04, 0.03, btnM,    0,    0.10, 0.19))
        torso.add(box(0.04, 0.04, 0.03, btnM,    0,    0.00, 0.19))
        torso.add(box(0.04, 0.04, 0.03, btnM,    0,   -0.10, 0.19))
      }
      torso.position.set(0, 1.00, 0)
      g.add(torso)

      // Arme
      for (const side of [-1, 1]) {
        const arm = new THREE.Group()
        arm.add(box(0.22, 0.30, 0.22, shirtM, 0, -0.15, 0))
        arm.add(box(0.18, 0.26, 0.18, skin,   0, -0.42, 0))
        arm.add(box(0.20, 0.14, 0.18, skin,   0, -0.60, 0.01)) // Hand
        arm.position.set(side * 0.40, 1.26, 0)
        g.add(arm)
      }

      // Beine
      for (const side of [-1, 1]) {
        const leg = new THREE.Group()
        leg.add(box(0.22, 0.36, 0.22, pantsM, 0, -0.18, 0))
        leg.add(box(0.24, 0.18, 0.28, shoeM,  0, -0.44, 0.02))
        leg.position.set(side * 0.14, 0.74, 0)
        g.add(leg)
      }
    }

    // ── Namensschild (Sprite über dem Kopf) ─────────────────────────────
    const npcName = meta?.npc_name || 'NPC'
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.roundRect(4, 4, 248, 56, 12)
    ctx.fill()
    ctx.font = 'bold 28px Segoe UI, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffffff'
    ctx.fillText(npcName, 128, 34)

    const tex = new THREE.CanvasTexture(canvas)
    tex.minFilter = THREE.LinearFilter
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const sprite = new THREE.Sprite(spriteMat)
    const nameY = (meta?.npc_style || 1) === 3 ? 1.0 : 2.1
    sprite.position.set(0, nameY, 0)
    sprite.scale.set(1.4, 0.35, 1)
    g.add(sprite)

    // Position + Rotation
    g.position.set(wx, baseY, wz)
    if (facingY != null) g.rotation.y = facingY

    g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
    scene.add(g)
    return g
  }

  ITEM_DEFS.add('room_npc', buildNpc)
})()
