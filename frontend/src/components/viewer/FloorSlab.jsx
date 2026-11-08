import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { capPositions, cutPlane, partitionFootprint, prismPositions, sectionCap } from '../../lib/sections'

// Inferred thin slab: the backend describes wall footprints, not floor polygons.
export default function FloorSlab({ bounds, section, area, elevation, floorId, offsetX = 0, offsetZ = 0 }) {
  const pieces = useMemo(() => {
    const points = [
      { x: -bounds.width / 2, z: -bounds.depth / 2 }, { x: bounds.width / 2, z: -bounds.depth / 2 },
      { x: bounds.width / 2, z: bounds.depth / 2 }, { x: -bounds.width / 2, z: bounds.depth / 2 },
    ]
    const definition = cutPlane(bounds, section)
    const plane = new THREE.Plane(new THREE.Vector3(definition.normal.x, definition.normal.y, definition.normal.z),
      definition.constant - definition.normal.y * elevation - definition.normal.x * offsetX - definition.normal.z * offsetZ)
    const partitions = section.scope === 'area' && area ? partitionFootprint(points, area) : [{ points, inside: false }]
    return partitions.map(piece => {
      const clipped = section.enabled && (section.scope === 'all' || (section.scope === 'area' && piece.inside))
      const geometry = new THREE.BufferGeometry()
      const positions = prismPositions(piece.points, 0, -0.025)
      if (clipped) positions.push(...capPositions(sectionCap(piece.points, bounds, section, -0.025, 0)))
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.computeVertexNormals()
      const material = new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 1, transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, clippingPlanes: clipped ? [plane] : [], clipShadows: true })
      return { geometry, material }
    })
  }, [bounds, section, area, elevation, offsetX, offsetZ])
  useEffect(() => () => pieces.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose() }), [pieces])
  return <group name="inferred-floor-slab" userData={{ floorId, inferred: true }}>
    {pieces.map((piece, index) => <mesh key={index} geometry={piece.geometry} material={piece.material} receiveShadow />)}
  </group>
}
