/**
 * _legacy_items.js — Wrapper für alle in game3d.js eingebauten Möbel
 *
 * Jedes bestehende Möbel wird in die ITEM_DEFS-Registry eingetragen,
 * sodass alle Items über denselben Mechanismus abrufbar sind.
 * Die eigentliche Geometrie liegt weiterhin in game3d.js (buildXxx-Funktionen).
 */
;(function () {
  // Möbel (moebel)
  ITEM_DEFS.add('chair',      function (wx, wz, fy) { return buildChair(wx, wz, fy) })
  ITEM_DEFS.add('table',      function (wx, wz)     { return buildTable(wx, wz) })
  ITEM_DEFS.add('sofa',       function (wx, wz, fy) { return buildSofa(wx, wz, fy) })
  ITEM_DEFS.add('lamp',       function (wx, wz)     { return buildLamp(wx, wz) })
  ITEM_DEFS.add('plant',      function (wx, wz)     { return buildPlant(wx, wz) })
  ITEM_DEFS.add('armchair',   function (wx, wz, fy) { return buildArmchair(wx, wz, fy) })
  ITEM_DEFS.add('bookshelf',  function (wx, wz, fy) { return buildBookshelf(wx, wz, fy) })
  ITEM_DEFS.add('tv',         function (wx, wz, fy) { return buildTV(wx, wz, fy) })
  ITEM_DEFS.add('dresser',    function (wx, wz, fy) { return buildDresser(wx, wz, fy) })
  ITEM_DEFS.add('bed',        function (wx, wz, fy) { return buildBedPlaceable(wx, wz, fy) })

  // Party (party)
  ITEM_DEFS.add('discoball',  function (wx, wz)     { return buildDiscoball(wx, wz) })
  ITEM_DEFS.add('djdesk',     function (wx, wz, fy) { return buildDJDesk(wx, wz, fy) })
  ITEM_DEFS.add('balloon',    function (wx, wz)     { return buildBalloon(wx, wz) })
  ITEM_DEFS.add('partyflag',  function (wx, wz, fy) { return buildPartyFlag(wx, wz, fy) })
  ITEM_DEFS.add('neon',       function (wx, wz, fy) { return buildNeon(wx, wz, fy) })
  // Roller: nicht in ITEM_DEFS — spawnPlaced switch-case übergibt dir + flY korrekt
  //         (Registry-Funktionen erhalten nur wx, wz, facY)

  // Bilder (bilder) — Wall Frames
  ITEM_DEFS.add('frame_blue', function (wx, wz, fy) { return buildFrameBlue(wx, wz, fy) })
  ITEM_DEFS.add('frame_red',  function (wx, wz, fy) { return buildFrameRed(wx, wz, fy) })
  ITEM_DEFS.add('frame_gold', function (wx, wz, fy) { return buildFrameGold(wx, wz, fy) })
  ITEM_DEFS.add('frame_dark', function (wx, wz, fy) { return buildFrameDark(wx, wz, fy) })

  // Hocker / Sitzgelegenheiten (hocker)
  ITEM_DEFS.add('barstool',   function (wx, wz)     { return buildBarstool(wx, wz) })
  ITEM_DEFS.add('ottoman',    function (wx, wz)     { return buildOttoman(wx, wz) })
  ITEM_DEFS.add('bench',      function (wx, wz, fy) { return buildBench(wx, wz, fy) })
  ITEM_DEFS.add('stool',      function (wx, wz)     { return buildStool(wx, wz) })

  // Bar (bar)
  ITEM_DEFS.add('barcounter', function (wx, wz, fy) { return buildBarCounter(wx, wz, fy) })
  ITEM_DEFS.add('drinksshelf',function (wx, wz, fy) { return buildDrinksShelf(wx, wz, fy) })
  ITEM_DEFS.add('cocktailtable',function(wx, wz)    { return buildCocktailTable(wx, wz) })
  ITEM_DEFS.add('fridge',     function (wx, wz, fy) { return buildFridge(wx, wz, fy) })
  ITEM_DEFS.add('beertap',    function (wx, wz)     { return buildBeertap(wx, wz) })

  // Treppen (treppen)
  ITEM_DEFS.add('stair_wood', function (wx, wz, fy) { return buildStairWood(wx, wz, fy) })
  ITEM_DEFS.add('stair_stone',function (wx, wz, fy) { return buildStairStone(wx, wz, fy) })
  ITEM_DEFS.add('stair_metal',function (wx, wz, fy) { return buildStairMetal(wx, wz, fy) })
  ITEM_DEFS.add('stair_open', function (wx, wz, fy) { return buildStairOpen(wx, wz, fy) })
  ITEM_DEFS.add('stair_down', function (wx, wz, fy) { return buildStairDown(wx, wz, fy) })
})()
