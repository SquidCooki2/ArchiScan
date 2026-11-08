import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/** Pointer capture and orbit locking shared by selection and cutting handles. */
export function useSceneDrag(onDragging) {
  const get = useThree(state => state.get)
  const drag = useRef(null)
  function finish(cancelled = false) {
    const current = drag.current
    if (!current) return
    drag.current = null
    if (cancelled) current.cancel?.()
    if (current.target.hasPointerCapture?.(current.pointerId)) current.target.releasePointerCapture(current.pointerId)
    current.controls.enabled = current.previousEnabled
    onDragging(false)
  }
  useEffect(() => {
    const cancel = event => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); finish(true) } }
    window.addEventListener('keydown', cancel)
    return () => {
      window.removeEventListener('keydown', cancel)
      const current = drag.current
      if (current) { current.controls.enabled = current.previousEnabled; onDragging(false) }
    }
    // The active operation lives in the ref, including its original cancel callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDragging])
  return {
    start(event, plane, move, cancel) {
      if (event.button !== 0 || drag.current) return
      const point = event.ray.intersectPlane(plane, new THREE.Vector3())
      if (!point) return
      event.stopPropagation()
      const { controls } = get()
      drag.current = { plane, point: point.clone(), move, cancel, controls, previousEnabled: controls.enabled, pointerId: event.pointerId, target: event.target }
      controls.enabled = false
      event.target.setPointerCapture(event.pointerId)
      onDragging(true)
    },
    handlers: {
      onPointerMove(event) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        event.stopPropagation()
        const point = event.ray.intersectPlane(current.plane, new THREE.Vector3())
        if (point) current.move(point, current.point)
      },
      onPointerUp(event) { if (drag.current) { event.stopPropagation(); finish() } },
      onPointerCancel() { finish(true) },
    },
  }
}
