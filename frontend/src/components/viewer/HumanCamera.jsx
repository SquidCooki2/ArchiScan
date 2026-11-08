/* oxlint-disable react/immutability -- First-person navigation intentionally updates the Three.js camera and OrbitControls. */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE_HEIGHT, humanFov, placementAt, walkHeight, walkingVector, walkStep } from '../../lib/walkthrough'

const keyDirection = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }

function restore(get, snapshot) {
  if (!snapshot) return
  const { camera, controls, size } = get()
  if (!camera || !controls) return
  const damping = controls.enableDamping
  controls.enableDamping = false
  controls.update()
  camera.position.copy(snapshot.position)
  camera.quaternion.copy(snapshot.quaternion)
  camera.fov = snapshot.fov
  camera.near = snapshot.near
  camera.far = snapshot.far
  camera.zoom = snapshot.zoom
  if (snapshot.view?.enabled) {
    const v = snapshot.view
    camera.setViewOffset(size.width, size.height, v.offsetX / v.fullWidth * size.width, v.offsetY / v.fullHeight * size.height, size.width, size.height)
  } else camera.clearViewOffset()
  camera.updateProjectionMatrix()
  controls.target.copy(snapshot.target)
  controls.update()
  controls.enableDamping = damping
}

/** First-person view: keys or on-screen arrows to walk, drag to look. Mounted only while walking. */
export default function HumanCamera({ spawn, building, movement, reducedMotion, onExit, onTransition, onFloor }) {
  const get = useThree(state => state.get)
  const size = useThree(state => state.size)
  const overview = useRef(null)
  const pressed = useRef(new Set())
  const yaw = useRef(0), pitch = useRef(0)
  const velocity = useRef({ x: 0, z: 0 })
  const transition = useRef(0)
  const look = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const floor = useRef(0)

  useLayoutEffect(() => {
    const { camera, controls } = get()
    overview.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone(),
      fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom, view: camera.view ? { ...camera.view } : null }
    return () => {
      restore(get, overview.current)
      onTransition(false)
    }
  }, [get, onTransition])

  useLayoutEffect(() => {
    pressed.current.clear()
    velocity.current = { x: 0, z: 0 }
    movement.current = {}
    const world = building.floors[spawn.floor]
    if (!placementAt(spawn, world).valid) { onExit(); return }
    floor.current = spawn.floor
    const { camera } = get()
    camera.clearViewOffset()
    camera.zoom = 1
    camera.fov = humanFov(size.width / size.height)
    camera.near = 0.05
    camera.far = Math.max(100, (world.maxX - world.minX + world.maxZ - world.minZ) * 5)
    camera.position.set(spawn.x, world.floorY + EYE_HEIGHT, spawn.z)
    yaw.current = Math.hypot(spawn.x, spawn.z) > 0.05 ? Math.atan2(spawn.x, spawn.z) : 0
    pitch.current = 0
    camera.quaternion.setFromEuler(look.current.set(0, yaw.current, 0, 'YXZ'))
    camera.updateProjectionMatrix()
    // Fade into a validated position rather than flying through walls or ceilings.
    transition.current = reducedMotion ? 0 : 0.35
    onTransition(!reducedMotion)
    // Resize updates projection separately, without resetting the person's location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spawn, building, get, movement, reducedMotion, onExit, onTransition])

  useEffect(() => {
    const { camera } = get()
    camera.fov = humanFov(size.width / size.height)
    camera.aspect = size.width / size.height
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [get, size.width, size.height])

  useEffect(() => {
    const { gl } = get()
    const canvas = gl.domElement
    let drag = null
    const clear = () => { pressed.current.clear(); movement.current = {}; velocity.current = { x: 0, z: 0 }; drag = null }
    const rotate = (dx, dy) => { yaw.current -= dx * 0.0025; pitch.current = THREE.MathUtils.clamp(pitch.current - dy * 0.0025, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08) }
    const down = event => {
      if (event.code === 'Escape') { event.preventDefault(); onExit(); return }
      if (!keyDirection[event.code] || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      pressed.current.add(event.code)
    }
    const up = event => pressed.current.delete(event.code)
    const pointerDown = event => {
      if (event.button !== 0) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture(event.pointerId)
    }
    const pointerMove = event => {
      if (!drag || drag.id !== event.pointerId) return
      rotate(event.clientX - drag.x, event.clientY - drag.y)
      drag.x = event.clientX; drag.y = event.clientY
    }
    const pointerUp = event => {
      if (!drag || drag.id !== event.pointerId) return
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    const visibility = () => { if (document.hidden) clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', clear)
    return () => {
      clear()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', clear)
    }
  }, [get, movement, onExit])

  useFrame((_, delta) => {
    if (transition.current > 0) {
      transition.current = Math.max(0, transition.current - Math.min(delta, 0.1))
      if (!transition.current) onTransition(false)
      return
    }
    const { camera } = get()
    const keys = pressed.current
    const held = direction => movement.current[direction] || [...keys].some(key => keyDirection[key] === direction)
    const vector = walkingVector(Number(Boolean(held('forward'))) - Number(Boolean(held('backward'))), Number(Boolean(held('right'))) - Number(Boolean(held('left'))), yaw.current)
    // Collision substeps keep longer frames safe without slowing real-world pace.
    const dt = Math.min(delta, 0.25), acceleration = 1 - Math.exp(-12 * dt)
    velocity.current.x += (vector.x - velocity.current.x) * acceleration
    velocity.current.z += (vector.z - velocity.current.z) * acceleration
    const next = walkStep({ x: camera.position.x, z: camera.position.z, floor: floor.current }, { x: velocity.current.x * dt, z: velocity.current.z * dt }, building)
    if (next.floor !== floor.current) { floor.current = next.floor; onFloor(next.floor) }
    // Eye height eases toward the step underfoot, so climbing feels like walking, not an elevator.
    const eye = walkHeight(next, building) + EYE_HEIGHT
    camera.position.set(next.x, camera.position.y + (eye - camera.position.y) * (1 - Math.exp(-12 * dt)), next.z)
    camera.quaternion.setFromEuler(look.current.set(pitch.current, yaw.current, 0, 'YXZ'))
  })
  return null
}
