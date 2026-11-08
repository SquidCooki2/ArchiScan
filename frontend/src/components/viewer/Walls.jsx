/* oxlint-disable react/immutability -- Three.js materials and clipping planes are mutable engine objects. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { elementFloor, elementType, floorBase, floorCount, WALL_HEIGHT } from '../../lib/geometry'
import { elementParts } from '../../lib/elementParts'
import { capPositions, cutPlane, partitionFootprint, prismPositions, sectionCap, wallFootprint } from '../../lib/sections'
import { useReducedMotion } from '../../lib/useReducedMotion'
import { CARD, CUT, CUT_TINT } from './colors'

function geometryFromPositions(positions) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function Wall({ wall, index, bounds, section, area, materials, reducedMotion, openDoors, top, visible }) {
  const body = useRef()
  const verticalCaps = useRef()
  const horizontalCaps = useRef()
  const elapsed = useRef(0)
  const parts = useMemo(() => elementParts(wall, { openDoors }), [wall, openDoors])
  const base = floorBase(elementFloor(wall))
  const region = section.scope === 'area' ? area : null
  const pieces = useMemo(() => {
    return parts.flatMap(part => {
      const footprint = wallFootprint(part, bounds)
      const pieces = region ? partitionFootprint(footprint, region) : [{ points: footprint, inside: false }]
      const bottom = part.bottom + base, partTop = part.top + base
      return pieces.map(piece => ({ ...piece, role: part.role, bottom, top: partTop,
        geometry: geometryFromPositions(prismPositions(piece.points, partTop, bottom)) }))
    })
  }, [parts, bounds, region, base])
  const affected = section.enabled && section.scope === 'all'
  const caps = useMemo(() => pieces.map(piece => {
    const clipped = affected || (section.enabled && section.scope === 'area' && piece.inside)
    if (!clipped) return null
    const positions = capPositions(sectionCap(piece.points, bounds, section, piece.bottom, piece.top))
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
    horizontalCaps.current.visible = section.enabled && section.position <= top * scale
  })

  const details = { elementIndex: index, elementType: elementType(wall), floor: elementFloor(wall) }
  return <group visible={visible}>
    <group ref={body} scale-y={reducedMotion ? 1 : 0.0001}>
      {pieces.map((piece, i) => {
        const clipped = affected || (section.enabled && section.scope === 'area' && piece.inside)
        const palette = materials[piece.role]
        const material = section.scope === 'area' && piece.inside
          ? clipped ? palette.selectedCut : palette.selected
          : clipped ? palette.cut : palette.solid
        return <mesh key={i} geometry={piece.geometry} material={material} castShadow={piece.role !== 'glass'} receiveShadow={piece.role !== 'glass'} userData={{ ...details, part: piece.role }} />
      })}
    </group>
    <group ref={verticalCaps}>
      {section.axis !== 'y' && caps.map((geometry, i) => geometry && <mesh key={i} geometry={geometry} material={materials.cap} userData={{ ...details, part: 'cap', sourceRole: pieces[i].role }} />)}
    </group>
    <group ref={horizontalCaps}>
      {section.axis === 'y' && caps.map((geometry, i) => geometry && <mesh key={i} geometry={geometry} material={materials.cap} userData={{ ...details, part: 'cap', sourceRole: pieces[i].role }} />)}
    </group>
  </group>
}

export default function Walls({ walls, bounds, section, area, openDoors = false, visibleFloor = 'all' }) {
  const plane = useMemo(() => new THREE.Plane(), [])
  const materials = useMemo(() => {
    const palettes = {
      wall: { color: CARD, roughness: 0.85, metalness: 0 },
      frame: { color: '#5b626b', roughness: 0.45, metalness: 0.2 },
      glass: { color: '#93c5fd', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35, depthWrite: false },
      door: { color: '#a47c58', roughness: 0.7, metalness: 0 },
      doorPanel: { color: '#876347', roughness: 0.7, metalness: 0 },
      hardware: { color: '#c9b58a', roughness: 0.25, metalness: 0.8 },
    }
    const result = {}
    for (const [role, options] of Object.entries(palettes)) {
      const Material = THREE.MeshStandardMaterial
      const base = { ...options, side: THREE.DoubleSide }
      const highlighted = { ...base, color: CUT_TINT }
      result[role] = {
        solid: new Material(base),
        cut: new Material({ ...base, clippingPlanes: [plane], clipShadows: true }),
        selected: new Material(highlighted),
        selectedCut: new Material({ ...highlighted, clippingPlanes: [plane], clipShadows: true }),
      }
    }
    result.cap = new THREE.MeshBasicMaterial({ color: CUT, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    return result
  }, [plane])
  const reducedMotion = useReducedMotion()
  useLayoutEffect(() => {
    const definition = cutPlane(bounds, section)
    plane.normal.set(definition.normal.x, definition.normal.y, definition.normal.z)
    plane.constant = definition.constant
  }, [plane, bounds, section])
  useEffect(() => () => Object.entries(materials).forEach(([key, palette]) => { if (key === 'cap') palette.dispose(); else Object.values(palette).forEach(material => material.dispose()) }), [materials])
  const top = floorCount(walls) * WALL_HEIGHT
  return <group>
    {walls.map((wall, index) => <Wall key={index} wall={wall} index={index} bounds={bounds} section={section} area={area}
      materials={materials} reducedMotion={reducedMotion} openDoors={openDoors} top={top} visible={visibleFloor === 'all' || elementFloor(wall) <= visibleFloor} />)}
  </group>
}
