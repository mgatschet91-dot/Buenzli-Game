// gltf-loader-shim.js — Lädt GLTFLoader via importmap + ESM
;(function () {
  // Import map damit 'three' aufgelöst werden kann
  const map = document.createElement('script')
  map.type = 'importmap'
  map.textContent = JSON.stringify({
    imports: {
      'three': 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js'
    }
  })
  document.head.appendChild(map)

  const s = document.createElement('script')
  s.type = 'module'
  s.textContent = `
    import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js'
    window.THREE.GLTFLoader = GLTFLoader
    window.dispatchEvent(new CustomEvent('gltfloader-ready'))
  `
  document.head.appendChild(s)
})()
