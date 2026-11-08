import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { cutCoordinate } from '../../lib/sections'
import SceneHandle from './SceneHandle'
import { useSceneDrag } from './useSceneDrag'

/** Drag along the cut axis in a camera-facing plane containing that axis. */
export default function CutPlaneHandle({ bounds, targetBounds, section, area, top, range, onPosition, onDragging }) {
  const get = useThree(state => state.get)
  const drag = useSceneDrag(onDragging)
  const extent = section.scope === 'area' && area ? area : targetBounds
  const cx = (extent.minX + extent.maxX) / 2
  const coordinate = cutCoordinate(bounds, section)
  const position = section.axis === 'y' ? [cx, coordinate, extent.maxZ + 0.3]
    : section.axis === 'x' ? [coordinate, top / 2, extent.maxZ + 0.3]
      : [extent.maxX + 0.3, top / 2, coordinate]
  return <group>
    <SceneHandle name="cut-plane-handle" position={position}
      onPointerDown={event => {
        const { camera } = get()
        const axis = new THREE.Vector3(section.axis === 'x' ? 1 : 0, section.axis === 'y' ? 1 : 0, section.axis === 'z' ? 1 : 0)
        const normal = camera.getWorldDirection(new THREE.Vector3())
        normal.addScaledVector(axis, -normal.dot(axis))
        if (normal.lengthSq() < 0.00001) return
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal.normalize(), new THREE.Vector3(...position))
        drag.start(event, plane, (point, start) => onPosition(Math.max(range.min, Math.min(range.max, section.position + point[section.axis] - start[section.axis]))), () => onPosition(section.position))
      }} {...drag.handlers} />
    <Html center position={[position[0], position[1] + 0.4, position[2]]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
      <span className="rounded-md bg-[#171c22]/90 px-2 py-1 text-xs text-slate-200">Drag to move the cut</span>
    </Html>
  </group>
}
