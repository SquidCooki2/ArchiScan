import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// Looking from the image's bottom edge (+Z) toward its top, slightly from the right,
// so the model reads in the same orientation as the uploaded plan.
const VIEW_DIRECTION = new THREE.Vector3(0.3, 0.9, 1).normalize()

/** Frames the model whenever `fitKey` changes. Any user drag cancels the glide. */
export default function CameraRig({ bounds, fitKey, reducedMotion }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const aspect = useThree((s) => s.size.width / s.size.height)
  const goal = useRef(null)

  useEffect(() => {
    if (!controls) return
    const portraitBoost = aspect < 1 ? 1 / aspect : 1
    const distance = Math.max(bounds.size, 6) * 1.9 * Math.min(portraitBoost, 2)
    // Aim slightly in front of center so the model sits above the section panel.
    const target = new THREE.Vector3(0, 0, bounds.size * 0.12)
    const position = target.clone().addScaledVector(VIEW_DIRECTION, distance)

    if (reducedMotion) {
      camera.position.copy(position)
      controls.target.copy(target)
      controls.update()
      goal.current = null
      return
    }

    goal.current = { position, target }
    const cancel = () => {
      goal.current = null
    }
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
    // Re-fit on a new model or reset, not on every resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, controls, bounds, reducedMotion])

  useFrame((_, delta) => {
    const g = goal.current
    if (!g || !controls) return
    const k = 1 - Math.exp(-delta * 3.5)
    camera.position.lerp(g.position, k)
    controls.target.lerp(g.target, k)
    controls.update()
    if (camera.position.distanceToSquared(g.position) < 1e-4) goal.current = null
  })

  return null
}
