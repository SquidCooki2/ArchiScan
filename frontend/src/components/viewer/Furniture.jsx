/* oxlint-disable react/immutability -- Three.js instance matrices are mutable engine objects. */
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { elementFloor, floorBase, isFurniture } from '../../lib/geometry'
import { FURNITURE, fitScale, modelUrl } from '../../lib/furniture'
import { FIXTURE, FURNITURE as WOOD } from './colors'
import { fixtureGeometry } from './fixtureGeometry'
import { useSectionClipping } from './useSectionClipping'

const noRaycast = () => null
const RISE_DELAY = 0.45, RISE_TIME = 0.6

/** A placeholder at the final size, shown until the models arrive and kept if they can't load. */
function boxGeometry([width, height, depth]) {
  const geometry = new THREE.BoxGeometry(width, height, depth)
  geometry.translate(0, height / 2, 0)
  return geometry
}

/** Sits a model on y = 0, centered in plan, at the target size in meters along each axis. */
function normalizedGeometry(source, size) {
  const geometry = source.clone()
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox
  geometry.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2)
  const [x, y, z] = fitScale([max.x - min.x, max.y - min.y, max.z - min.z], size)
  geometry.scale(x, y, z)
  return geometry
}

/** One draw call per kind of furniture, however many pieces of it the plan has. */
function Instances({ items, geometry, material, bounds }) {
  const mesh = useRef(null)
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    items.forEach((item, index) => {
      dummy.position.set(item.x, floorBase(elementFloor(item)), item.z)
      dummy.rotation.set(0, item.rotation, 0)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [items, bounds])
  return <instancedMesh key={items.length} ref={mesh} args={[geometry, material, items.length]} castShadow receiveShadow raycast={noRaycast} frustumCulled={false} />
}

function Kinds({ groups, geometries, materials, bounds }) {
  return groups.map(({ type, items }) => <Instances key={type} items={items} geometry={geometries[type]} material={FURNITURE[type].fixture ? materials.fixture : materials.wood} bounds={bounds} />)
}

function Placeholders(props) {
  const geometries = useMemo(() => Object.fromEntries(Object.entries(FURNITURE).map(([type, { size }]) => [type, boxGeometry(size)])), [])
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries])
  return <Kinds {...props} geometries={geometries} />
}

function Models({ urls, ...props }) {
  const models = useGLTF(urls)
  const geometries = useMemo(() => {
    const sources = Object.fromEntries(urls.map((url, index) => {
      let found = null
      models[index].scene.traverse(child => { if (child.isMesh && !found) found = child.geometry })
      return [url, found]
    }))
    return Object.fromEntries(Object.entries(FURNITURE).map(([type, { model, size }]) => [type,
      model ? normalizedGeometry(sources[modelUrl(model)], size) : fixtureGeometry(type, size)]))
  }, [urls, models])
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries])
  return <Kinds {...props} geometries={geometries} />
}

class KeepPlaceholders extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const URLS = [...new Set(Object.values(FURNITURE).map(({ model }) => model).filter(Boolean))].map(modelUrl)

/**
 * Furniture from the plan: GLTF models scaled to real sizes, and simple built fixtures for what the
 * asset pack lacks. All in one soft material, cut along with the walls by the same section tools.
 */
export default function Furniture({ walls, bounds, section, cut, region, visibleFloor, reducedMotion }) {
  const groups = useMemo(() => {
    const byType = new Map()
    for (const item of walls.filter(isFurniture)) {
      if (visibleFloor !== 'all' && elementFloor(item) > visibleFloor) continue
      if (!byType.has(item.type)) byType.set(item.type, [])
      byType.get(item.type).push(item)
    }
    return [...byType].map(([type, items]) => ({ type, items }))
  }, [walls, visibleFloor])
  const planes = useSectionClipping(bounds, section, cut, region)
  const materials = useMemo(() => {
    const shared = { roughness: 0.82, metalness: 0, side: THREE.DoubleSide, clippingPlanes: planes, clipIntersection: true, clipShadows: true }
    return { wood: new THREE.MeshStandardMaterial({ ...shared, color: WOOD }), fixture: new THREE.MeshStandardMaterial({ ...shared, color: FIXTURE, roughness: 0.5 }) }
  }, [planes])
  useEffect(() => () => Object.values(materials).forEach(material => material.dispose()), [materials])

  // Settles into the rooms just after the walls have finished rising.
  const group = useRef(null)
  const elapsed = useRef(0)
  useFrame((_, delta) => {
    if (elapsed.current > RISE_DELAY + RISE_TIME || !group.current) return
    elapsed.current += delta
    const t = reducedMotion ? 1 : THREE.MathUtils.clamp((elapsed.current - RISE_DELAY) / RISE_TIME, 0, 1)
    group.current.scale.y = Math.max(0.0001, 1 - (1 - t) ** 3)
  })

  if (!groups.length) return null
  const props = { groups, materials, bounds }
  const fallback = <Placeholders {...props} />
  return <group ref={group} name="furniture" position={[-bounds.cx, 0, -bounds.cz]} scale-y={reducedMotion ? 1 : 0.0001}>
    <KeepPlaceholders fallback={fallback}>
      <Suspense fallback={fallback}><Models urls={URLS} {...props} /></Suspense>
    </KeepPlaceholders>
  </group>
}
