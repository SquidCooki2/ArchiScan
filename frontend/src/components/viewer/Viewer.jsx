import { Component, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import { computeBounds, floorBase, floorCount, PLAN_CUT_HEIGHT, WALL_HEIGHT } from '../../lib/geometry'
import { buildWalkBuilding } from '../../lib/walkthrough'
import { useReducedMotion } from '../../lib/useReducedMotion'
import HumanPlacement from './HumanPlacement'
import HumanCamera from './HumanCamera'
import Floor from './Floor'
import FloorSlabs from './FloorSlabs'
import Furniture from './Furniture'
import Walls from './Walls'
import Roof from './Roof'
import CameraRig from './CameraRig'
import SectionPlane from './SectionPlane'
import RegionSelection from './RegionSelection'
import CutPlaneHandle from './CutPlaneHandle'
import EvacuationScene from './EvacuationScene'

const NO_CUT = { enabled: false, axis: 'y', position: WALL_HEIGHT, flipped: false, scope: 'all' }

function Unavailable() {
  return <div role="status" className="absolute inset-x-6 bottom-8 mx-auto max-w-md rounded-lg border border-white/10 bg-[#20262e] p-4 text-center text-sm leading-6 text-slate-300">The 3D view couldn’t start. Turn on WebGL in your browser, then reload this page.</div>
}

class ViewerBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <Unavailable /> : this.props.children }
}

/**
 * `hero` is the landing page's slowly turning model. `floor` is the floor on show, or 'all'.
 * Placing a walk's start and planning an escape both look down on one floor, cut at plan height.
 */
export default function Viewer({ walls, hero = false, modelKey, floor = 'all', section: userSection, sectionRange, area, resetKey, drawingArea, onArea, onCompleteArea, onCancelArea, onPosition, humanMode = 'overview', humanPlacement, humanSpawn, humanMovement, onHumanPreview, onHumanEnter, onHumanExit, onHumanTransition, onHumanFloor, onHumanLock, onHumanStairs, showFurniture = true, roofPlan, roofType, maxHeight, loadedAt, evacuation }) {
  const [manipulating, setManipulating] = useState(false)
  const bounds = useMemo(() => computeBounds(walls), [walls])
  const reducedMotion = useReducedMotion()
  const escaping = evacuation.active
  const placing = humanMode === 'placing'
  const walking = humanMode === 'human'
  const planFloor = floor === 'all' ? 0 : floor
  const planView = useMemo(() => ({ ...NO_CUT, enabled: true, position: floorBase(planFloor) + PLAN_CUT_HEIGHT }), [planFloor])
  const looksDown = escaping || placing
  // A walk can reach every floor, so all of them stay in the scene.
  const shownFloor = walking ? 'all' : floor
  // Drawing a cut area needs the floor in view, so the roof and upper walls lift off for it. A
  // finished area keeps the roof off too, or it would hide most of what the area reveals.
  const section = walking ? NO_CUT : looksDown || drawingArea ? planView : userSection
  const usesCutTools = !hero && !walking && !looksDown
  const building = useMemo(() => buildWalkBuilding(walls, bounds), [walls, bounds])
  const targetBounds = useMemo(() => ({ minX: -bounds.width / 2, maxX: bounds.width / 2, minZ: -bounds.depth / 2, maxZ: bounds.depth / 2 }), [bounds])
  const hasArea = section.scope === 'area' && Boolean(area)
  const hasTarget = section.scope === 'all' || hasArea
  const cut = section.enabled && hasTarget
  const region = hasArea ? area : null
  const wallsTop = floor === 'all' ? floorCount(walls) * WALL_HEIGHT : floorBase(floor) + WALL_HEIGHT
  const shadowSize = Math.max(bounds.size, 12)
  const cursor = placing || drawingArea || evacuation.placing ? 'crosshair' : walking ? 'pointer' : manipulating ? 'grabbing' : 'grab'
  // A logarithmic depth buffer keeps the hidden end faces where wall pieces meet from showing as hairlines.
  return <ViewerBoundary>
    <Canvas shadows="percentage" dpr={[1, 1.75]} camera={{ position: [12, 12, 12], fov: 45 }} gl={{ localClippingEnabled: true, alpha: true, logarithmicDepthBuffer: true }} style={{ cursor }} fallback={<Unavailable />}>
      <ambientLight intensity={walking ? 0.9 : 0.85} />
      <directionalLight castShadow position={[shadowSize * 0.8, shadowSize * 1.5, shadowSize * 1.1]} intensity={2.1} shadow-mapSize={[2048, 2048]} shadow-autoUpdate={!walking} shadow-needsUpdate={walking} shadow-camera-left={-shadowSize} shadow-camera-right={shadowSize} shadow-camera-top={shadowSize} shadow-camera-bottom={-shadowSize} shadow-camera-far={shadowSize * 5} shadow-normalBias={0.03} />
      {/* A local studio environment avoids a network-dependent HDR download. */}
      <Environment resolution={64}>
        <Lightformer position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[15, 15, 1]} intensity={1.5} />
        <Lightformer position={[-8, 4, 0]} rotation-y={Math.PI / 2} scale={[10, 6, 1]} color="#c9d6e6" intensity={1} />
      </Environment>
      <Floor bounds={bounds} walkthrough={walking} />
      <Walls key={modelKey} walls={walls} bounds={bounds} section={section} area={usesCutTools ? area : null} openDoors={walking || escaping} visibleFloor={shownFloor} />
      <FloorSlabs walls={walls} bounds={bounds} section={section} cut={cut} region={region} visibleFloor={shownFloor} ground={!escaping} boards={!escaping} walking={walking} />
      {!hero && (showFurniture || walking || looksDown) && <Furniture key={`furniture-${modelKey}`} walls={walls} bounds={bounds} section={section} cut={cut} region={region} visibleFloor={shownFloor} reducedMotion={reducedMotion} />}
      {floor === 'all' && !walking && !looksDown && !drawingArea && !hasArea && <Roof key={`${modelKey}-${roofType}`} plan={roofPlan} type={roofType} bounds={bounds} section={section} cut={cut} loadedAt={loadedAt} reducedMotion={reducedMotion} />}
      {escaping && !hero && <EvacuationScene evacuation={evacuation} bounds={bounds} onDragging={setManipulating} reducedMotion={reducedMotion} />}
      {usesCutTools && (drawingArea || section.scope === 'area') && <RegionSelection bounds={bounds} area={area} top={wallsTop} drawing={drawingArea}
        onArea={onArea} onComplete={onCompleteArea} onCancel={onCancelArea} onDragging={setManipulating} section={section} onPosition={onPosition} />}
      {usesCutTools && cut && !drawingArea && <>
        <SectionPlane bounds={bounds} targetBounds={targetBounds} section={section} area={area} top={wallsTop} />
        <CutPlaneHandle bounds={bounds} targetBounds={targetBounds} section={section} area={area} top={wallsTop} range={sectionRange} onPosition={onPosition} onDragging={setManipulating} />
      </>}
      <OrbitControls makeDefault enabled={!walking && !drawingArea && !manipulating} autoRotate={hero && !reducedMotion} autoRotateSpeed={0.35} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.05} />
      <CameraRig bounds={bounds} fitKey={looksDown ? `${resetKey}-${planFloor}` : resetKey} reducedMotion={reducedMotion} hasModel active={!walking} framing={hero ? 'hero' : 'panel'} height={looksDown ? floorBase(planFloor) + PLAN_CUT_HEIGHT : maxHeight} view={looksDown ? 'plan' : 'perspective'} />
      {placing && <HumanPlacement world={building.floors[planFloor]} placement={humanPlacement} onPreview={onHumanPreview} onEnter={onHumanEnter} onCancel={onHumanExit} />}
      {walking && <HumanCamera spawn={humanSpawn} building={building} movement={humanMovement} reducedMotion={reducedMotion} onExit={onHumanExit} onTransition={onHumanTransition} onFloor={onHumanFloor} onLock={onHumanLock} onStairs={onHumanStairs} />}
    </Canvas>
  </ViewerBoundary>
}
