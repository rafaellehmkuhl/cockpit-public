// The virtual gimbal camera of demo 2: a three-axis gimbal hanging under a hull, slewing to whatever attitude
// Cockpit's actions ask for. three.js comes from /vendor so the page works without internet.
import * as THREE from '/vendor/three/three.module.min.js'

// Real gimbals slew at a finite rate. Within the last 10° the camera moves at 5°/s, so a 5° step takes a second and
// presses in a row add up; further out the speed grows with the distance, so a jump to a preset does not crawl.
const SLOW_DEG_PER_S = 5
const SLOW_ZONE_DEG = 10
const CATCH_UP_PER_S = 2
const RAD = Math.PI / 180

export const shortestDelta = (from, to) => ((((to - from + 180) % 360) + 360) % 360) - 180

/**
 * Moves an attitude towards its target for a slice of time, in place. The camera's world (camera-world.html) uses it
 * too, so the video moves exactly like the drawn gimbal.
 * @param {{roll: number, pitch: number, yaw: number}} current - The attitude to move, in degrees
 * @param {{roll: number, pitch: number, yaw: number}} target - Where it is heading, in degrees
 * @param {number} dtMs - How much time passed, in milliseconds
 * @returns {boolean} Whether any axis moved
 */
export const slewToward = (current, target, dtMs) => {
  let moved = false
  for (const axis of ['roll', 'pitch', 'yaw']) {
    const delta = axis === 'yaw' ? shortestDelta(current[axis], target[axis]) : target[axis] - current[axis]
    if (Math.abs(delta) < 0.01) continue
    const speed = SLOW_DEG_PER_S + CATCH_UP_PER_S * Math.max(0, Math.abs(delta) - SLOW_ZONE_DEG)
    current[axis] += Math.sign(delta) * Math.min(Math.abs(delta), (speed * dtMs) / 1000)
    if (axis === 'yaw') current.yaw = shortestDelta(0, current.yaw)
    moved = true
  }
  return moved
}

const mesh = (geometry, material, [x, y, z] = [0, 0, 0]) => {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  return m
}

// A motor is a cylinder along the given axis with a kelp ring, the one accent in the model.
const motor = (axis, materials, position) => {
  const group = new THREE.Group()
  group.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.26, 40), materials.motor))
  group.add(mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 40), materials.accent, [0, 0.08, 0]))
  if (axis === 'x') group.rotation.z = Math.PI / 2
  if (axis === 'z') group.rotation.x = Math.PI / 2
  group.position.set(...position)
  return group
}

/**
 * Builds the gimbal camera in a container.
 * @param {HTMLElement} container - Where the canvas goes
 * @param {object} options - Options
 * @param {(attitude: {roll: number, pitch: number, yaw: number}) => void} [options.onMove] - Called with the current
 *   attitude, in degrees, on every frame the gimbal moves
 * @returns {{setTarget: Function, setRecording: Function, shutter: Function, destroy: Function}} Controls
 */
export const createGimbalView = (container, { onMove } = {}) => {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  container.append(renderer.domElement)

  const scene = new THREE.Scene()
  const view = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
  view.position.set(6.3, 2.1, 8.2)
  view.lookAt(0, 0.35, 0)
  scene.add(new THREE.HemisphereLight(0xdff3ec, 0x0a1416, 1.6))
  const key = new THREE.DirectionalLight(0xffffff, 2.4)
  key.position.set(5, 7, 6)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x4fa483, 2)
  rim.position.set(-6, 2, -5)
  scene.add(rim)

  const materials = {
    hull: new THREE.MeshStandardMaterial({ color: 0x1d2a2d, roughness: 0.8 }),
    arm: new THREE.MeshStandardMaterial({ color: 0xaab4b6, metalness: 0.35, roughness: 0.35 }),
    motor: new THREE.MeshStandardMaterial({ color: 0x2a3135, metalness: 0.3, roughness: 0.5 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x4fa483, roughness: 0.4 }),
    body: new THREE.MeshStandardMaterial({ color: 0x24292c, metalness: 0.2, roughness: 0.55 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x0d2a3a, emissive: 0x0c3446, metalness: 0.6, roughness: 0.1 }),
    tally: new THREE.MeshStandardMaterial({ color: 0x3a1c1c, emissive: 0x000000 }),
  }

  // The hull it hangs from, and the fixed half of the yaw motor.
  scene.add(mesh(new THREE.BoxGeometry(3.4, 0.18, 2.6), materials.hull, [0, 1.75, 0]))
  scene.add(motor('y', materials, [0, 1.48, 0]))

  // Yaw turns everything below the hull; roll and pitch nest inside it, in the order a real gimbal stacks them.
  const yaw = new THREE.Group()
  yaw.position.y = 1.3
  scene.add(yaw)
  yaw.add(mesh(new THREE.BoxGeometry(0.16, 0.16, 1.3), materials.arm, [0, 0, -0.6]))
  yaw.add(mesh(new THREE.BoxGeometry(0.16, 1.3, 0.16), materials.arm, [0, -0.6, -1.2]))

  const roll = new THREE.Group()
  roll.position.y = -1.3
  yaw.add(roll)
  roll.add(motor('z', materials, [0, 0, -1.08]))
  roll.add(mesh(new THREE.BoxGeometry(1, 0.14, 0.14), materials.arm, [0.45, 0, -0.9]))
  roll.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.95), materials.arm, [0.9, 0, -0.45]))

  const pitch = new THREE.Group()
  roll.add(pitch)
  pitch.add(motor('x', materials, [0.82, 0, 0]))
  pitch.add(mesh(new THREE.BoxGeometry(1.2, 0.82, 0.95), materials.body))
  pitch.add(mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), materials.motor, [-0.25, 0.47, -0.1]))
  const lens = mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.45, 48), materials.motor, [0, 0, 0.68])
  lens.rotation.x = Math.PI / 2
  pitch.add(lens)
  const glass = mesh(new THREE.CircleGeometry(0.25, 48), materials.glass, [0, 0, 0.91])
  pitch.add(glass)
  const tally = mesh(new THREE.SphereGeometry(0.06, 16, 16), materials.tally, [0.4, 0.42, 0.3])
  pitch.add(tally)

  const target = { roll: 0, pitch: 0, yaw: 0 }
  const current = { roll: 0, pitch: 0, yaw: 0 }
  let recording = false
  let flashUntil = 0
  let last = performance.now()

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container
    if (!w || !h) return
    renderer.setSize(w, h, false)
    view.aspect = w / h
    view.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  let animation

  const frame = (now) => {
    // The first frame's timestamp can predate `last`, which would step backwards.
    const moved = slewToward(current, target, Math.min(Math.max(now - last, 0), 100))
    last = now
    // The lens faces +z: yaw right turns it towards -x, pitch up raises it, roll right drops its right side.
    yaw.rotation.y = -current.yaw * RAD
    roll.rotation.z = current.roll * RAD
    pitch.rotation.x = -current.pitch * RAD
    tally.material.emissive.setHex(recording && Math.floor(now / 500) % 2 === 0 ? 0xff2a2a : 0x000000)
    glass.material.emissive.setHex(now < flashUntil ? 0xffffff : 0x0c3446)
    if (moved) onMove?.({ ...current })
    renderer.render(scene, view)
    animation = requestAnimationFrame(frame)
  }
  resize()
  animation = requestAnimationFrame(frame)

  return {
    setTarget(next) {
      Object.assign(target, next)
    },
    setRecording(on) {
      recording = on
    },
    shutter() {
      flashUntil = performance.now() + 180
    },
    destroy() {
      cancelAnimationFrame(animation)
      observer.disconnect()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
