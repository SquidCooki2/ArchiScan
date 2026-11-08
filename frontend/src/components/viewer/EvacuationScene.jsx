/* oxlint-disable react/immutability -- Three.js instance matrices and colors are mutable engine objects. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { pathLength, samplePath, SMOKE_RADIUS } from '../../lib/evacuation'
import { floorBase, PLAN_CUT_HEIGHT } from '../../lib/geometry'
import { useSceneDrag } from './useSceneDrag'

const ROUTE_COLOR = new THREE.Color('#2bf58d')
const ARROW_SPACING = 0.62
const SWEEP_SPEED = 3.2 // meters per second, a brisk walk's lead
const noRaycast = () => null

/** A flat chevron pointing along -Z, the egress marking the whole mode is built around. */
function chevronGeometry() {
  const shape = new THREE.Shape()
  const outline = [[-0.26, -0.2], [0, 0.04], [0.26, -0.2], [0.26, -0.02], [0, 0.22], [-0.26, -0.02]]
  outline.forEach(([x, y], index) => (index ? shape.lineTo(x, y) : shape.moveTo(x, y)))
  const geometry = new THREE.ShapeGeometry(shape)
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

/** A flat band following the path, so the route still reads where a wall hides some arrows. */
function ribbonGeometry(points, width) {
  const positions = [], indices = []
  points.forEach((point, index) => {
    const a = points[Math.max(0, index - 1)], b = points[Math.min(points.length - 1, index + 1)]
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1
    const nx = -(b.z - a.z) / length, nz = (b.x - a.x) / length
    positions.push(point.x + nx * width / 2, point.y, point.z + nz * width / 2, point.x - nx * width / 2, point.y, point.z - nz * width / 2)
    if (index) {
      const v = index * 2
      indices.push(v - 2, v - 1, v, v - 1, v + 1, v)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}

/**
 * The route on the floor. A pulse of light runs from the person to the exit along chevrons, so the
 * direction reads even in a still moment and from any camera angle. Reduced motion holds it steady.
 */
function FloorArrows({ points, ceiling, muted = false, reducedMotion }) {
  const chevron = useMemo(() => chevronGeometry(), [])
  // Anything above the plan cut would hang in the air, since that part of the building is off.
  const samples = useMemo(() => samplePath(points, ARROW_SPACING).filter(sample => sample.y <= ceiling), [points, ceiling])
  const total = useMemo(() => pathLength(points), [points])
  const ribbon = useMemo(() => {
    if (muted) return null
    const line = samplePath(points, 0.12, 0).filter(sample => sample.y <= ceiling)
    return line.length > 1 ? ribbonGeometry(line, 0.62) : null
  }, [points, ceiling, muted])
  const mesh = useRef(null)
  const color = useMemo(() => new THREE.Color(), [])
  useEffect(() => () => chevron.dispose(), [chevron])
  useEffect(() => () => ribbon?.dispose(), [ribbon])

  useLayoutEffect(() => {
    const instanced = mesh.current
    if (!instanced) return
    const dummy = new THREE.Object3D()
    samples.forEach((sample, index) => {
      dummy.position.set(sample.x, sample.y + 0.018, sample.z)
      // Tilted to lie along a flight of stairs. Flat floor has no slope, so no tilt.
      dummy.rotation.set(Math.atan(sample.slope), Math.atan2(-sample.dx, -sample.dz), 0, 'YXZ')
      dummy.updateMatrix()
      instanced.setMatrixAt(index, dummy.matrix)
      instanced.setColorAt(index, color.copy(ROUTE_COLOR).multiplyScalar(muted ? 0.24 : 1))
    })
    instanced.count = samples.length
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
  }, [samples, muted, color])

  useFrame(({ clock }) => {
    const instanced = mesh.current
    if (!instanced || muted || reducedMotion || !instanced.instanceColor) return
    const span = total + 2.5
    const head = (clock.elapsedTime * SWEEP_SPEED) % span
    samples.forEach((sample, index) => {
      const behind = head - sample.along
      const pulse = behind >= 0 && behind < 2.2 ? 1 - behind / 2.2 : 0
      instanced.setColorAt(index, color.copy(ROUTE_COLOR).multiplyScalar(0.55 + pulse * 1.1))
    })
    instanced.instanceColor.needsUpdate = true
  })

  return <group>
    {ribbon && <mesh geometry={ribbon} position-y={0.012} raycast={noRaycast}>
      <meshBasicMaterial color={ROUTE_COLOR} transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>}
    <instancedMesh key={samples.length} ref={mesh} args={[chevron, undefined, Math.max(1, samples.length)]} raycast={noRaycast} frustumCulled={false}>
      <meshBasicMaterial toneMapped={false} side={THREE.DoubleSide} />
    </instancedMesh>
  </group>
}

/** Where the fire can reach on foot, painted on the floor. Walls stop it; doorways let it through. */
function HeatField({ map, field }) {
  const texture = useMemo(() => {
    const { nx, nz, clearance } = map
    const data = new Uint8Array(nx * nz * 4)
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i
        const distance = field[k]
        const onFloor = clearance[k] > 0 && map.inside[k]
        const strength = !onFloor || distance >= SMOKE_RADIUS ? 0 : (1 - distance / SMOKE_RADIUS) ** 1.6
        // Rows are flipped because the plane's texture V axis runs against plan +Z.
        const o = ((nz - 1 - j) * nx + i) * 4
        data[o] = 255; data[o + 1] = 70 + 70 * Math.min(1, distance / SMOKE_RADIUS); data[o + 2] = 30
        data[o + 3] = Math.round(255 * 0.8 * strength)
      }
    }
    const result = new THREE.DataTexture(data, nx, nz, THREE.RGBAFormat)
    result.magFilter = result.minFilter = THREE.LinearFilter
    result.colorSpace = THREE.SRGBColorSpace
    result.needsUpdate = true
    return result
  }, [map, field])
  useEffect(() => () => texture.dispose(), [texture])
  const width = map.nx * map.cell, depth = map.nz * map.cell
  return <mesh rotation-x={-Math.PI / 2} position={[map.originX + width / 2, 0.01, map.originZ + depth / 2]} raycast={noRaycast}>
    <planeGeometry args={[width, depth]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
  </mesh>
}

function FlameBody({ reducedMotion }) {
  const profile = useMemo(() => [[0, 0], [0.13, 0.05], [0.2, 0.18], [0.17, 0.36], [0.1, 0.56], [0.04, 0.74], [0, 0.86]].map(([x, y]) => new THREE.Vector2(x, y)), [])
  const outer = useRef(null), inner = useRef(null)
  useFrame(({ clock }) => {
    if (reducedMotion || !outer.current) return
    const t = clock.elapsedTime
    outer.current.scale.set(1 + Math.sin(t * 9) * 0.05, 1 + Math.sin(t * 13) * 0.09, 1 + Math.cos(t * 8) * 0.05)
    inner.current.scale.set(0.58 + Math.sin(t * 11) * 0.03, 0.62 + Math.cos(t * 15) * 0.07, 0.58 + Math.cos(t * 10) * 0.03)
  })
  return <group scale={1.7}>
    <mesh ref={outer} raycast={noRaycast}><latheGeometry args={[profile, 20]} /><meshBasicMaterial color="#ff6a1f" toneMapped={false} /></mesh>
    <mesh ref={inner} raycast={noRaycast} scale={[0.58, 0.62, 0.58]}><latheGeometry args={[profile, 20]} /><meshBasicMaterial color="#ffd23f" toneMapped={false} depthTest={false} transparent /></mesh>
    <pointLight color="#ff7a2a" intensity={7} distance={7} position={[0, 0.8, 0]} />
  </group>
}

function PersonBody() {
  return <group raycast={noRaycast}>
    <mesh rotation-x={-Math.PI / 2} position-y={0.02} raycast={noRaycast}>
      <ringGeometry args={[0.26, 0.34, 32]} /><meshBasicMaterial color="#ffffff" toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
    <mesh position-y={0.52} raycast={noRaycast}><capsuleGeometry args={[0.15, 0.56, 6, 16]} /><meshBasicMaterial color="#f4f4f5" toneMapped={false} /></mesh>
    <mesh position-y={1.12} raycast={noRaycast}><sphereGeometry args={[0.14, 20, 14]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
  </group>
}

function MapLabel({ position, tone = 'white', children }) {
  const tones = { room: 'border-transparent bg-transparent text-slate-300', white: 'border-white/25 bg-[#171c22]/90 text-white', fire: 'border-orange-300/40 bg-[#171c22]/90 text-orange-100', exit: 'border-emerald-300/50 bg-[#171c22]/90 text-emerald-200' }
  return <Html center position={position} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
    <span className={`rounded-md border px-2 py-1 text-xs ${tones[tone]}`}>{children}</span>
  </Html>
}

/** Drag target wider than the visible figure, so it's easy to grab at any zoom. */
function Marker({ point, label, tone, labelHeight, drag, kind, enabled, evacuation, toPlan, ground, children }) {
  return <group position={[point.x, 0, point.z]}>
    {children}
    {enabled && <mesh name={`evacuation-${kind}`} position-y={0.6}
      onPointerDown={event => {
        const start = point
        drag.start(event, ground, world => evacuation.move(kind, toPlan(world)), () => evacuation.move(kind, start))
      }} {...drag.handlers}>
      <cylinderGeometry args={[0.5, 0.5, 1.4, 12]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>}
    <MapLabel position={[0, labelHeight, 0]} tone={tone}>{label}</MapLabel>
  </group>
}

/** Invisible floor that takes the next click while something is being placed. */
function PlacingSurface({ evacuation, bounds, toPlan, ground }) {
  const [hover, setHover] = useState(null)
  const { placing, place, cancelPlacing } = evacuation
  useEffect(() => {
    const cancel = event => { if (event.key === 'Escape') cancelPlacing() }
    window.addEventListener('keydown', cancel)
    return () => window.removeEventListener('keydown', cancel)
  }, [cancelPlacing])
  const pointAt = event => {
    const world = event.ray.intersectPlane(ground, new THREE.Vector3())
    return world ? toPlan(world) : null
  }
  return <group>
    <mesh name="evacuation-placing-surface" rotation-x={-Math.PI / 2} position={[bounds.cx, 0.004, bounds.cz]}
      onPointerMove={event => setHover(pointAt(event))} onPointerOut={() => setHover(null)}
      onClick={event => {
        // A drag is an orbit, not a placement.
        if (event.delta > 4) return
        event.stopPropagation()
        const point = pointAt(event)
        if (point) place(point)
      }}>
      <planeGeometry args={[bounds.width + 60, bounds.depth + 60]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    {hover && <mesh rotation-x={-Math.PI / 2} position={[hover.x, 0.03, hover.z]} raycast={noRaycast}>
      <ringGeometry args={[0.24, 0.3, 32]} />
      <meshBasicMaterial color={placing === 'fire' ? '#ff8a3d' : '#ffffff'} toneMapped={false} transparent opacity={0.9} depthTest={false} />
    </mesh>}
  </group>
}

/** Everything the escape route mode adds to the scene. Children sit in plan coordinates. */
export default function EvacuationScene({ evacuation, bounds, onDragging, reducedMotion }) {
  const { map, fire, person, fireField, plan, placing, floor } = evacuation
  const drag = useSceneDrag(onDragging)
  const base = floorBase(floor)
  const ground = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -base), [base])
  const toPlan = world => ({ x: world.x + bounds.cx, z: world.z + bounds.cz })
  const route = plan?.route
  const end = route?.points[route.points.length - 1]
  const exitLabel = plan?.status === 'signal' ? 'Signal here' : route?.exit === 'window' ? 'Window' : 'Way out'
  const shared = { drag, enabled: !placing, evacuation, toPlan, ground }
  const names = evacuation.brief.status === 'ready' ? evacuation.brief.roomNames : null
  const here = point => point && (point.floor ?? 0) === floor
  const crowded = room => [fire, person].some(point => here(point) && Math.hypot(point.x - room.center.x, point.z - room.center.z) < 1.2)
  const ceiling = base + PLAN_CUT_HEIGHT
  return <group position={[-bounds.cx, 0, -bounds.cz]}>
    {route && <FloorArrows points={route.points} ceiling={ceiling} reducedMotion={reducedMotion} />}
    {plan?.backup && <FloorArrows points={plan.backup.points} ceiling={ceiling} muted reducedMotion={reducedMotion} />}
    <group position-y={base}>
      {(!plan || placing || names) && map?.rooms.filter(room => !crowded(room)).map(room => <MapLabel key={room.key} position={[room.center.x, 0.1, room.center.z]} tone="room">{names?.[room.key] ?? room.name}</MapLabel>)}
      {map && fireField && <HeatField map={map} field={fireField} />}
      {here(end) && <group position={[end.x, 0, end.z]}>
        <mesh rotation-x={-Math.PI / 2} position-y={0.02} raycast={noRaycast}><ringGeometry args={[0.3, 0.42, 32]} /><meshBasicMaterial color={ROUTE_COLOR} toneMapped={false} side={THREE.DoubleSide} /></mesh>
        <MapLabel position={[0, 0.7, 0]} tone="exit">{exitLabel}</MapLabel>
      </group>}
      {route?.landings?.filter(here).map(landing => <MapLabel key={landing.label} position={[landing.x, 0.7, landing.z]} tone="exit">{landing.label}</MapLabel>)}
      {here(fire) && <Marker {...shared} kind="fire" point={fire} label="Fire" tone="fire" labelHeight={1.9}><FlameBody reducedMotion={reducedMotion} /></Marker>}
      {here(person) && <Marker {...shared} kind="person" point={person} label="You" labelHeight={1.6}><PersonBody /></Marker>}
      {floor === 0 && plan?.blockedExits.map(door => <MapLabel key={door.index} position={[door.x, 0.5, door.z]} tone="fire">Cut off by fire</MapLabel>)}
      {placing && <PlacingSurface evacuation={evacuation} bounds={bounds} toPlan={toPlan} ground={ground} />}
    </group>
  </group>
}
