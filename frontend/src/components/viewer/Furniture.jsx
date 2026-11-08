/* oxlint-disable react/immutability -- Three.js instance matrices are mutable engine objects. */
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { elementFloor, floorBase, isFurniture } from '../../lib/geometry'
import { drawnModel, FURNITURE_MODELS, modelUrl } from '../../lib/furniture'
import { FURNITURE } from './colors'
import { FINISHES } from './fixtureFinishes'
import { furnitureGeometry, placeholderGeometry } from './furnitureGeometry'
import { useSectionClipping } from './useSectionClipping'

const noRaycast = () => null
const RISE_DELAY = 0.45, RISE_TIME = 0.6

/** One draw call per kind of furniture, however many pieces of it the plan has. */
function Instances({ items, geometry, material, bounds }) {
  const mesh = useRef(null)
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    items.forEach((item, index) => {
      dummy.position.set(item.x, floorBase(elementFloor(item)), item.z)
      dummy.rotation.set(0, item.rotation, 0)
      dummy.scale.set(item.fitWidth ?? 1, 1, item.fitDepth ?? 1)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(index, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  }, [items, bounds])
  return <instancedMesh key={items.length} ref={mesh} args={[geometry, material, items.length]} castShadow receiveShadow raycast={noRaycast} frustumCulled={false} />
}

function Kinds({ groups, geometries, material, bounds }) {
  return groups.map(({ kind, items }) => <Instances key={kind} items={items} geometry={geometries[kind]} material={material} bounds={bounds} />)
}

function Placeholders(props) {
  const geometries = useMemo(() => Object.fromEntries(Object.entries(FURNITURE_MODELS).map(([kind, { size }]) => [kind, placeholderGeometry(size, FURNITURE)])), [])
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries])
  return <Kinds {...props} geometries={geometries} />
}

function Models({ urls, ...props }) {
  const models = useGLTF(urls)
  const geometries = useMemo(() => {
    const scenes = Object.fromEntries(urls.map((url, index) => [url, models[index].scene]))
    return Object.fromEntries(Object.entries(FURNITURE_MODELS).map(([kind, definition]) => [kind, furnitureGeometry(scenes[modelUrl(definition.model)], { ...definition, finish: FINISHES[kind] })]))
  }, [urls, models])
  useEffect(() => () => Object.values(geometries).forEach(geometry => geometry.dispose()), [geometries])
  return <Kinds {...props} geometries={geometries} />
}

class KeepPlaceholders extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

const URLS = [...new Set(Object.values(FURNITURE_MODELS).map(({ model }) => model))].map(modelUrl)

/**
 * Furniture from the plan: models fitted to real sizes with their colors baked in, one draw call per
 * kind, and cut along with the walls by the same section tools.
 */
export default function Furniture({ walls, bounds, section, cut, region, visibleFloor, reducedMotion }) {
  const groups = useMemo(() => {
    const byKind = new Map()
    for (const item of walls.filter(isFurniture)) {
      if (visibleFloor !== 'all' && elementFloor(item) > visibleFloor) continue
      const kind = drawnModel(item, walls)
      if (!byKind.has(kind)) byKind.set(kind, [])
      byKind.get(kind).push(item)
    }
    return [...byKind].map(([kind, items]) => ({ kind, items }))
  }, [walls, visibleFloor])
  const planes = useSectionClipping(bounds, section, cut, region)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0, side: THREE.DoubleSide, clippingPlanes: planes, clipIntersection: true, clipShadows: true }), [planes])
  useEffect(() => () => material.dispose(), [material])

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
  const props = { groups, material, bounds }
  const fallback = <Placeholders {...props} />
  return <group ref={group} name="furniture" position={[-bounds.cx, 0, -bounds.cz]} scale-y={reducedMotion ? 1 : 0.0001}>
    <KeepPlaceholders fallback={fallback}>
      <Suspense fallback={fallback}><Models urls={URLS} {...props} /></Suspense>
    </KeepPlaceholders>
  </group>
}
