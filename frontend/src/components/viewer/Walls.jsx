/* oxlint-disable react/immutability -- Three.js materials and clipping planes are mutable engine objects. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { WALL_HEIGHT } from '../../lib/geometry'
import { capPositions, cutPlane, partitionFootprint, prismPositions, sectionCap, wallFootprint } from '../../lib/sections'
import { useReducedMotion } from '../../lib/useReducedMotion'

function geometryFromPositions(positions) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function Wall({ wall, index, bounds, section, area, selected, selecting, onSelect, materials, reducedMotion, plane }) {
  const body = useRef()
  const verticalCaps = useRef()
  const horizontalCaps = useRef()
  const elapsed = useRef(0)
  const footprint = useMemo(() => wallFootprint(wall, bounds), [wall, bounds])
  const region = section.scope === 'area' ? area : null
  const pieces = useMemo(() => {
    const parts = region ? partitionFootprint(footprint, region) : [{ points: footprint, inside: false }]
    return parts.map(part => ({ ...part, geometry: geometryFromPositions(prismPositions(part.points)) }))
  }, [footprint, region])
  const affected = section.enabled && (section.scope === 'all' || (section.scope === 'walls' && selected))
  const caps = useMemo(() => pieces.map(piece => {
    const clipped = affected || (section.enabled && section.scope === 'area' && piece.inside)
    if (!clipped) return null
    const positions = capPositions(sectionCap(piece.points, bounds, section))
    return positions.length ? geometryFromPositions(positions) : null
  }), [pieces, affected, bounds, section])
  useEffect(() => () => pieces.forEach(piece => piece.geometry.dispose()), [pieces])
  useEffect(() => () => caps.forEach(cap => cap?.dispose()), [caps])

  useFrame((_, delta) => {
    elapsed.current += delta
    const t = reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed.current - Math.min(index * 0.035, 0.45)) / 0.6, 0, 1)
    const scale = Math.max(0.0001, 1 - (1 - t) ** 3)
    body.current.scale.y = scale
    verticalCaps.current.scale.y = scale
    horizontalCaps.current.visible = section.enabled && section.position <= WALL_HEIGHT * scale
  })

  function select(event, clipped) {
    if (!selecting || event.delta > 4 || (clipped && plane.distanceToPoint(event.point) < -0.0001)) return
    event.stopPropagation()
    onSelect(index)
  }

  return <group>
    <group ref={body} scale-y={reducedMotion ? 1 : 0.0001}>
      {pieces.map((piece, i) => {
        const clipped = affected || (section.enabled && section.scope === 'area' && piece.inside)
        const material = (selected && section.scope === 'walls') || (section.scope === 'area' && piece.inside)
          ? clipped ? materials.selectedCut : materials.selected
          : clipped ? materials.cut : materials.solid
        return <mesh key={i} geometry={piece.geometry} material={material} castShadow receiveShadow
          onClick={event => select(event, clipped)} userData={{ wallIndex: index }} />
      })}
    </group>
    <group ref={verticalCaps}>
      {section.axis !== 'y' && caps.map((geometry, i) => geometry && <mesh key={i} geometry={geometry} material={materials.cap} onClick={event => select(event, false)} />)}
    </group>
    <group ref={horizontalCaps}>
      {section.axis === 'y' && caps.map((geometry, i) => geometry && <mesh key={i} geometry={geometry} material={materials.cap} onClick={event => select(event, false)} />)}
    </group>
  </group>
}

export default function Walls({ walls, bounds, section, area, selectedWalls, selecting, onSelect }) {
  const plane = useMemo(() => new THREE.Plane(), [])
  const materials = useMemo(() => {
    const options = { color: '#e8e6e1', roughness: 0.85, metalness: 0, side: THREE.DoubleSide }
    return {
      solid: new THREE.MeshStandardMaterial(options),
      cut: new THREE.MeshStandardMaterial({ ...options, clippingPlanes: [plane], clipShadows: true }),
      selected: new THREE.MeshStandardMaterial({ ...options, color: '#a5b4fc', emissive: '#312e81', emissiveIntensity: 0.2 }),
      selectedCut: new THREE.MeshStandardMaterial({ ...options, color: '#a5b4fc', emissive: '#312e81', emissiveIntensity: 0.2, clippingPlanes: [plane], clipShadows: true }),
      cap: new THREE.MeshBasicMaterial({ color: '#a5b4fc', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    }
  }, [plane])
  const reducedMotion = useReducedMotion()
  useLayoutEffect(() => {
    const definition = cutPlane(bounds, section)
    plane.normal.set(definition.normal.x, definition.normal.y, definition.normal.z)
    plane.constant = definition.constant
  }, [plane, bounds, section])
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])
  return <group>
    {walls.map((wall, index) => <Wall key={index} wall={wall} index={index} bounds={bounds} section={section} area={area}
      selected={selectedWalls.includes(index)} selecting={selecting} onSelect={onSelect} materials={materials} reducedMotion={reducedMotion} plane={plane} />)}
  </group>
}
