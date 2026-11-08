/* oxlint-disable react/immutability -- First-person navigation intentionally updates the Three.js camera and OrbitControls. */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE_HEIGHT, humanFov, placementAt, stairHint, walkHeight, walkingVector, walkStep } from '../../lib/walkthrough'

const keyDirection = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }
const keyTurn = { KeyQ: -1, KeyE: 1 }
const TURN_SPEED = 1.6
const LOOK_SPEED = 0.002, DRAG_LOOK_SPEED = 0.0025
// Some mice report one huge jump when the pointer locks, which would spin the view.
const MAX_LOOK_STEP = 180
// Browsers use the Esc press that frees the pointer. Only a later press means leave.
const ESC_GRACE_MS = 250
const canLock = () => typeof document !== 'undefined' && 'pointerLockElement' in document && Boolean(window.matchMedia?.('(pointer: fine)').matches)

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

/**
 * First-person view. With a mouse, the pointer is hidden and moving the mouse looks around, as in a
 * first-person game. Esc gives the pointer back, and a click takes it again. Touch screens, or a
 * browser that refuses the lock, drag to look instead. Mounted only while walking.
 */
export default function HumanCamera({ spawn, building, movement, reducedMotion, onExit, onTransition, onFloor, onLock, onStairs }) {
  const get = useThree(state => state.get)
  const size = useThree(state => state.size)
  const overview = useRef(null)
  const pressed = useRef(new Set())
  const yaw = useRef(0), pitch = useRef(0)
  const velocity = useRef({ x: 0, z: 0 })
  const transition = useRef(0)
  const look = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const floor = useRef(0)
  const hint = useRef(null)

  useLayoutEffect(() => {
    const { camera, controls } = get()
    // The orbit controls register after this runs when the viewer mounts already walking.
    overview.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls ? controls.target.clone() : new THREE.Vector3(),
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
    hint.current = null
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
    let waiting = null
    let unlockedAt = -Infinity
    const isLocked = () => document.pointerLockElement === canvas
    const clear = () => { pressed.current.clear(); movement.current = {}; velocity.current = { x: 0, z: 0 }; drag = null; waiting = null }
    const rotate = (dx, dy, speed) => { yaw.current -= dx * speed; pitch.current = THREE.MathUtils.clamp(pitch.current - dy * speed, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08) }
    const lock = () => {
      if (!canLock() || isLocked()) return
      try { Promise.resolve(canvas.requestPointerLock()).catch(refused) } catch { refused() }
    }
    // Browsers refuse just after Esc, or without a recent click. Dragging to look still works then.
    const refused = () => { drag = waiting; waiting = null }
    const down = event => {
      if (event.code === 'Escape') {
        event.preventDefault()
        if (!isLocked() && performance.now() - unlockedAt > ESC_GRACE_MS) onExit()
        return
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (!keyDirection[event.code] && !keyTurn[event.code]) return
      event.preventDefault()
      pressed.current.add(event.code)
    }
    const up = event => pressed.current.delete(event.code)
    const pointerDown = event => {
      if (event.button !== 0) return
      const start = { id: event.pointerId, x: event.clientX, y: event.clientY }
      if (event.pointerType === 'mouse' && canLock()) { if (!isLocked()) { waiting = start; lock() } return }
      drag = start
      canvas.setPointerCapture(event.pointerId)
    }
    const pointerMove = event => {
      if (!drag || drag.id !== event.pointerId) return
      rotate(event.clientX - drag.x, event.clientY - drag.y, DRAG_LOOK_SPEED)
      drag.x = event.clientX; drag.y = event.clientY
    }
    const pointerUp = event => {
      waiting = null
      if (!drag || drag.id !== event.pointerId) return
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    const mouseMove = event => {
      if (!isLocked()) return
      const limit = value => THREE.MathUtils.clamp(value, -MAX_LOOK_STEP, MAX_LOOK_STEP)
      rotate(limit(event.movementX), limit(event.movementY), LOOK_SPEED)
    }
    const lockChange = () => {
      const locked = isLocked()
      if (locked) { drag = null; waiting = null } else { unlockedAt = performance.now(); clear() }
      onLock(locked)
    }
    const visibility = () => { if (document.hidden) clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('pointerlockchange', lockChange)
    document.addEventListener('pointerlockerror', refused)
    document.addEventListener('mousemove', mouseMove)
    canvas.addEventListener('pointerdown', pointerDown)
    canvas.addEventListener('pointermove', pointerMove)
    canvas.addEventListener('pointerup', pointerUp)
    canvas.addEventListener('pointercancel', clear)
    // The click or key that started the walk still counts as permission to take the pointer.
    lock()
    return () => {
      clear()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('pointerlockchange', lockChange)
      document.removeEventListener('pointerlockerror', refused)
      document.removeEventListener('mousemove', mouseMove)
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', clear)
      if (isLocked()) document.exitPointerLock()
      onLock(false)
    }
  }, [get, movement, onExit, onLock])

  useFrame((_, delta) => {
    if (transition.current > 0) {
      transition.current = Math.max(0, transition.current - Math.min(delta, 0.1))
      if (!transition.current) onTransition(false)
      return
    }
    const { camera } = get()
    const keys = pressed.current
    const held = direction => movement.current[direction] || [...keys].some(key => keyDirection[key] === direction)
    const dt = Math.min(delta, 0.25), acceleration = 1 - Math.exp(-12 * dt)
    for (const key of keys) if (keyTurn[key]) yaw.current -= keyTurn[key] * TURN_SPEED * dt
    const vector = walkingVector(Number(Boolean(held('forward'))) - Number(Boolean(held('backward'))), Number(Boolean(held('right'))) - Number(Boolean(held('left'))), yaw.current)
    // Collision substeps keep longer frames safe without slowing real-world pace.
    velocity.current.x += (vector.x - velocity.current.x) * acceleration
    velocity.current.z += (vector.z - velocity.current.z) * acceleration
    const next = walkStep({ x: camera.position.x, z: camera.position.z, floor: floor.current }, { x: velocity.current.x * dt, z: velocity.current.z * dt }, building)
    if (next.floor !== floor.current) { floor.current = next.floor; onFloor(next.floor) }
    const near = stairHint(next, building)
    const label = near && `${near.direction}-${near.floor}`
    if (label !== hint.current) { hint.current = label; onStairs(near) }
    // Eye height eases toward the step underfoot, so climbing feels like walking, not an elevator.
    const eye = walkHeight(next, building) + EYE_HEIGHT
    camera.position.set(next.x, camera.position.y + (eye - camera.position.y) * (1 - Math.exp(-12 * dt)), next.z)
    camera.quaternion.setFromEuler(look.current.set(pitch.current, yaw.current, 0, 'YXZ'))
  })
  return null
}
