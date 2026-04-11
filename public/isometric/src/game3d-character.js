// ─── game3d-character.js ── Character building, animation, input, interactions ──
// Depends on: game3d-core.js, game3d-furniture.js, game3d-placement.js

// NPC Begrüssungs-Texte
const _NPC_GREETINGS = [
  'Hoi {name}!', 'Hey {name}, wie gaats?', 'Sali {name}!',
  'Grüezi {name}!', '{name}! Was machsch?', 'Hallo {name}!',
  'Na {name}, alles klar?', '{name}, schön dich z gseh!',
]
function _npcGreeting(name) {
  const tpl = _NPC_GREETINGS[Math.floor(Math.random() * _NPC_GREETINGS.length)]
  return tpl.replace('{name}', name || 'NPC')
}

function buildCharacter(cfg = AVATAR) {
  const root = new THREE.Group()

  // ── Body type config ──────────────────────────────────────────────────────
  const bt = BODY_TYPES[cfg.bodyType ?? 0] ?? BODY_TYPES[0]

  // ── Resolve materials from AVATAR config ──────────────────────────────────
  const skinHex  = SKIN_TONES[cfg.skinTone]
  const hairHex  = HAIR_COLORS[cfg.hairColor]
  const shirtHex = SHIRT_COLORS[cfg.shirtColor]
  const pantsHex = PANTS_COLORS[cfg.pantsColor]
  const shoeHex  = SHOE_COLORS[cfg.shoeColor]

  const skin       = makeMat(skinHex)
  const skinDark   = makeMat(shadeHex(skinHex,  -0.18))
  const skinLight  = makeMat(shadeHex(skinHex,   0.20))
  const hair       = makeMat(hairHex)
  const hairDark   = makeMat(shadeHex(hairHex,  -0.38))
  const shirtBlue  = makeMat(shirtHex)
  const shirtDark  = makeMat(shadeHex(shirtHex, -0.28))
  const shirtCuff  = makeMat(shadeHex(shirtHex,  0.35))
  const pants      = makeMat(pantsHex)
  const pantsDark  = makeMat(shadeHex(pantsHex, -0.25))
  const shoe       = makeMat(shoeHex)
  const shoeDark   = makeMat(shadeHex(shoeHex,  -0.28))
  const shoeSole   = makeMat(shadeHex(shoeHex,  -0.50))
  const belt       = makeMat(0x7a5a18)
  const beltBuckle = makeMat(0xd4a820)
  const eyeHex     = (typeof EYE_COLORS !== 'undefined') ? (EYE_COLORS[cfg.eyeColor ?? 0] ?? EYE_COLORS[0]) : 0x0e0e1e
  const eyeDarkM   = makeMat(eyeHex)
  const eyeWhiteM  = makeMat(0xffffff)
  const mouthDarkM = makeMat(0x8b3320)
  const beardMat   = makeMat(shadeHex(hairHex, -0.25))

  // ── HEAD ─────────────────────────────────────────────────────────────────
  const head = new THREE.Group()
  head.name = 'head'

  // Main skull — bigger & blockier than before (Habbo proportion)
  head.add(box(0.66, 0.62, 0.60, skin,  0,    0,     0))

  // Ear nubs
  head.add(box(0.09, 0.17, 0.15, skin, -0.37,  0.02, 0))
  head.add(box(0.09, 0.17, 0.15, skin,  0.37,  0.02, 0))

  // ── Hair — driven by AVATAR.hairStyle ────────────────────────────────────
  HAIR_STYLES[cfg.hairStyle].build(head, hair, hairDark)

  // ── Eyes ────────────────────────────────────────────────────────────────
  head.add(box(0.20, 0.18, 0.06, eyeWhiteM, -0.15, 0.08, 0.31))
  head.add(box(0.20, 0.18, 0.06, eyeWhiteM,  0.15, 0.08, 0.31))
  head.add(box(0.13, 0.15, 0.05, eyeDarkM,  -0.15, 0.04, 0.33))
  head.add(box(0.13, 0.15, 0.05, eyeDarkM,   0.15, 0.04, 0.33))
  head.add(box(0.05, 0.05, 0.03, eyeWhiteM, -0.10, 0.10, 0.35))
  head.add(box(0.05, 0.05, 0.03, eyeWhiteM,  0.10, 0.10, 0.35))

  // ── Eyebrows — driven by AVATAR.browStyle ────────────────────────────────
  ;(() => {
    const bs = cfg.browStyle ?? 0
    const browH  = bs === 2 ? 0.09 : bs === 3 ? 0.03 : 0.05
    const browW  = bs === 2 ? 0.24 : bs === 4 ? 0.18 : 0.20
    const browY  = bs === 1 ? 0.26 : 0.22
    const browMat = bs === 2 ? makeMat(shadeHex(hairHex, -0.20)) : hairDark
    for (const sx of [-1, 1]) {
      const brow = box(browW, browH, 0.04, browMat, sx * 0.15, browY, 0.31)
      if (bs === 4) brow.rotation.z = sx * 0.32  // angry slant inward
      if (bs === 1) brow.rotation.z = sx * -0.14 // arched
      head.add(brow)
    }
  })()

  // Nose (small bump)
  head.add(box(0.09, 0.10, 0.09, skinDark, 0, -0.02, 0.32))

  // ── Mouth — driven by AVATAR.mouthStyle ─────────────────────────────────
  ;(() => {
    const ms = cfg.mouthStyle ?? 0
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(
      ms === 2 ? 0.30 : ms === 1 ? 0.26 : 0.22,
      ms === 1 ? 0.04 : 0.07,
      0.05
    ), mouthDarkM)
    mouth.name = 'mouth'
    mouth.position.set(ms === 3 ? 0.04 : 0, -0.16, 0.32)
    if (ms === 3) mouth.rotation.z = -0.18  // smirk
    head.add(mouth)
    if (ms === 0) { // smile corners
      head.add(box(0.08, 0.08, 0.05, mouthDarkM, -0.13, -0.13, 0.32))
      head.add(box(0.08, 0.08, 0.05, mouthDarkM,  0.13, -0.13, 0.32))
    } else if (ms === 2) { // grin — wider corners + teeth row
      head.add(box(0.10, 0.09, 0.05, mouthDarkM, -0.17, -0.12, 0.32))
      head.add(box(0.10, 0.09, 0.05, mouthDarkM,  0.17, -0.12, 0.32))
      head.add(box(0.24, 0.04, 0.04, eyeWhiteM,   0.00, -0.14, 0.34))
    } else if (ms === 4) { // pout — downturned corners
      head.add(box(0.08, 0.08, 0.05, mouthDarkM, -0.13, -0.19, 0.32))
      head.add(box(0.08, 0.08, 0.05, mouthDarkM,  0.13, -0.19, 0.32))
    }
  })()

  // ── Beard — driven by AVATAR.beardStyle ──────────────────────────────────
  ;(() => {
    const beardId = (typeof BEARD_STYLES !== 'undefined')
      ? (BEARD_STYLES[cfg.beardStyle ?? 0] || BEARD_STYLES[0]).id
      : 'none'
    if (beardId === 'stubble') {
      // Scattered tiny squares on lower face
      const positions = [[-0.18,-0.08],[-0.08,-0.08],[0.02,-0.08],[0.12,-0.08],[0.20,-0.08],
                         [-0.22,-0.17],[-0.10,-0.17],[0.00,-0.17],[0.11,-0.17],[0.22,-0.17],
                         [-0.16,-0.25],[-0.06,-0.25],[0.04,-0.25],[0.14,-0.25]]
      for (const [px, py] of positions)
        head.add(box(0.06, 0.06, 0.04, beardMat, px, py, 0.32))
    } else if (beardId === 'mustache') {
      head.add(box(0.28, 0.07, 0.05, beardMat, -0.07, -0.09, 0.33))
      head.add(box(0.28, 0.07, 0.05, beardMat,  0.07, -0.09, 0.33))
    } else if (beardId === 'goatee') {
      head.add(box(0.20, 0.07, 0.05, beardMat, 0, -0.09, 0.33)) // mustache
      head.add(box(0.18, 0.16, 0.05, beardMat, 0, -0.24, 0.32)) // chin
    } else if (beardId === 'fullbeard') {
      head.add(box(0.52, 0.07, 0.05, beardMat, 0, -0.09, 0.33))  // mustache
      head.add(box(0.54, 0.22, 0.05, beardMat, 0, -0.23, 0.32))  // lower face
      head.add(box(0.10, 0.28, 0.06, beardMat, -0.28, -0.15, 0.22)) // left cheek
      head.add(box(0.10, 0.28, 0.06, beardMat,  0.28, -0.15, 0.22)) // right cheek
    } else if (beardId === 'chinstrap') {
      head.add(box(0.09, 0.40, 0.06, beardMat, -0.30, -0.12, 0.18)) // left strap
      head.add(box(0.09, 0.40, 0.06, beardMat,  0.30, -0.12, 0.18)) // right strap
      head.add(box(0.32, 0.08, 0.05, beardMat,  0.00, -0.29, 0.30)) // chin bar
    }
  })()

  head.position.set(0, 1.60, 0)
  root.add(head)

  // ── TORSO (Group so breath animation works on whole upper body) ───────────
  // NOTE: animation sets torso.position.y = 1.05 + breath so keep default 1.05
  const torso = new THREE.Group()
  torso.name = 'torso'

  // Shirt style + neck — driven by AVATAR.shirtStyle
  SHIRT_STYLES[cfg.shirtStyle].build(torso, shirtBlue, shirtDark, skin, belt, beltBuckle)

  // ── "S" Staff logo on the BACK of the shirt (pixel-art, gold) ─────────────
  // Torso back face sits at torso-local z = -0.185; blocks protrude at -0.21
  // 3×5 pixel grid, spacing 0.072, pixel block 0.062×0.062×0.04
  ;(() => {
    const pxS  = 0.062, pyS = 0.062, pzS = 0.04
    const sp   = 0.072          // centre-to-centre pixel spacing
    const bkZ  = -0.21          // just behind the back face
    const offY =  0.06          // vertical centre of the letter on the shirt
    // S glyph: [col, row] — col: -1=left, 0=mid, 1=right; row: +2=top → -2=bottom
    const sGlyph = [
      [-1, 2],[0, 2],[1, 2],   // top bar
      [-1, 1],                  // upper-left
      [-1, 0],[0, 0],[1, 0],   // middle bar
                    [1,-1],    // lower-right
      [-1,-2],[0,-2],[1,-2],   // bottom bar
    ]
    for (const [cx, cy] of sGlyph) {
      torso.add(box(pxS, pyS, pzS, beltBuckle, cx * sp, cy * sp + offY, bkZ))
    }
  })()

  // Body-type extra geometry (breasts, muscles etc.) — added to torso group
  // cfg + shirtBlue/shirtDark passed so extras only show with correct clothing
  bt.buildTorsoExtra(torso, skin, skinDark, skinLight, cfg, shirtBlue, shirtDark)

  torso.position.set(0, 1.05, 0)
  root.add(torso)

  // ── ARMS ──────────────────────────────────────────────────────────────────
  // Two-segment arm: upper arm (shoulder pivot) + forearm (elbow pivot)
  // Elbow sits at y = -0.36 in upper-arm local space.
  function makeArm(side) {   // side: -1 = left, +1 = right
    const sw = bt.shoulderW                  // shoulder cap width (body-type)
    const uw = bt.upperArmW                  // upper arm width (body-type)

    // ── Upper arm (shoulder pivot) ───────────────────────────────────────
    const arm = new THREE.Group()
    arm.name = side < 0 ? 'armL' : 'armR'

    // Shoulder cap
    arm.add(box(sw,        0.12, sw,        shirtDark, 0, -0.02, 0))
    // Upper arm sleeve (shirt)
    arm.add(box(uw,        0.30, uw,        shirtBlue, 0, -0.20, 0))
    // Elbow cap / sleeve cuff
    arm.add(box(uw + 0.02, 0.08, uw + 0.02, shirtCuff, 0, -0.37, 0))

    // ── Forearm (elbow pivot at y = -0.41 of upper arm) ─────────────────
    const forearm = new THREE.Group()
    forearm.name = side < 0 ? 'forearmL' : 'forearmR'
    forearm.position.set(0, -0.41, 0)  // elbow joint

    // Forearm skin (slightly narrower than upper arm)
    forearm.add(box(Math.max(0.18, uw - 0.02), 0.26, Math.max(0.18, uw - 0.02), skin, 0, -0.13, 0))

    // ── Hand / Wrist (wrist pivot at y = -0.28 of forearm) ───────────────
    const hand = new THREE.Group()
    hand.name = side < 0 ? 'handL' : 'handR'
    hand.position.set(0, -0.28, 0)  // wrist joint

    // Wrist knob
    hand.add(box(0.19, 0.09, 0.19, skinDark, 0, -0.04, 0))
    // Palm
    hand.add(box(0.24, 0.17, 0.21, skin, 0, -0.15, 0.01))
    // Fingers
    hand.add(box(0.07, 0.14, 0.08, skin, -0.07, -0.29, 0.04))
    hand.add(box(0.07, 0.15, 0.08, skin,  0.00, -0.30, 0.04))
    hand.add(box(0.07, 0.13, 0.08, skin,  0.07, -0.28, 0.04))
    // Thumb
    hand.add(box(0.08, 0.12, 0.07, skin, side * 0.14, -0.16, 0.06))

    forearm.add(hand)
    arm.add(forearm)
    // Arm X offset = 0.31 + half shoulder width (wider shoulders → arms further out)
    arm.position.set(side * (0.31 + bt.shoulderW * 0.5), 1.33, 0)
    return arm
  }

  root.add(makeArm(-1))
  root.add(makeArm( 1))

  // ── LEGS ──────────────────────────────────────────────────────────────────
  // Each leg: thigh → knee ridge → calf → ankle peek
  // Shoe is a child of the leg group so it swings with the walk animation.
  function makeLeg(side) {   // side: -1 = left, +1 = right
    const leg = new THREE.Group()
    leg.name = side < 0 ? 'legL' : 'legR'

    // Pants style — driven by AVATAR.pantsStyle
    PANTS_STYLES[cfg.pantsStyle].build(leg, pants, pantsDark, skinLight)

    // ── Shoe group (child of leg) ──────────────────────────────────────────
    // shoeGrp.y = -0.58 puts sole bottom at local y≈0.06, matching floor surface
    const shoeGrp = new THREE.Group()
    shoeGrp.name = side < 0 ? 'shoeL' : 'shoeR'
    shoeGrp.position.set(0, -0.58, 0)
    shoeGrp.add(box(0.30, 0.07, 0.38, shoeSole, 0, -0.06, -0.01))  // sole
    shoeGrp.add(box(0.27, 0.14, 0.34, shoe,     0,  0.02, -0.01))  // upper
    shoeGrp.add(box(0.25, 0.11, 0.09, shoeDark, 0,  0.01,  0.16))  // toe cap
    shoeGrp.add(box(0.23, 0.09, 0.07, shoeDark, 0,  0.01, -0.18))  // heel

    leg.add(shoeGrp)
    leg.position.set(side * bt.legHipOff, 0.72, 0)
    return leg
  }

  root.add(makeLeg(-1))
  root.add(makeLeg( 1))

  // ── Accessories ───────────────────────────────────────────────────────────
  const accSet = new Set(cfg.accessories || [])
  if (accSet.size > 0) {
    const frameMat   = makeMat(0x1a1a1a)
    const lensMatCl  = makeMat(0xaaddff)  // clear lens tint
    const lensMatSun = makeMat(0x111a22)  // dark sunglass lens
    const goldMat    = makeMat(0xd4a820)
    const silverMat  = makeMat(0xcccccc)
    const leatherMat = makeMat(0x7a3a18)
    const blackMat   = makeMat(0x111111)
    const redMat     = makeMat(0xcc2222)
    const phoneMat   = makeMat(0x222222)
    const screenMat  = makeMat(0x88bbff)

    // ── Glasses (added to head group, offset from face) ───────────────────
    if (accSet.has('glasses_round') || accSet.has('glasses_square') || accSet.has('sunglasses')) {
      const isRound  = accSet.has('glasses_round')
      const isSun    = accSet.has('sunglasses')
      const lensMat  = isSun ? lensMatSun : lensMatCl
      const glassW   = isRound ? 0.18 : 0.22
      const glassH   = isRound ? 0.16 : 0.14
      const glassZ   = 0.35
      // Left lens
      head.add(box(glassW, glassH, 0.04, lensMat,  -0.16, 0.08, glassZ))
      // Right lens
      head.add(box(glassW, glassH, 0.04, lensMat,   0.16, 0.08, glassZ))
      // Bridge
      head.add(box(0.10, 0.04, 0.03, frameMat, 0, 0.08, glassZ + 0.01))
      // Left frame outline
      head.add(box(glassW + 0.04, 0.03, 0.03, frameMat, -0.16, 0.16, glassZ))
      head.add(box(glassW + 0.04, 0.03, 0.03, frameMat, -0.16, 0.00, glassZ))
      head.add(box(0.03, glassH + 0.03, 0.03, frameMat, -0.16 - glassW/2, 0.08, glassZ))
      // Right frame outline
      head.add(box(glassW + 0.04, 0.03, 0.03, frameMat,  0.16, 0.16, glassZ))
      head.add(box(glassW + 0.04, 0.03, 0.03, frameMat,  0.16, 0.00, glassZ))
      head.add(box(0.03, glassH + 0.03, 0.03, frameMat,  0.16 + glassW/2, 0.08, glassZ))
      // Arms to ears
      head.add(box(0.14, 0.03, 0.03, frameMat, -0.36, 0.08, 0.18))
      head.add(box(0.14, 0.03, 0.03, frameMat,  0.36, 0.08, 0.18))
    }

    // ── Earrings ─────────────────────────────────────────────────────────
    if (accSet.has('earrings')) {
      head.add(box(0.07, 0.07, 0.07, goldMat,  -0.42, -0.02, 0))
      head.add(box(0.07, 0.07, 0.07, goldMat,   0.42, -0.02, 0))
      head.add(box(0.05, 0.12, 0.05, goldMat,  -0.42, -0.12, 0))
      head.add(box(0.05, 0.12, 0.05, goldMat,   0.42, -0.12, 0))
    }

    // ── Hat: Cap ─────────────────────────────────────────────────────────
    if (accSet.has('hat_cap')) {
      const capMat = makeMat(shirtHex) // match shirt color
      head.add(box(0.70, 0.12, 0.64, capMat,  0, 0.35,  0))    // brim top
      head.add(box(0.72, 0.12, 0.66, blackMat,0, 0.28,  0))    // brim edge
      head.add(box(0.64, 0.22, 0.60, capMat,  0, 0.47,  0))    // dome
      head.add(box(0.38, 0.07, 0.08, blackMat,0, 0.30, 0.37))  // visor
    }

    // ── Hat: Beanie ───────────────────────────────────────────────────────
    if (accSet.has('hat_beanie')) {
      const bMat = makeMat(shirtHex)
      head.add(box(0.66, 0.28, 0.62, bMat,  0, 0.40, 0))
      head.add(box(0.68, 0.10, 0.64, makeMat(shadeHex(shirtHex, -0.20)), 0, 0.28, 0)) // ribbing
      head.add(box(0.14, 0.14, 0.14, bMat,  0, 0.58, 0)) // pompom
    }

    // ── Necklace (on torso, at neck — beads pushed forward so visible above shirt) ─
    const torsoRef = root.getObjectByName('torso')
    if (torsoRef && accSet.has('necklace')) {
      const beadMat = goldMat
      const neckY   = 0.38  // slightly below collar so it drapes naturally
      // Arc of beads: [x, z] — z values start at 0.28 (well in front of shirt at 0.19)
      const beads   = [[ 0.00, 0.28],
                       [-0.12, 0.25],[ 0.12, 0.25],
                       [-0.20, 0.18],[ 0.20, 0.18],
                       [-0.24, 0.08],[ 0.24, 0.08],
                       [-0.22,-0.02],[ 0.22,-0.02]]
      for (const [bx, bz] of beads)
        torsoRef.add(box(0.07, 0.07, 0.07, beadMat, bx, neckY, bz))
      // Pendant in front center
      torsoRef.add(box(0.10, 0.10, 0.07, goldMat, 0, neckY - 0.08, 0.29))
    }

    // ── Scarf ─────────────────────────────────────────────────────────────
    if (torsoRef && accSet.has('scarf')) {
      const scarfMat = makeMat(shirtHex)
      torsoRef.add(box(0.54, 0.18, 0.46, scarfMat, 0, 0.42, 0))  // wrap
      torsoRef.add(box(0.12, 0.38, 0.14, scarfMat, 0.08, 0.26, 0.22)) // hanging end
    }

    // ── Backpack ──────────────────────────────────────────────────────────
    if (torsoRef && accSet.has('backpack')) {
      const bpMat  = makeMat(shadeHex(shirtHex, -0.15))
      const bpMat2 = makeMat(shadeHex(shirtHex, -0.35))
      torsoRef.add(box(0.34, 0.42, 0.14, bpMat,  0,  0.08, -0.26)) // main body
      torsoRef.add(box(0.30, 0.18, 0.10, bpMat2, 0, -0.06, -0.32)) // bottom pocket
      torsoRef.add(box(0.08, 0.36, 0.06, bpMat2,-0.14, 0.10, -0.10)) // left strap
      torsoRef.add(box(0.08, 0.36, 0.06, bpMat2, 0.14, 0.10, -0.10)) // right strap
    }

    // ── Bag (handbag — right side of torso) ──────────────────────────────
    if (accSet.has('bag')) {
      const bagG = new THREE.Group()
      bagG.position.set(0.44, 0.72, 0)
      root.add(bagG)
      bagG.add(box(0.22, 0.26, 0.12, leatherMat, 0, 0, 0))  // body
      bagG.add(box(0.18, 0.04, 0.08, makeMat(shadeHex(0x7a3a18,-0.3)), 0, 0.15, 0)) // flap
      bagG.add(box(0.04, 0.22, 0.04, goldMat, 0, 0.24, 0))   // clasp
      // Strap from bag to shoulder
      bagG.add(box(0.04, 0.60, 0.04, makeMat(shadeHex(0x7a3a18,-0.2)), 0, 0.42, 0))
    }

    // ── Watch (on left forearm) ───────────────────────────────────────────
    const forearmL = root.getObjectByName('forearmL')
    if (forearmL && accSet.has('watch')) {
      const watchG = new THREE.Group()
      watchG.position.set(0, -0.05, 0)
      forearmL.add(watchG)
      watchG.add(box(0.22, 0.09, 0.22, silverMat, 0, 0, 0))  // strap
      watchG.add(box(0.16, 0.11, 0.14, blackMat,  0, 0.01, 0.05))  // case
      watchG.add(box(0.12, 0.09, 0.10, makeMat(0x223366), 0, 0.02, 0.06)) // face
    }

    // ── Phone (in right hand) ─────────────────────────────────────────────
    const handR = root.getObjectByName('handR')
    if (handR && accSet.has('phone')) {
      const phoneG = new THREE.Group()
      phoneG.position.set(0, -0.18, 0.05)
      handR.add(phoneG)
      phoneG.add(box(0.14, 0.26, 0.04, phoneMat, 0, 0, 0))  // body
      phoneG.add(box(0.10, 0.20, 0.03, screenMat, 0, 0.02, 0.02)) // screen
    }
  }

  // Enable shadows on every mesh in the character
  root.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })

  // Lift so feet sit on floor surface (floor top ≈ y 0.06)
  root.position.y = 0.06

  return root
}

// Avatar wird via ROOM_INIT postMessage vom Parent geladen (users.avatar_code aus SQL)

let charGroup = buildCharacter(AVATAR)
scene.add(charGroup)

function rebuildCharacter() {
  scene.remove(charGroup)
  charGroup = buildCharacter(AVATAR)
  scene.add(charGroup)
  if (char.drink) attachDrink(char.drink)  // re-attach drink prop after rebuild
  // Namensschild neu setzen nach Rebuild (defined in game3d.js)
  if (typeof _applyLocalNameLabel === 'function') _applyLocalNameLabel()
  // Avatar-Änderungen werden via AVATAR_CHANGED postMessage an den Parent gesendet → SQL
}

// ─── Jacuzzi undress / redress ────────────────────────────────────────────────
// Stores original materials so we can restore them after leaving
const _jacuzziOrigMats = { torso: [], armL: [], armR: [], forearmL: [], forearmR: [],
                           handL: [], handR: [], legL: [], legR: [], shoeL: [], shoeR: [] }
let _isUndressed = false

function undressForJacuzzi() {
  if (_isUndressed) return
  _isUndressed = true

  const skinHex = SKIN_TONES[AVATAR.skinTone]
  const skinMat = makeMat(skinHex)
  const isFemale = (BODY_TYPES[AVATAR.bodyType]?.gender === 'female')

  // Badehosen-Farbe: blau für Mann, pink/rot für Frau
  const trunkHex  = isFemale ? 0xe03068 : 0x2563eb
  const trunkMat  = makeMat(trunkHex)
  const trunkDark = makeMat(shadeHex(trunkHex, -0.25))
  // Bikini-Top für Frau (gleiche Farbe wie Badehose)
  const bikiniTopMat = isFemale ? makeMat(shadeHex(trunkHex, 0.15)) : null

  // Save & replace materials on each named part
  const parts = ['torso', 'armL', 'armR', 'forearmL', 'forearmR',
                 'handL', 'handR', 'legL', 'legR', 'shoeL', 'shoeR']
  for (const name of parts) {
    const grp = charGroup.getObjectByName(name)
    if (!grp) continue
    _jacuzziOrigMats[name] = []
    grp.traverse(m => {
      if (!m.isMesh) return
      _jacuzziOrigMats[name].push({ mesh: m, mat: m.material, vis: m.visible })
      if (name === 'shoeL' || name === 'shoeR') {
        m.visible = false           // Schuhe ausziehen
      } else if (name === 'torso') {
        if (isFemale) {
          // Frau: Torso = Haut, Bikini-Top wird unten separat hinzugefügt
          m.material = skinMat
        } else {
          m.material = skinMat      // Mann: nackter Oberkörper
        }
      } else if (name === 'legL' || name === 'legR') {
        // Oberschenkel → Badehose, Rest → Haut
        const ly = m.position?.y ?? 0
        m.material = ly > -0.25 ? trunkMat : (ly > -0.45 ? trunkDark : skinMat)
      } else if (name.startsWith('arm')) {
        m.material = skinMat        // Ärmel → Haut
      }
    })
  }

  // Frau: temporären Bikini-Top als Kinder auf Torso-Gruppe hinzufügen
  if (isFemale) {
    const torsoGrp = charGroup.getObjectByName('torso')
    if (torsoGrp && bikiniTopMat) {
      const topL = box(0.23, 0.22, 0.10, bikiniTopMat, -0.14, 0.12, 0.19)
      const topR = box(0.23, 0.22, 0.10, bikiniTopMat,  0.14, 0.12, 0.19)
      topL.userData._jacuzziBikini = true
      topR.userData._jacuzziBikini = true
      torsoGrp.add(topL)
      torsoGrp.add(topR)
      // Unterband
      const band = box(0.52, 0.06, 0.07, makeMat(shadeHex(trunkHex, -0.15)), 0, 0.01, 0.19)
      band.userData._jacuzziBikini = true
      torsoGrp.add(band)
    }
  }
}

function redressAfterJacuzzi() {
  if (!_isUndressed) return
  _isUndressed = false
  // Temporäre Bikini-Top Meshes entfernen
  const torsoGrp = charGroup.getObjectByName('torso')
  if (torsoGrp) {
    const toRemove = []
    torsoGrp.traverse(m => { if (m.userData._jacuzziBikini) toRemove.push(m) })
    for (const m of toRemove) torsoGrp.remove(m)
  }
  // Originalm Materialien wiederherstellen
  for (const name of Object.keys(_jacuzziOrigMats)) {
    for (const entry of _jacuzziOrigMats[name]) {
      entry.mesh.material = entry.mat
      entry.mesh.visible = entry.vis
    }
    _jacuzziOrigMats[name] = []
  }
}

// ─── Drink / fridge helpers ───────────────────────────────────────────────────
function createDrinkProp(drink) {
  const g = new THREE.Group()
  g.name = 'drinkProp'
  const canMat   = new THREE.MeshLambertMaterial({ color: drink.color })
  const labelMat = new THREE.MeshLambertMaterial({ color: drink.labelColor })
  const capMat   = new THREE.MeshLambertMaterial({ color: 0xcccccc })
  // Voxel-style can — body, label stripe, top/bottom caps
  g.add(box(0.13, 0.22, 0.13, canMat,   0,     0,     0))   // main body
  g.add(box(0.14, 0.09, 0.14, labelMat, 0,     0.02,  0))   // label band
  g.add(box(0.10, 0.03, 0.10, capMat,   0,     0.125, 0))   // top cap
  g.add(box(0.10, 0.03, 0.10, capMat,   0,    -0.125, 0))   // bottom cap
  return g
}

function attachDrink(drink) {
  const handR = charGroup.getObjectByName('handR')
  if (!handR) return
  const old = handR.getObjectByName('drinkProp')
  if (old) handR.remove(old)
  if (!drink) return
  const prop = createDrinkProp(drink)
  // Position in hand-local space: sit in the palm, slightly forward
  prop.position.set(0, -0.18, 0.08)
  handR.add(prop)
}

function openFridge(fridge) {
  if (fridge.isOpen) return
  fridge.isOpen = true
  fridge.doorTarget = -Math.PI / 2  // swing door open

  // Turn to face fridge
  const dx = fridge.x - char.x, dz = fridge.z - char.z
  char.dir = Math.atan2(dx, dz)

  setTimeout(() => {
    const drink = DRINKS[Math.floor(Math.random() * DRINKS.length)]
    char.drink = drink
    char.sipT  = -3  // first sip in 3 seconds
    attachDrink(drink)

    // Show drink label in chat bubble briefly
    char.chatText   = drink.icon + ' ' + drink.name
    char.chatting   = true
    char.chatTimer  = 2.5

    setTimeout(() => {
      fridge.doorTarget = 0
      fridge.isOpen = false
    }, 900)
  }, 650)
}

// Shadow ellipse under character
const shadowGeo  = new THREE.CircleGeometry(0.35, 16)
const shadowMat  = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.22, transparent: true })
const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
shadowMesh.rotation.x = -Math.PI / 2
shadowMesh.position.y = 0.07
scene.add(shadowMesh)

// ─── Chat UI (bubble + input) ─────────────────────────────────────────────────
const chatBubble = document.createElement('div')
Object.assign(chatBubble.style, {
  position: 'fixed', background: 'rgba(255,255,255,0.93)', color: '#222',
  padding: '6px 12px', borderRadius: '14px', fontSize: '13px',
  fontFamily: "'Segoe UI', sans-serif", pointerEvents: 'none',
  maxWidth: '210px', wordBreak: 'break-word', display: 'none', zIndex: '20',
  boxShadow: '0 2px 10px rgba(0,0,0,0.35)', transform: 'translate(-50%, calc(-100% - 14px))',
  border: '1px solid rgba(0,0,0,0.1)', lineHeight: '1.4'
})
document.body.appendChild(chatBubble)

const chatInput = document.createElement('input')
chatInput.placeholder = '💬 Nachricht eingeben…'
Object.assign(chatInput.style, {
  position: 'fixed', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
  background: 'rgba(10,10,30,0.82)', border: '1px solid rgba(255,255,255,0.20)',
  borderRadius: '22px', padding: '8px 18px', color: '#fff', fontSize: '13px',
  fontFamily: "'Segoe UI', sans-serif", width: '280px', outline: 'none',
  zIndex: '20', backdropFilter: 'blur(4px)'
})
document.body.appendChild(chatInput)

chatInput.addEventListener('keydown', e => {
  e.stopPropagation()
  if (e.code === 'Enter') {
    const text = chatInput.value.trim()
    if (text) {
      char.chatText  = text
      char.chatting  = true
      char.chatTimer = 5.0
      // Raum-Besitzer bekommt goldene Krone-Blase
      const localIsOwner = typeof canPlaceFurniture !== 'undefined' && canPlaceFurniture
      if (localIsOwner) {
        chatBubble.textContent = '👑 ' + text
        chatBubble.style.background = 'rgba(255,240,140,0.97)'
        chatBubble.style.border     = '2px solid #c8910a'
        chatBubble.style.color      = '#3d2000'
        chatBubble.style.boxShadow  = '0 2px 12px rgba(200,145,10,0.45)'
      } else {
        chatBubble.textContent = text
        chatBubble.style.background = 'rgba(255,255,255,0.93)'
        chatBubble.style.border     = '1px solid rgba(0,0,0,0.1)'
        chatBubble.style.color      = '#222'
        chatBubble.style.boxShadow  = '0 2px 10px rgba(0,0,0,0.35)'
      }
      chatBubble.style.display = 'block'
      window.parent?.postMessage({ type: 'CHAR_CHAT', message: text }, '*')
    }
    chatInput.value = ''
    chatInput.blur()
  }
  if (e.code === 'Escape') {
    chatInput.value = ''
    chatInput.blur()
  }
})

// ─── Click-target indicator ────────────────────────────────────────────────────
const targetRingGeo = new THREE.RingGeometry(0.28, 0.40, 24)
const targetRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true, side: THREE.DoubleSide })
const targetRing    = new THREE.Mesh(targetRingGeo, targetRingMat)
targetRing.rotation.x = -Math.PI / 2
targetRing.position.y = 0.08
targetRing.visible    = false
scene.add(targetRing)

// ─── Character state ───────────────────────────────────────────────────────────
const char = {
  x: 0, z: 0,          // world position (centered on grid)
  dir: 0,               // rotation in radians (Y axis)
  state: 'idle',        // idle | walk | sit | wave
  target: null,         // { x, z } click target
  animT: 0,             // animation time accumulator
  level: 0,             // 0 = ground floor, 1 = upper floor
  chatting: false,      // mouth animation active
  chatTimer: 0,         // seconds remaining for chat bubble
  chatText: '',         // text shown in bubble
  rollerTarget: null,   // {x,z} tile-centre being pushed toward by a roller
  drink: null,          // held drink: { id, name, icon, color, labelColor } or null
  sipT: -5,             // sip animation timer: negative = countdown, 0-2 = raising/lowering
}

// ─── Raycaster for click-to-move ───────────────────────────────────────────────
const raycaster = new THREE.Raycaster()
const mouse     = new THREE.Vector2()
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

// ─── Teleport state ────────────────────────────────────────────────────────────
let tp = null             // active teleport: { phase, from, to, timer }
let lastClickObj  = null  // for double-click wardrobe/fridge detection
let lastClickTime = 0
var pendingFridge = null  // fridge to open when character arrives

function startTeleport(w) {
  if (tp || !w.partner) return
  if (char.state === 'sit' || char.state === 'sleep') char.state = 'idle'
  char.target = null; targetRing.visible = false
  tp = { phase: 'walking_to', from: w, to: w.partner, timer: 0 }
  char.target = { x: w.entranceX, z: w.entranceZ }
}

renderer.domElement.addEventListener('contextmenu', e => { e.preventDefault(); clearHeld(); hideObjMenu() })

renderer.domElement.addEventListener('click', e => {
  // ── Inventory placement ────────────────────────────────────────────────────
  if (heldItem) { placeHeld(e); return }

  // ── Avatar click — screen-space proximity (zuverlässig für isometrische Ansicht) ──
  if (typeof showPlayerPanel === 'function') {
    const cx = e.clientX, cy = e.clientY
    const HIT_R = 38  // Pixel-Radius um Avatar-Mitte
    const _avatarScreenPos = (group) => {
      const wp = new THREE.Vector3()
      wp.setFromMatrixPosition(group.matrixWorld)
      wp.y += 1.1  // Körpermitte
      wp.project(camera)
      return {
        x: (wp.x * 0.5 + 0.5) * window.innerWidth,
        y: (-wp.y * 0.5 + 0.5) * window.innerHeight,
      }
    }
    // Eigener Avatar
    if (charGroup) {
      charGroup.updateMatrixWorld(true)
      const sp = _avatarScreenPos(charGroup)
      const dist = Math.hypot(cx - sp.x, cy - sp.y)
      console.log(`[AvatarClick] click=(${cx.toFixed(0)},${cy.toFixed(0)}) avatar=(${sp.x.toFixed(0)},${sp.y.toFixed(0)}) dist=${dist.toFixed(1)} HIT_R=${HIT_R} charGroup.visible=${charGroup.visible}`)
      if (dist < HIT_R) {
        hideFurniturePanel()
        const ownName = (typeof _localPlayerName !== 'undefined' && _localPlayerName) ? _localPlayerName : ''
        showPlayerPanel(true, ownName, charGroup, typeof AVATAR !== 'undefined' ? AVATAR : null, window._localMotto, window._localMunicipalityName, window._localUserLevel)
        return
      }
    } else {
      console.warn('[AvatarClick] charGroup ist null!')
    }
    // Fremde Avatare
    if (typeof _remoteAvatars !== 'undefined') {
      for (const [id, ra] of _remoteAvatars) {
        ra.group.updateMatrixWorld(true)
        const sp = _avatarScreenPos(ra.group)
        const dist = Math.hypot(cx - sp.x, cy - sp.y)
        console.log(`[AvatarClick] remote id=${id} name=${ra.name} pos=(${sp.x.toFixed(0)},${sp.y.toFixed(0)}) dist=${dist.toFixed(1)}`)
        if (dist < HIT_R) {
          hideFurniturePanel()
          const remoteCfg = (typeof _parseAvatarCodeToCfg === 'function') ? _parseAvatarCodeToCfg(ra.avatarCode) : null
          showPlayerPanel(false, ra.name || '', ra.group, remoteCfg, ra.motto, ra.municipalityName, ra.userLevel)
          return
        }
      }
    }
  } else {
    console.warn('[AvatarClick] showPlayerPanel ist nicht definiert (typeof:', typeof showPlayerPanel, ')')
  }

  // ── Check for placed object click (select / deselect) ─────────────────────
  {
    invMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
    invMouse.y = -(e.clientY / window.innerHeight) * 2 + 1
    camera.updateMatrixWorld()
    invRaycaster.setFromCamera(invMouse, camera)
    const hits = invRaycaster.intersectObjects(PLACED_MESHES)
    if (hits.length) {
      const uuid = hits[0].object.userData.placedUUID
      const obj  = PLACED_OBJECTS.find(o => o.uuid === uuid)
      if (obj?.type === 'fridge') {
        const fridge = FRIDGES.find(f => f.group === obj.group)
        if (fridge) {
          const now = performance.now()
          if (lastClickObj === fridge && now - lastClickTime < 420) {
            // Double-click: walk + open
            lastClickObj = null
            pendingFridge = null
            hideFurniturePanel()
            const dx = char.x - fridge.entranceX, dz = char.z - fridge.entranceZ
            if (Math.sqrt(dx*dx + dz*dz) < 1.2) {
              openFridge(fridge)
            } else {
              pendingFridge = fridge
              char.target = { x: fridge.entranceX, z: fridge.entranceZ }
              if (char.state === 'sit') char.state = 'idle'
            }
          } else {
            // Single click: show furniture panel
            lastClickObj = fridge; lastClickTime = now
            selectedPlaced = obj
            hideObjMenu()
            showFurniturePanel(fridge, obj)
          }
          return
        }
      }
      // Lampe: Doppelklick → An/Aus schalten
      if (obj?.type === 'lamp' || obj?.type === 'test_lamp') {
        const now = performance.now()
        if (lastClickObj === obj && now - lastClickTime < 420) {
          lastClickObj = null
          toggleLamp(obj)
          window.parent?.postMessage({ type: 'CHAR_LAMP_TOGGLE', x: obj.x, z: obj.z, on: !!obj.group?.userData?._lampOn }, '*')
        } else {
          lastClickObj = obj; lastClickTime = now
          if (selectedPlaced?.uuid === uuid) { hideObjMenu(); hideFurniturePanel(); return }
          hideFurniturePanel()
          selectPlaced(uuid)
        }
        return
      }
      // NPC: Klick → Kopf zum NPC drehen + Furniture-Panel anzeigen
      if (obj?.isNpc) {
        const npcX = obj.wx ?? obj.x, npcZ = obj.wz ?? obj.z
        // Nur Kopf drehen (relativ zum Körper)
        const head = charGroup.getObjectByName('head')
        if (head) {
          const toNpc = Math.atan2(npcX - char.x, npcZ - char.z)
          head.rotation.y = toNpc - char.dir
          char._headResetTimer = 5.0
        }
        // Panel anzeigen (Drehen/Aufnehmen/Löschen) — gleich wie normales Möbel
        if (selectedPlaced?.uuid === uuid) { hideObjMenu(); hideFurniturePanel(); return }
        hideFurniturePanel()
        selectPlaced(uuid)
        return
      }

      // Seating: Doppelklick → hinlaufen + hinsetzen
      if (SEATING_TYPES_ALL.includes(obj?.type)) {
        const now = performance.now()
        if (lastClickObj === obj && now - lastClickTime < 420) {
          lastClickObj = null
          hideFurniturePanel()
          // Nächsten SEAT zum Character finden (wichtig für Sofa mit 2+ Plätzen)
          const objFacingY = FACING_Y[FACING_DIRS[obj.facingIdx]] ?? 0
          let seat = { x: obj.x, z: obj.z, facingY: objFacingY }
          let bestD = Infinity
          for (const s of SEATS) {
            const d = Math.hypot(char.x - s.x, char.z - s.z)
            // Nur Seats in der Nähe dieses Möbels (max 1.5 Einheiten vom Zentrum)
            if (Math.hypot(s.x - obj.x, s.z - obj.z) < 1.5 && d < bestD) {
              bestD = d; seat = { x: s.x, z: s.z, facingY: s.facingY ?? objFacingY, jacuzziCenter: s.jacuzziCenter }
            }
          }
          if (Math.hypot(char.x - seat.x, char.z - seat.z) < 0.6) {
            char.dir = seat.facingY
            if (seat.jacuzziCenter) {
              char.state = 'jacuzzi_undress'; char._undressT = 0; char._undressedTop = false
            } else {
              char.state = 'sit'
            }
            char.target = null
            targetRing.visible = false
          } else {
            if (char.state === 'sit' || char.state === 'jacuzzi_undress') {
              char.state = 'idle'; redressAfterJacuzzi()
              if (typeof window._standUpFromSeat === 'function') window._standUpFromSeat()
            }
            char.target = { x: seat.x, z: seat.z, autoSit: seat }
            const ty = getFloorY(seat.x, seat.z, char.level)
            targetRing.position.set(seat.x, ty + 0.08, seat.z)
            targetRing.visible = true
          }
        } else {
          lastClickObj = obj; lastClickTime = now
          if (selectedPlaced?.uuid === uuid) { hideObjMenu(); hideFurniturePanel(); return }
          hideFurniturePanel()
          selectPlaced(uuid)
        }
        return
      }
      if (selectedPlaced?.uuid === uuid) { hideObjMenu(); hideFurniturePanel(); return }
      hideFurniturePanel()
      selectPlaced(uuid)
      return
    }
  }
  // Clicked empty space → deselect
  hideObjMenu()
  hideFurniturePanel()

  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
  camera.updateMatrixWorld()
  raycaster.setFromCamera(mouse, camera)

  // ── Wardrobe double-click detection (runs before floor click) ─────────────
  if (!tp) {
    let bestW = null, bestD = Infinity
    for (const w of WARDROBES) {
      if (w.lvl !== char.level) continue
      const hits = raycaster.intersectObject(w.group, true)
      if (hits.length && hits[0].distance < bestD) { bestD = hits[0].distance; bestW = w }
    }
    if (bestW) {
      const now = performance.now()
      if (bestW === lastClickObj && now - lastClickTime < 420) {
        startTeleport(bestW)
        lastClickObj = null
      } else {
        lastClickObj = bestW; lastClickTime = now
        // Single click → walk to wardrobe entrance
        char.target = { x: bestW.entranceX, z: bestW.entranceZ }
        if (char.state === 'sit') char.state = 'idle'
        const ty = getFloorY(bestW.entranceX, bestW.entranceZ, char.level)
        targetRing.position.set(bestW.entranceX, ty + 0.08, bestW.entranceZ)
        targetRing.visible = true
      }
      return
    }
    lastClickObj = null
  }

  // ── Floor-Tile Raycast: direkt auf die Tile-Meshes statt Plane-Berechnung ─
  const floorHits = raycaster.intersectObjects(PLACE_FLOOR_MESHES)
  if (!floorHits.length) return  // Klick außerhalb aller Floors → ignorieren
  const hit = floorHits[0].point
  const clickFloorY = hit.y

  const tx = Math.round(hit.x)
  const tz = Math.round(hit.z)

  {
    // Find nearest seat from SEATS array (has correct per-seat positions for sofas etc.)
    let nearSeat = null
    let nearSeatDist = 0.9

    for (const s of SEATS) {
      const sFloor = s.level >= 1 ? FLOOR2_Y : 0
      if (Math.abs(sFloor - clickFloorY) < 0.5) {
        const d = Math.hypot(s.x - hit.x, s.z - hit.z)
        if (d < nearSeatDist) { nearSeatDist = d; nearSeat = s }
      }
    }

    if (nearSeat) {
      char.target = { x: nearSeat.x, z: nearSeat.z, autoSit: nearSeat }
      char._headedToSeat = nearSeat   // merken damit auto-sit auch bei grösserem Abstand greift
    } else {
      char.target = { x: tx, z: tz }
      char._headedToSeat = null       // kein Sitz-Ziel mehr
    }
    char._ctmLastDist = undefined; char._ctmStuck = 0
    // A* Pfad berechnen
    char._waypoints = findPath(char.x, char.z, char.target.x, char.target.z, char.level) || []
    // Multiplayer: Bewegung an Parent melden → socket avatar-move-request
    {
      const path = char._waypoints.length > 0
        ? char._waypoints.map(wp => ({ x: wp.x, y: wp.z }))
        : [{ x: char.target.x, y: char.target.z }]
      window.parent?.postMessage({ type: 'CHAR_MOVE_REQUEST', path, level: char.level ?? 0 }, '*')
    }
    // Debug: beide Punkte merken — roher Klick (Maus) + tatsächliches Ziel (gerundet/Stuhl)
    if (typeof _dbgLastClick !== 'undefined') {
      _dbgLastClick = {
        rawX: hit.x, rawZ: hit.z,          // exakte Mausposition auf dem Floor
        x: char.target.x, z: char.target.z, // tatsächliches Ziel (gerundet oder autoSit)
        level: char.level,
        floorY: clickFloorY,
      }
    }
    if (char.state === 'sit' || char.state === 'jacuzzi_undress') {
      char.state = 'idle'; redressAfterJacuzzi()
      // Charakter aus dem Möbel-Solid herausschieben bevor A* läuft
      if (typeof window._standUpFromSeat === 'function') window._standUpFromSeat()
    }
    if (char.state === 'wave') char.state = 'idle'
    targetRing.position.set(char.target.x, clickFloorY + 0.08, char.target.z)
    targetRing.visible = true
  }
})

// ─── Input ─────────────────────────────────────────────────────────────────────
const keys = {}
const _isTyping = () => {
  const el = document.activeElement
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
}
window.addEventListener('keydown', e => {
  // Kein Game-Input während in einem Textfeld getippt wird
  if (_isTyping()) return
  keys[e.code] = true

  if (e.code === 'Escape') { clearHeld(); hideObjMenu(); char.rollerTarget = null; return }

  // T → Chat fokussieren
  if (e.code === 'KeyT') {
    e.preventDefault()
    chatInput.focus()
    return
  }

  if (e.code === 'KeyR') {
    if (char.state === 'dance') {
      char.state = 'idle'
    } else if (char.state !== 'sit' && char.state !== 'sleep') {
      char.state = 'dance'
      char.target = null
      targetRing.visible = false
    }
  }

  if (e.code === 'KeyQ') {
    if (char.state === 'sit' || char.state === 'jacuzzi_undress') {
      char.state = 'idle'
      char.seatY = undefined
      redressAfterJacuzzi()
      if (typeof window._standUpFromSeat === 'function') window._standUpFromSeat()
    } else {
      // Find nearest seat within 1.5 tiles.
      // Search PLACED_OBJECTS first (live positions, handles roller-moved chairs),
      // then fall back to static SEATS (hardcoded + non-placed).
      let best = null, bestDist = 1.5

      // 1) Placed seating objects (up-to-date positions even when on roller)
      for (const obj of PLACED_OBJECTS) {
        if (!SEATING_TYPES_ALL.includes(obj.type)) continue
        const d = Math.hypot(obj.x - char.x, obj.z - char.z)
        if (d < bestDist) {
          bestDist = d
          best = { x: obj.x, z: obj.z, facingY: FACING_Y[FACING_DIRS[obj.facingIdx]] ?? 0 }
        }
      }

      // 2) Static / non-placed seats (e.g. hardcoded chair at spawn)
      for (const s of SEATS) {
        const d = Math.hypot(s.x - char.x, s.z - char.z)
        if (d < bestDist) { bestDist = d; best = s }
      }

      if (best) {
        char.x = best.x
        char.z = best.z
        char.dir = best.facingY
        char.seatY = 0
      }
      char.state = 'sit'
      char.target = null
      targetRing.visible = false
    }
  }
  if (e.code === 'KeyE') {
    char.state = char.state === 'wave' ? 'idle' : 'wave'
  }
  if (e.code === 'KeyC') {
    toggleAvatarEditor()
  }
  if (e.code === 'KeyL') {
    // Toggle bedroom light
    if (window.bedroomLight) {
      window.bedroomLight.visible = !window.bedroomLight.visible
      if (window.lampShade) {
        const m = window.lampShade.material
        m.emissiveIntensity = window.bedroomLight.visible ? 0.8 : 0
        m.color.set(window.bedroomLight.visible ? 0xffe87c : 0x555555)
      }
    }
  }
  if (e.code === 'KeyB') {
    // Sleep / wake in bed
    if (char.state === 'sleep') {
      char.state = 'idle'
    } else if (window.BED_POS) {
      const bp = window.BED_POS
      const dist = Math.sqrt((char.x - bp.x) ** 2 + (char.z - bp.z) ** 2)
      if (dist < 2.5) {
        char.x = bp.x; char.z = bp.z
        char.target = null; targetRing.visible = false
        char.state = 'sleep'
      }
    }
  }
})
window.addEventListener('keyup', e => {
  if (_isTyping()) return
  keys[e.code] = false
})

// ─── Animation ─────────────────────────────────────────────────────────────────
function animateChar(dt) {
  char.animT += dt

  const armL     = charGroup.getObjectByName('armL')
  const armR     = charGroup.getObjectByName('armR')
  const forearmL = charGroup.getObjectByName('forearmL')
  const forearmR = charGroup.getObjectByName('forearmR')
  const handL    = charGroup.getObjectByName('handL')
  const handR    = charGroup.getObjectByName('handR')
  const legL     = charGroup.getObjectByName('legL')
  const legR     = charGroup.getObjectByName('legR')
  const head     = charGroup.getObjectByName('head')
  const mouth    = charGroup.getObjectByName('mouth')

  // Reset all three joints on both sides cleanly
  function resetArms() {
    armL.rotation.set(0,0,0); armR.rotation.set(0,0,0)
    if (forearmL) forearmL.rotation.set(0,0,0)
    if (forearmR) forearmR.rotation.set(0,0,0)
    if (handL) handL.rotation.set(0,0,0)
    if (handR) handR.rotation.set(0,0,0)
  }

  if (char.state === 'walk') {
    const t = char.animT * 8
    const swing = Math.sin(t) * 0.5
    armL.rotation.x = swing; armL.rotation.z = 0
    legL.rotation.x = -swing * 0.8
    legR.rotation.x =  swing * 0.8
    head.rotation.x = head.rotation.z = 0
    charGroup.getObjectByName('torso').position.y = 1.05
    if (char.drink) {
      // Right arm holds drink while walking — upper arm down, forearm 90° bent forward
      armR.rotation.x = 0; armR.rotation.z = -0.05
      if (forearmR) { forearmR.rotation.x = -Math.PI * 0.50; forearmR.rotation.z = 0 }
      if (handR) handR.rotation.set(0, 0, 0)
      // Left arm swings freely with slight elbow bend
      if (forearmL) { forearmL.rotation.x = Math.abs(swing) * 0.3; forearmL.rotation.z = 0 }
      if (handL) handL.rotation.set(0, 0, 0)
    } else {
      armR.rotation.x = -swing; armR.rotation.z = 0
      const elbowBend = Math.abs(swing) * 0.35
      if (forearmL) { forearmL.rotation.x = elbowBend; forearmL.rotation.z = 0 }
      if (forearmR) { forearmR.rotation.x = elbowBend; forearmR.rotation.z = 0 }
      if (handL) handL.rotation.set(0,0,0)
      if (handR) handR.rotation.set(0,0,0)
    }

  } else if (char.state === 'idle') {
    const breath = Math.sin(char.animT * 1.5) * 0.02
    charGroup.getObjectByName('torso').position.y = 1.05 + breath
    head.position.y = 1.6 + breath
    armL.rotation.x = armL.rotation.z = 0
    legL.rotation.x = legR.rotation.x = 0
    head.rotation.x = head.rotation.z = 0
    if (char.drink) {
      // sp = 0 (resting, holding can) → 1 (full sip at mouth) → 0 (back down)
      const sp = char.sipT >= 0 ? Math.min(1, char.sipT < 1 ? char.sipT : 2 - char.sipT) : 0

      // Resting (sp=0): upper arm down, forearm 90° forward → can at belly/chest, close to body
      // Sip     (sp=1): shoulder lifts forward-up, forearm stays bent, can reaches mouth
      //
      // Upper arm: x  0.0 → -1.55  (lift ~89° forward)
      //            z -0.05 → +0.38  (swing inward toward mouth side)
      armR.rotation.x = sp * (-1.55)
      armR.rotation.z = -0.05 + sp * 0.43
      // Forearm: 90° bend at rest, tightens at peak
      if (forearmR) { forearmR.rotation.x = -Math.PI * 0.50 + sp * (-Math.PI * 0.14); forearmR.rotation.z = 0 }
      // Wrist: tips can toward mouth
      if (handR) { handR.rotation.x = sp * 0.55; handR.rotation.z = 0 }
      if (forearmL) { forearmL.rotation.x = 0.06; forearmL.rotation.z = 0 }
      if (handL) handL.rotation.set(0, 0, 0)
    } else {
      armR.rotation.x = 0; armR.rotation.z = 0
      if (forearmR) { forearmR.rotation.x = 0.06; forearmR.rotation.z = 0 }
      if (handR) handR.rotation.set(0, 0, 0)
      if (forearmL) { forearmL.rotation.x = 0.06; forearmL.rotation.z = 0 }
      if (handL) handL.rotation.set(0, 0, 0)
    }

  } else if (char.state === 'wave') {
    armR.rotation.x = -Math.PI * 0.58 + Math.sin(char.animT * 10) * 0.28
    armR.rotation.z = 0.14
    if (forearmR) { forearmR.rotation.x = -Math.PI * 0.38 + Math.sin(char.animT * 10 + 0.5) * 0.22; forearmR.rotation.z = 0 }
    if (handR) { handR.rotation.x = Math.sin(char.animT * 10 + 1.0) * 0.18; handR.rotation.z = 0 }
    armL.rotation.x = armL.rotation.z = 0
    if (forearmL) { forearmL.rotation.x = 0.06; forearmL.rotation.z = 0 }
    if (handL) handL.rotation.set(0,0,0)
    legL.rotation.x = legR.rotation.x = 0
    head.rotation.x = head.rotation.z = 0

  } else if (char.state === 'jacuzzi_undress') {
    // Auszieh-Animation: ~1.5s, Arme greifen nach Shirt, ziehen hoch, dann Hose
    const t = char._undressT ?? 0
    char._undressT = (char._undressT ?? 0) + dt

    // Phase 1 (0–0.6s): Arme kreuzen vor Körper (Shirt greifen)
    // Phase 2 (0.6–1.0s): Arme hoch (Shirt ausziehen) → Material-Swap Oberkörper
    // Phase 3 (1.0–1.4s): Kurz bücken (Hose + Schuhe) → Material-Swap Beine
    // Phase 4 (>1.4s): Fertig → sit-State
    if (t < 0.6) {
      const p = t / 0.6
      armL.rotation.x = p * 0.4; armL.rotation.z = p * 0.6
      armR.rotation.x = p * 0.4; armR.rotation.z = -p * 0.6
      if (forearmL) { forearmL.rotation.x = -p * 1.2; forearmL.rotation.z = 0 }
      if (forearmR) { forearmR.rotation.x = -p * 1.2; forearmR.rotation.z = 0 }
      legL.rotation.x = legR.rotation.x = 0
    } else if (t < 1.0) {
      const p = (t - 0.6) / 0.4
      armL.rotation.x = -Math.PI * 0.8 * p; armL.rotation.z = 0.6 * (1 - p)
      armR.rotation.x = -Math.PI * 0.8 * p; armR.rotation.z = -0.6 * (1 - p)
      if (forearmL) { forearmL.rotation.x = -1.2 + p * 0.8; forearmL.rotation.z = 0 }
      if (forearmR) { forearmR.rotation.x = -1.2 + p * 0.8; forearmR.rotation.z = 0 }
      legL.rotation.x = legR.rotation.x = 0
      // Oberkörper-Swap bei 80% dieser Phase
      if (p > 0.8 && !char._undressedTop) {
        char._undressedTop = true
        undressForJacuzzi()
      }
    } else if (t < 1.4) {
      const p = (t - 1.0) / 0.4
      // Leicht bücken
      armL.rotation.x = 0.5 * p; armL.rotation.z = 0
      armR.rotation.x = 0.5 * p; armR.rotation.z = 0
      if (forearmL) { forearmL.rotation.x = -0.8 * p; forearmL.rotation.z = 0 }
      if (forearmR) { forearmR.rotation.x = -0.8 * p; forearmR.rotation.z = 0 }
      const torso = charGroup.getObjectByName('torso')
      if (torso) torso.position.y = 1.05 - p * 0.15
      head.rotation.x = p * 0.3
      legL.rotation.x = legR.rotation.x = 0
    } else {
      // Fertig → in Jacuzzi setzen
      const torso = charGroup.getObjectByName('torso')
      if (torso) torso.position.y = 1.05
      char._undressT = 0
      char._undressedTop = false
      char.state = 'sit'
    }

  } else if (char.state === 'sit') {
    legL.rotation.x = -Math.PI * 0.5
    legR.rotation.x = -Math.PI * 0.5
    armL.rotation.x = armR.rotation.x = 0.15
    armL.rotation.z = armR.rotation.z = 0
    if (forearmL) { forearmL.rotation.x = -Math.PI * 0.28; forearmL.rotation.z = 0 }
    if (forearmR) { forearmR.rotation.x = -Math.PI * 0.28; forearmR.rotation.z = 0 }
    if (handL) handL.rotation.set(0,0,0)
    if (handR) handR.rotation.set(0,0,0)
    head.rotation.x = head.rotation.z = 0

  } else if (char.state === 'sleep') {
    resetArms()
    legL.rotation.x = legR.rotation.x = 0
    head.rotation.x = head.rotation.z = 0
    const breath = Math.sin(char.animT * 0.6) * 0.015
    charGroup.getObjectByName('torso').position.y = 1.05 + breath

  } else if (char.state === 'dance') {
    const t = char.animT * 6
    armL.rotation.x = Math.sin(t) * 0.7
    armR.rotation.x = -Math.sin(t) * 0.7
    armL.rotation.z =  0.5 + Math.cos(t * 0.7) * 0.55
    armR.rotation.z = -0.5 - Math.cos(t * 0.7) * 0.55
    if (forearmL) { forearmL.rotation.x = Math.sin(t + 0.6) * 0.55; forearmL.rotation.z = 0 }
    if (forearmR) { forearmR.rotation.x = -Math.sin(t + 0.6) * 0.55; forearmR.rotation.z = 0 }
    if (handL) { handL.rotation.x = Math.sin(t + 1.1) * 0.3; handL.rotation.z = 0 }
    if (handR) { handR.rotation.x = -Math.sin(t + 1.1) * 0.3; handR.rotation.z = 0 }
    legL.rotation.x =  Math.sin(t * 1.5) * 0.28
    legR.rotation.x = -Math.sin(t * 1.5) * 0.28
    head.rotation.z = Math.sin(t * 0.9) * 0.18
    head.rotation.x = 0
    const bounce = Math.abs(Math.sin(t * 2)) * 0.06
    charGroup.getObjectByName('torso').position.y = 1.05 + bounce
    head.position.y = 1.6 + bounce
  }

  // Mouth animation while chatting (oscillate open/close)
  if (mouth) {
    mouth.scale.y = char.chatting ? (1 + Math.abs(Math.sin(char.animT * 14)) * 1.8) : 1
  }

  // Kopf langsam zurückdrehen nach NPC-Klick
  if (char._headResetTimer > 0) {
    char._headResetTimer -= dt
    if (char._headResetTimer <= 0 && head) {
      head.rotation.y = 0
    }
  }
}

// ─── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight
  const a = w / h
  camera.left   = -VIEW * a
  camera.right  =  VIEW * a
  camera.top    =  VIEW
  camera.bottom = -VIEW
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
})

// ─── Teleport Update ────────────────────────────────────────────────────────────
function updateTeleport(dt) {
  if (!tp) return
  tp.timer += dt
  const { from, to } = tp

  if (tp.phase === 'walking_to') {
    const dx = char.x - from.entranceX, dz = char.z - from.entranceZ
    if (Math.sqrt(dx*dx + dz*dz) < 0.28) {
      // Arrived at entrance — open door first, character waits
      tp.phase = 'entering_door'; tp.timer = 0
      from.doorTarget = Math.PI / 2
      char.dir = Math.atan2(from.wx - from.entranceX, from.wz - from.entranceZ)
      char.state = 'idle'; char.target = null
    }

  } else if (tp.phase === 'entering_door') {
    // Wait for door to swing open (~0.45 s), then walk character in
    if (tp.timer > 0.45) {
      tp.phase = 'entering_walk'; tp.timer = 0
      char.target = { x: from.wx, z: from.wz }
      char.state = 'walk'
    }

  } else if (tp.phase === 'entering_walk') {
    // Character walks into the wardrobe body; disappear when close enough
    const dx = char.x - from.wx, dz = char.z - from.wz
    if (Math.sqrt(dx*dx + dz*dz) < 0.25 || tp.timer > 0.8) {
      charGroup.visible = false
      char.target = null; char.state = 'idle'
      from.doorTarget = 0
      tp.phase = 'sparkling'; tp.timer = 0
      to.sparkling = true; to.sparkleT = 0
      to.doorTarget = Math.PI / 2
    }

  } else if (tp.phase === 'sparkling') {
    if (tp.timer > 1.0) {
      char.x = to.wx; char.z = to.wz; char.level = to.lvl
      charGroup.visible = true
      to.sparkling = false
      char.target = { x: to.entranceX, z: to.entranceZ }
      char.state = 'walk'
      tp.phase = 'exiting'; tp.timer = 0
    }

  } else if (tp.phase === 'exiting') {
    const dx = char.x - to.entranceX, dz = char.z - to.entranceZ
    if (Math.sqrt(dx*dx + dz*dz) < 0.3 || tp.timer > 1.5) {
      to.doorTarget = 0; tp = null
    }
  }
}

// ─── Inventory hint bar ────────────────────────────────────────────────────────
const placeHintEl = document.getElementById('place-hint')
function updatePlaceHint() {
  if (!placeHintEl) return
  placeHintEl.style.display = heldItem ? 'block' : 'none'
  if (heldItem && heldItem.id.startsWith('frame_')) {
    placeHintEl.textContent = `🖼️ Maus über die Wand bewegen → Klicken zum Aufhängen  ·  ESC = abbrechen`
  } else if (heldItem && heldItem.rotatable) {
    const dir = FACING_DIRS[heldItem.facing ?? 0]
    placeHintEl.textContent = `🖱️ Klicken = platzieren  ·  Scroll = drehen (${dir})  ·  ESC = abbrechen`
  } else if (heldItem) {
    placeHintEl.textContent = '🖱️ Klicken = platzieren  ·  ESC = abbrechen'
  }
}
