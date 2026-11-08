/* oxlint-disable react/immutability -- First-person navigation intentionally updates the Three.js camera and OrbitControls. */
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE_HEIGHT, humanFov, moveWithCollision, placementAt, walkingVector } from '../../lib/walkthrough'

const keyDirection = { KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' }

function restore(get, snapshot) {
  if (!snapshot) return
  const { camera, controls, size } = get()
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

export default function HumanCamera({ mode, spawn, world, bridge, movement, reducedMotion, onExit, onLocked, onTransition }) {
  const get = useThree(state => state.get)
  const size = useThree(state => state.size)
  const overview = useRef(null)
  const pressed = useRef(new Set())
  const yaw = useRef(0), pitch = useRef(0)
  const velocity = useRef({ x: 0, z: 0 })
  const transition = useRef(0)
  const look = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))

  useLayoutEffect(() => {
    const { camera, controls, gl } = get()
    overview.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone(),
      fov: camera.fov, near: camera.near, far: camera.far, zoom: camera.zoom, view: camera.view ? { ...camera.view } : null }
    return () => {
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock()
      restore(get, overview.current)
      onLocked(false)
      onTransition(false)
    }
  }, [get, onLocked, onTransition])

  useLayoutEffect(() => {
    pressed.current.clear()
    velocity.current = { x: 0, z: 0 }
    movement.current = {}
    if (mode !== 'human') { restore(get, overview.current); return }
    if (!placementAt(spawn, world).valid) { onExit(); return }
    const { camera } = get()
    camera.clearViewOffset()
    camera.zoom = 1
    camera.fov = humanFov(size.width / size.height)
    camera.near = 0.05
    camera.far = Math.max(100, (world.maxX - world.minX + world.maxZ - world.minZ) * 5)
    camera.position.set(spawn.x, EYE_HEIGHT, spawn.z)
    yaw.current = Math.hypot(spawn.x, spawn.z) > 0.05 ? Math.atan2(spawn.x, spawn.z) : 0
    pitch.current = 0
    camera.quaternion.setFromEuler(look.current.set(0, yaw.current, 0, 'YXZ'))
    camera.updateProjectionMatrix()
    // Fade into a validated position rather than flying through walls or ceilings.
    transition.current = reducedMotion ? 0 : 0.35
    onTransition(!reducedMotion)
    // Resize updates projection separately, without resetting the person's location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, spawn, world, get, movement, reducedMotion, onExit, onTransition])

  useEffect(() => {
    if (mode !== 'human') return
    const { camera } = get()
    camera.fov = humanFov(size.width / size.height)
    camera.aspect = size.width / size.height
    camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [get, mode, size.width, size.height])

  useEffect(() => {
    if (mode !== 'human') return
    const { gl } = get()
    const canvas = gl.domElement
    let drag = null, hadLock = false
    const clear = () => { pressed.current.clear(); movement.current = {}; velocity.current = { x: 0, z: 0 }; drag = null }
    const rotate = (dx, dy) => { yaw.current -= dx * 0.0025; pitch.current = THREE.MathUtils.clamp(pitch.current - dy * 0.0025, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08) }
    const lock = () => {
      if (transition.current > 0 || !canvas.requestPointerLock) return
      try { canvas.requestPointerLock()?.catch(() => onLocked(false)) } catch { onLocked(false) }
    }
    const api = { lock }
    bridge.current = api
    const down = event => {
      if (event.code === 'Escape') { event.preventDefault(); onExit(); return }
      if (!keyDirection[event.code] || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      pressed.current.add(event.code)
    }
    const up = event => pressed.current.delete(event.code)
    const mouse = event => { if (document.pointerLockElement === canvas) rotate(event.movementX, event.movementY) }
    const pointerDown = event => {
      if (event.button !== 0 || document.pointerLockElement === canvas) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0, touch: event.pointerType === 'touch' }
      canvas.setPointerCapture(event.pointerId)
    }
    const pointerMove = event => {
      if (!drag || drag.id !== event.pointerId || document.pointerLockElement === canvas) return
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y
      drag.moved += Math.abs(dx) + Math.abs(dy)
      rotate(dx, dy)
      drag.x = event.clientX; drag.y = event.clientY
    }
    const pointerUp = event => {
      if (!drag || drag.id !== event.pointerId) return
      const capture = !drag.touch && drag.moved < 4
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      if (capture) lock()
    }
    const lockChange = () => {
      const locked = document.pointerLockElement === canvas
      onLocked(locked)
      if (hadLock && !locked) onExit()
      hadLock = locked
    }
    const visibility = () => { if (document.hidden) clear() }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('mousemove', mouse)
    document.addEventListener('pointerlockchange', lockChange)
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
      document.removeEventListener('mousemove', mouse)
      document.removeEventListener('pointerlockchange', lockChange)
      canvas.removeEventListener('pointerdown', pointerDown)
      canvas.removeEventListener('pointermove', pointerMove)
      canvas.removeEventListener('pointerup', pointerUp)
      canvas.removeEventListener('pointercancel', clear)
      if (document.pointerLockElement === canvas) document.exitPointerLock()
      if (bridge.current === api) bridge.current = null
    }
  }, [get, mode, movement, bridge, onExit, onLocked])

  useFrame((_, delta) => {
    if (mode !== 'human') return
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
    const next = moveWithCollision(camera.position, { x: velocity.current.x * dt, z: velocity.current.z * dt }, world)
    camera.position.set(next.x, EYE_HEIGHT, next.z)
    camera.quaternion.setFromEuler(look.current.set(pitch.current, yaw.current, 0, 'YXZ'))
  })
  return null
}
