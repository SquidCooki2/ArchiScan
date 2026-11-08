/* oxlint-disable react/immutability -- Camera fitting intentionally mutates Three.js engine objects. */
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { HERO_SIDE_BY_SIDE } from '../../lib/useHeroLayout'

// Look from the image's bottom edge toward its top, slightly from the right.
const VIEW_DIRECTION = new THREE.Vector3(0.3, 0.9, 1).normalize()
// Low and turned for the landing page, so the building reads as a building, not a roof.
const HERO_DIRECTION = new THREE.Vector3(0.75, 0.55, 1).normalize()
// Steep enough to see the floor between plan-cut walls.
const PLAN_DIRECTION = new THREE.Vector3(0.1, 1.5, 1).normalize()

/** Fit across aspect ratios; user interaction cancels the camera glide. */
export default function CameraRig({ bounds, fitKey, reducedMotion, hasModel, active = true, height = WALL_HEIGHT, view = 'perspective', framing = 'panel' }) {
  const get = useThree(state => state.get)
  const controls = useThree(state => state.controls)
  const size = useThree(state => state.size)
  const goal = useRef(null)
  const wasActive = useRef(active)
  const lastFit = useRef(null)
  // Read at fit time, so choosing a different roof doesn't pull the camera away from the user.
  const fitHeight = useRef(height)
  useLayoutEffect(() => { fitHeight.current = height }, [height])

  useEffect(() => {
    if (!controls) return
    const returning = active && !wasActive.current
    wasActive.current = active
    if (!active) { goal.current = null; return }
    const previous = lastFit.current
    if (returning && previous?.bounds === bounds && previous.fitKey === fitKey && previous.view === view && previous.framing === framing && previous.width === size.width && previous.height === size.height) return
    lastFit.current = { bounds, fitKey, view, framing, width: size.width, height: size.height }
    const { camera } = get()
    const vertical = THREE.MathUtils.degToRad(camera.fov)
    const mobile = size.width < 640
    // Frame the space the interface leaves free, so the model stays visible while a slider is used.
    const hero = framing === 'hero'
    const heroBeside = hero && window.matchMedia(HERO_SIDE_BY_SIDE).matches
    const availableWidth = heroBeside ? size.width * 0.5 : hero ? size.width - 16 : Math.max(120, size.width - (mobile ? 32 : 360))
    const top = hero ? (mobile ? 64 : 72) : mobile ? 112 : Math.min(112, size.height * 0.18)
    const bottom = heroBeside ? 32 : hero ? size.height * 0.52 : mobile ? size.height * 0.42 + 24 : 24
    const availableHeight = Math.max(100, size.height - top - bottom)
    const verticalFit = 2 * Math.atan(Math.tan(vertical / 2) * availableHeight / size.height)
    const horizontalFit = 2 * Math.atan(Math.tan(vertical / 2) * availableWidth / size.height)
    const radius = Math.hypot(bounds.width, bounds.depth, fitHeight.current) / 2
    const distance = radius / Math.sin(Math.min(verticalFit, horizontalFit) / 2) * 1.15
    if (hasModel) {
      const centerX = heroBeside ? size.width * 0.72 : hero || mobile ? size.width / 2 : availableWidth / 2 + 8
      const centerY = top + availableHeight / 2
      camera.setViewOffset(size.width, size.height, size.width / 2 - centerX, size.height / 2 - centerY, size.width, size.height)
    } else {
      camera.clearViewOffset()
    }
    const target = new THREE.Vector3(0, fitHeight.current / 2, 0)
    const position = target.clone().addScaledVector(hero ? HERO_DIRECTION : view === 'plan' ? PLAN_DIRECTION : VIEW_DIRECTION, distance)
    camera.near = Math.max(0.01, distance / 1000)
    camera.far = Math.max(200, distance * 12)
    camera.updateProjectionMatrix()
    controls.minDistance = Math.max(0.5, bounds.size * 0.15)
    controls.maxDistance = distance * 3
    if (reducedMotion) {
      camera.position.copy(position)
      controls.target.copy(target)
      controls.update()
      goal.current = null
    } else {
      goal.current = { position, target }
    }
    const cancel = () => { goal.current = null }
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [get, controls, bounds, fitKey, reducedMotion, hasModel, active, view, framing, size.width, size.height])

  useFrame((_, delta) => {
    const g = goal.current
    if (!g || !controls) return
    const { camera } = get()
    const k = 1 - Math.exp(-delta * 3.5)
    camera.position.lerp(g.position, k)
    controls.target.lerp(g.target, k)
    controls.update()
    if (camera.position.distanceToSquared(g.position) < 1e-4) {
      camera.position.copy(g.position)
      controls.target.copy(g.target)
      controls.update()
      goal.current = null
    }
  })
  return null
}
