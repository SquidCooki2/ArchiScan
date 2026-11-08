/* oxlint-disable react/immutability -- Three.js materials and clipping planes are mutable engine objects. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { elementFloor, elementType, floorBase, floorCount, isEnclosure, WALL_HEIGHT } from '../../lib/geometry'
import { lineCrosses } from '../../lib/furniture'
import { surfaceUvs } from '../../lib/surfaceUv'
import { elementParts, STAIR_STEPS, structuralElements } from '../../lib/elementParts'
import { capPositions, cutPlane, partitionFootprint, prismPositions, sectionCap, wallFootprint } from '../../lib/sections'
import { useReducedMotion } from '../../lib/useReducedMotion'
import { CARD, CUT, CUT_TINT, STRING } from './colors'
import { surfaces } from './surfaces'

// Plans round to the centimeter, which can leave hairline gaps between wall pieces. A slightly slimmer core
// reaches past each end to fill them. Its faces sit behind the wall's, because flush overlaps drew seam lines.
const CORE_REACH = 0.012
const CORE_DEPTH = 0.8
const CORE_INSET = 0.002
const STEP_RISE = WALL_HEIGHT / STAIR_STEPS

/** The filler behind a piece, or null. A stair side stops one step short, so it can't show above the step below. */
function coreOf(part, type) {
  const top = type === 'stairs' && part.role === 'string' ? part.top - STEP_RISE
    : isEnclosure({ type }) && part.role === 'wall' ? part.top - CORE_INSET : null
  if (top === null || top - part.bottom <= CORE_INSET * 2) return null
  return { ...part, width: part.width + CORE_REACH * 2, depth: part.depth * CORE_DEPTH, bottom: part.bottom + CORE_INSET, top }
}
const NO_SHELL = []

function geometryFromPositions(positions) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(surfaceUvs(positions), 2))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

// Corners land on this grid, so pieces that meet share exact coordinates and no crack opens between them.
const WELD = 1e4
const welded = points => points.map(({ x, z }) => ({ x: Math.round(x * WELD) / WELD, z: Math.round(z * WELD) / WELD }))

/** A prism's corners, lifted along its own length for a part that follows a slope. */
function prismVertices({ points, top, bottom, slope, origin }) {
  const positions = prismPositions(welded(points), top, bottom)
  if (!slope) return positions
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] += slope * ((positions[i] - origin.x) * origin.c + (positions[i + 2] - origin.z) * origin.s)
  }
  return positions
}

/** Sorts a prism's triangles, inside faces first, so outside ones can take their own material. */
function splitOutside(positions, shell, reach) {
  const inside = [], outside = []
  for (let t = 0; t < positions.length; t += 9) {
    const triangle = positions.slice(t, t + 9)
    const ux = triangle[3] - triangle[0], uz = triangle[5] - triangle[2]
    const vx = triangle[6] - triangle[0], vz = triangle[8] - triangle[2]
    const uy = triangle[4] - triangle[1], vy = triangle[7] - triangle[1]
    let nx = uy * vz - uz * vy, nz = ux * vy - uy * vx
    const length = Math.hypot(nx, nz)
    let open = false
    if (length > 1e-6) {
      nx /= length; nz /= length
      const middle = { x: (triangle[0] + triangle[3] + triangle[6]) / 3, z: (triangle[2] + triangle[5] + triangle[8]) / 3 }
      const candidates = [[nx, nz], [-nx, -nz]]
      // Faces wind either way here, so a face is outside if either direction leaves the building from just off it.
      open = candidates.some(([dx, dz]) => {
        const from = { x: middle.x + dx * 0.03, z: middle.z + dz * 0.03 }
        const insideOwn = shell.some(rect => lineCrosses(from, from, rect))
        return !insideOwn && !shell.some(rect => lineCrosses(from, { x: from.x + dx * reach, z: from.z + dz * reach }, rect))
      })
    }
    (open ? outside : inside).push(...triangle)
  }
  return { positions: [...inside, ...outside], insideCount: inside.length / 3, outsideCount: outside.length / 3 }
}

function Wall({ wall, index, bounds, section, area, materials, reducedMotion, openDoors, top, visible, shell }) {
  const body = useRef()
  const verticalCaps = useRef()
  const horizontalCaps = useRef()
  const elapsed = useRef(0)
  const parts = useMemo(() => elementParts(wall, { openDoors }), [wall, openDoors])
  const base = floorBase(elementFloor(wall))
  const region = section.scope === 'area' ? area : null
  // One mesh per material rather than per prism: a flight of stairs alone is dozens of prisms.
  const pieces = useMemo(() => {
    const groups = new Map()
    const enclosure = isEnclosure(wall)
    for (const part of parts) {
      const core = coreOf(part, elementType(wall))
      for (const shape of core ? [part, core] : [part]) {
        const footprint = wallFootprint(shape, bounds)
        for (const piece of region ? partitionFootprint(footprint, region) : [{ points: footprint, inside: false }]) {
          const key = `${part.role}-${piece.inside}`
          if (!groups.has(key)) groups.set(key, { role: part.role, inside: piece.inside, prisms: [] })
          groups.get(key).prisms.push({ points: piece.points, bottom: shape.bottom + base, top: shape.top + base, slope: part.slope,
            origin: { x: part.x - bounds.cx, z: part.z - bounds.cz, c: Math.cos(part.rotation), s: Math.sin(part.rotation) } })
        }
      }
    }
    return [...groups.values()].map(group => {
      const positions = group.prisms.flatMap(prismVertices)
      if (!enclosure || group.role !== 'wall') return { ...group, geometry: geometryFromPositions(positions) }
      const sides = splitOutside(positions, shell, bounds.size * 2)
      const geometry = geometryFromPositions(sides.positions)
      geometry.addGroup(0, sides.insideCount, 0)
      geometry.addGroup(sides.insideCount, sides.outsideCount, 1)
      return { ...group, geometry, split: true }
    })
  }, [parts, bounds, region, base, shell, wall])
  const affected = section.enabled && section.scope === 'all'
  const caps = useMemo(() => pieces.map(piece => {
    const clipped = affected || (section.enabled && section.scope === 'area' && piece.inside)
    if (!clipped) return null
    const positions = piece.prisms.filter(prism => !prism.slope).flatMap(({ points, bottom, top }) => capPositions(sectionCap(points, bounds, section, bottom, top)))
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
        const state = section.scope === 'area' && piece.inside
          ? clipped ? 'selectedCut' : 'selected'
          : clipped ? 'cut' : 'solid'
        const role = elementType(wall) === 'stairs' && piece.role === 'wall' ? 'tread' : piece.role
        const material = piece.split ? [materials.wall[state], materials.siding[state]] : materials[role][state]
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
    const { plaster, siding, sidingHeight, planks } = surfaces()
    const palettes = {
      wall: { color: CARD, map: plaster, roughness: 0.9, metalness: 0 },
      siding: { color: '#f2eee4', map: siding, bumpMap: sidingHeight, bumpScale: 1.2, roughness: 0.85, metalness: 0 },
      tread: { color: '#ffffff', map: planks, roughness: 0.65, metalness: 0 },
      string: { color: STRING, map: plaster, roughness: 0.8, metalness: 0 },
      frame: { color: '#5b626b', roughness: 0.45, metalness: 0.2 },
      rail: { color: '#a47c58', roughness: 0.6, metalness: 0 },
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
  const elements = useMemo(() => structuralElements(walls), [walls])
  // Each floor's outer walls and openings, centered like the geometry, for telling outside from in.
  const shells = useMemo(() => {
    const byFloor = new Map()
    for (const element of walls.filter(isEnclosure)) {
      const floor = elementFloor(element)
      if (!byFloor.has(floor)) byFloor.set(floor, [])
      byFloor.get(floor).push({ x: element.x - bounds.cx, z: element.z - bounds.cz, width: element.width, depth: element.depth, rotation: element.rotation })
    }
    return byFloor
  }, [walls, bounds])
  return <group>
    {elements.map((wall, index) => <Wall key={index} wall={wall} index={index} bounds={bounds} section={section} area={area}
      materials={materials} reducedMotion={reducedMotion} openDoors={openDoors} top={top} shell={shells.get(elementFloor(wall)) ?? NO_SHELL} visible={visibleFloor === 'all' || elementFloor(wall) <= visibleFloor} />)}
  </group>
}
