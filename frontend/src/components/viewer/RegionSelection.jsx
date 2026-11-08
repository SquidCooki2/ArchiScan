import { useEffect, useMemo, useRef, useState } from 'react'
import { Edges, Html } from '@react-three/drei'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { moveSelection, resizeSelection, selectionRectangle, validSelection } from '../../lib/sections'
import SceneHandle from './SceneHandle'
import { useSceneDrag } from './useSceneDrag'

const noRaycast = () => null
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

function SelectionBox({ area, drawing = false }) {
  if (!area) return null
  const width = area.maxX - area.minX, depth = area.maxZ - area.minZ
  if (width <= 0 || depth <= 0) return null
  const cx = (area.minX + area.maxX) / 2, cz = (area.minZ + area.maxZ) / 2
  return <group>
    <mesh name="selected-region-volume" position={[cx, WALL_HEIGHT / 2, cz]} raycast={noRaycast} renderOrder={2}>
      <boxGeometry args={[width, WALL_HEIGHT, depth]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={drawing ? 0.08 : 0.035} depthWrite={false} side={THREE.DoubleSide} />
      <Edges color="#a5b4fc" depthTest={false} transparent opacity={0.85} raycast={noRaycast} />
    </mesh>
    <mesh position={[cx, 0.012, cz]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color="#818cf8" transparent opacity={0.2} depthWrite={false} />
    </mesh>
    <Html center position={[area.minX, WALL_HEIGHT + 0.4, area.minZ]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
      <span className={`${drawing ? 'inline-block' : 'hidden sm:inline-block'} rounded-md border border-indigo-300/30 bg-neutral-950/90 px-2 py-1 text-[10px] text-indigo-200`}>{drawing ? 'Selecting' : 'Selected area'} · {width.toFixed(2)} × {depth.toFixed(2)} m</span>
    </Html>
  </group>
}

function RegionDrawing({ bounds, area, onArea, onCancel }) {
  const anchor = useRef(null)
  const [draft, setDraft] = useState(null)
  const [firstCorner, setFirstCorner] = useState(null)
  const pointAt = event => {
    const point = event.ray.intersectPlane(ground, new THREE.Vector3())
    return point ? { x: point.x, z: point.z } : null
  }
  useEffect(() => {
    const cancel = event => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [onCancel])
  return <group>
    <SelectionBox area={draft ?? area} drawing />
    {firstCorner && <SceneHandle name="selection-first-corner" position={[firstCorner.minX, 0.05, firstCorner.minZ]} color="#e0e7ff" />}
    <mesh name="region-drawing-surface" rotation-x={-Math.PI / 2} position-y={0.002}
      onPointerDown={event => {
        if (event.button !== 0) return
        event.stopPropagation()
        const point = pointAt(event)
        if (!point) return
        if (!anchor.current) {
          anchor.current = point
          setFirstCorner(selectionRectangle(point, point, bounds))
        }
        setDraft(selectionRectangle(anchor.current, point, bounds))
        event.target.setPointerCapture(event.pointerId)
      }}
      onPointerMove={event => {
        if (!anchor.current) return
        event.stopPropagation()
        const point = pointAt(event)
        if (point) setDraft(selectionRectangle(anchor.current, point, bounds))
      }}
      onPointerUp={event => {
        if (!anchor.current) return
        event.stopPropagation()
        const point = pointAt(event)
        if (event.target.hasPointerCapture(event.pointerId)) event.target.releasePointerCapture(event.pointerId)
        if (!point) return
        const next = selectionRectangle(anchor.current, point, bounds)
        if (validSelection(next)) { anchor.current = null; onArea(next) }
        // A single click places the first corner; a second click completes the region.
      }}
      onPointerCancel={() => { anchor.current = null; setDraft(null); setFirstCorner(null); onCancel() }}>
      <planeGeometry args={[bounds.width + 2, bounds.depth + 2]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  </group>
}

function RegionHandles({ bounds, area, onArea, onDragging, position, onPosition }) {
  const drag = useSceneDrag(onDragging)
  const y = WALL_HEIGHT + 0.12
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), [y])
  const cx = (area.minX + area.maxX) / 2, cz = (area.minZ + area.maxZ) / 2
  const cancel = () => { onArea(area); onPosition(position) }
  return <group>
    <SelectionBox area={area} />
    {[['minX', 'minZ'], ['maxX', 'minZ'], ['maxX', 'maxZ'], ['minX', 'maxZ']].map(corner => <SceneHandle
      key={corner.join('-')} name={`selection-corner-${corner.join('-')}`} position={[area[corner[0]], y, area[corner[1]]]}
      onPointerDown={event => drag.start(event, plane, point => onArea(resizeSelection(area, corner, point, bounds)), cancel)} {...drag.handlers} />)}
    <SceneHandle name="selection-move-handle" color="#e0e7ff" position={[cx, y + 0.25, cz]}
      onPointerDown={event => drag.start(event, new THREE.Plane(new THREE.Vector3(0, 1, 0), -y - 0.25), (point, start) => onArea(moveSelection(area, point.x - start.x, point.z - start.z, bounds)), cancel)} {...drag.handlers} />
    <Html center position={[cx, y + 0.65, cz]} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
      <span className="hidden rounded bg-neutral-950/90 px-2 py-1 text-[10px] text-white/60 sm:inline-block">White handle: move · Corners: resize</span>
    </Html>
  </group>
}

export default function RegionSelection({ bounds, area, drawing, onArea, onComplete, onCancel, onDragging, section, onPosition }) {
  return drawing ? <RegionDrawing bounds={bounds} area={area} onArea={onComplete} onCancel={onCancel} />
    : area ? <RegionHandles bounds={bounds} area={area} onArea={onArea} onDragging={onDragging} position={section.position} onPosition={onPosition} /> : null
}
