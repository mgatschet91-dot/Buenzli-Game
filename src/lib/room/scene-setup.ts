/**
 * scene-setup.ts — Three.js Scene, Camera, Lighting erstellen
 */
import { THREE } from './three-shim'

export interface SceneObjects {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  ambient: THREE.AmbientLight
  sun: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  resizeObserver: ResizeObserver
}

const VIEW = 10

export function createScene(container: HTMLElement): SceneObjects {
  const w = container.clientWidth || window.innerWidth
  const h = container.clientHeight || window.innerHeight

  const renderer = new THREE.WebGLRenderer({ antialias: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.localClippingEnabled = true
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  // Isometric orthographic camera
  const aspect = w / h
  const camera = new THREE.OrthographicCamera(
    -VIEW * aspect, VIEW * aspect,
     VIEW, -VIEW,
    0.1, 100
  )
  // True isometric: 45 deg azimuth, arctan(1/sqrt(2)) ~ 35.264 deg elevation
  camera.position.set(20, 16, 20)
  camera.lookAt(0, 0, 0)

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.7)
  scene.add(ambient)

  const sun = new THREE.DirectionalLight(0xffeedd, 1.2)
  sun.position.set(10, 20, 10)
  sun.castShadow = true
  sun.shadow.mapSize.width  = 2048
  sun.shadow.mapSize.height = 2048
  sun.shadow.camera.near = 0.5
  sun.shadow.camera.far  = 100
  sun.shadow.camera.left = sun.shadow.camera.bottom = -30
  sun.shadow.camera.right = sun.shadow.camera.top   =  30
  scene.add(sun)

  const fill = new THREE.DirectionalLight(0xaabbff, 0.4)
  fill.position.set(-8, 12, -5)
  scene.add(fill)

  // Resize handling
  const resizeObserver = new ResizeObserver(() => {
    const cw = container.clientWidth
    const ch = container.clientHeight
    if (cw === 0 || ch === 0) return
    const a = cw / ch
    camera.left   = -VIEW * a
    camera.right  =  VIEW * a
    camera.top    =  VIEW
    camera.bottom = -VIEW
    camera.updateProjectionMatrix()
    renderer.setSize(cw, ch)
  })
  resizeObserver.observe(container)

  return { renderer, scene, camera, ambient, sun, fill, resizeObserver }
}

export function destroyScene(objs: SceneObjects) {
  objs.resizeObserver.disconnect()
  objs.renderer.dispose()
  objs.renderer.domElement.remove()
}
