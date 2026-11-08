import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACCEPTED_TYPES, isMockMode, loadSample, parseBlueprint, validateFile } from './api/parseBlueprint'
import { computeBounds, countElements, floorCount } from './lib/geometry'
import { modelNameFor, orderFloorFiles } from './lib/floorFiles'
import { computeRoofPlan, DEFAULT_ROOF, roofTopHeight } from './lib/roof'
import { useEvacuation } from './lib/useEvacuation'
import { useSection } from './lib/useSection'
import { buildWalkWorld, suggestSpawn } from './lib/walkthrough'
import { SAMPLES } from './samples/backendSample'
import ErrorToast from './components/ErrorToast'
import EvacuationPanel from './components/EvacuationPanel'
import ExplorePanel from './components/ExplorePanel'
import Header, { Wordmark } from './components/Header'
import Landing from './components/Landing'
import LoadingOverlay from './components/LoadingOverlay'
import { ModelTitle, PlanCard } from './components/ModelInfo'
import { WalkControls, WalkStart } from './components/WalkPanel'

const Viewer = lazy(() => import('./components/viewer/Viewer'))

const HINTS = {
  orbit: 'Drag to orbit. Scroll to zoom. Right-drag to pan.',
  escape: 'Drag the fire or the person to move them. Drag the floor to orbit.',
}

export default function App() {
  const [status, setStatus] = useState('idle')
  const [walls, setWalls] = useState([])
  const [model, setModel] = useState({ name: '', previews: [], demoUpload: false })
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [mode, setMode] = useState('explore')
  const [floorView, setFloorView] = useState('all')
  const [roofType, setRoofType] = useState(DEFAULT_ROOF)
  const [modelKey, setModelKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [loadedAt, setLoadedAt] = useState(() => performance.now())
  const [humanPlacement, setHumanPlacement] = useState(null)
  const [humanSpawn, setHumanSpawn] = useState(null)
  const [humanTransition, setHumanTransition] = useState(false)
  const humanMovement = useRef({})
  const input = useRef()
  const request = useRef(null)
  const pendingUrls = useRef([])
  const committedUrls = useRef([])

  const hasModel = walls.length > 0
  const loading = status === 'loading'
  // Before anything is loaded, the landing page shows the sample house rising and turning.
  const shownWalls = hasModel ? walls : SAMPLES.house.walls
  const bounds = useMemo(() => computeBounds(shownWalls), [shownWalls])
  const counts = useMemo(() => countElements(walls), [walls])
  const floors = useMemo(() => floorCount(shownWalls), [shownWalls])
  const roofPlan = useMemo(() => computeRoofPlan(shownWalls), [shownWalls])
  const maxHeight = roofTopHeight(roofPlan, roofType)
  const cut = useSection(bounds, floorView, maxHeight)
  const evacuation = useEvacuation(walls)
  // Walking and escape routes happen on one floor; escape routes only on the ground floor.
  const walkFloor = floorView === 'all' ? 0 : floorView
  const activeFloor = mode === 'escape' ? 0 : mode === 'walk' ? walkFloor : floorView
  const humanMode = mode !== 'walk' ? 'overview' : humanSpawn ? 'human' : 'placing'

  const dismissError = useCallback(() => setError(null), [])
  const revoke = urls => urls.forEach(url => URL.revokeObjectURL(url))
  useEffect(() => () => {
    request.current?.abort()
    revoke(pendingUrls.current)
    revoke(committedUrls.current)
  }, [])

  const leaveWalk = useCallback(() => {
    setHumanSpawn(null)
    setHumanPlacement(null)
    setHumanTransition(false)
    humanMovement.current = {}
  }, [])
  const exitWalk = useCallback(() => { leaveWalk(); setMode('explore') }, [leaveWalk])
  const enterWalk = useCallback(position => { setHumanTransition(true); setHumanSpawn(position) }, [])

  function changeMode(next) {
    if (next === mode) return
    cut.cancelArea()
    leaveWalk()
    if (next === 'escape') evacuation.open(); else evacuation.close()
    setMode(next)
  }
  function changeFloor(next) {
    setFloorView(next)
    cut.clearHeightCut()
    cut.removeArea()
  }

  const browse = () => input.current?.click()
  const releasePending = () => { revoke(pendingUrls.current); pendingUrls.current = [] }
  function cancel() {
    request.current?.abort()
    request.current = null
    releasePending()
    setPending(null)
    setStatus(hasModel ? 'ready' : 'idle')
  }

  /** Opens a sample by id, or reads the given images as one model, one image per floor. */
  async function open({ sampleId = null, files = [] }) {
    let ordered = files
    if (!sampleId) {
      try {
        ordered = orderFloorFiles(files)
        ordered.forEach(validateFile)
      } catch (err) { setError(err.message); return }
    }
    request.current?.abort()
    releasePending()
    const controller = new AbortController()
    request.current = controller
    const sample = sampleId ? SAMPLES[sampleId] : null
    pendingUrls.current = sample ? [] : ordered.map(file => URL.createObjectURL(file))
    const previews = sample ? sample.previews : pendingUrls.current
    setPending({ preview: previews[0], floors: previews.length, sample: Boolean(sample) || isMockMode() })
    setError(null)
    setStatus('loading')
    try {
      const nextWalls = sample ? await loadSample(controller.signal, sampleId) : await parseBlueprint(ordered, { signal: controller.signal })
      if (request.current !== controller || controller.signal.aborted) return
      revoke(committedUrls.current)
      committedUrls.current = pendingUrls.current
      pendingUrls.current = []
      setWalls(nextWalls)
      setModel({ name: sample ? sample.name : modelNameFor(ordered), previews, demoUpload: !sample && isMockMode() })
      setFloorView('all')
      setMode('explore')
      leaveWalk()
      evacuation.leave()
      cut.reset()
      setModelKey(value => value + 1)
      setLoadedAt(performance.now())
      setStatus('ready')
    } catch (err) {
      if (request.current !== controller || controller.signal.aborted) return
      releasePending()
      setError(err.message || 'The plan couldn’t be read. Try again.')
      setStatus(hasModel ? 'ready' : 'idle')
    } finally {
      if (request.current === controller) { request.current = null; setPending(null) }
    }
  }

  // Listen once and dispatch to the current handler, avoiding stale closures.
  const openHandler = useRef(open)
  useEffect(() => { openHandler.current = open })
  useEffect(() => {
    let depth = 0
    const hasFiles = event => Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const onEnter = event => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (!request.current) { depth++; setDragging(true) }
    }
    const onOver = event => { if (hasFiles(event)) { event.preventDefault(); event.dataTransfer.dropEffect = request.current ? 'none' : 'copy' } }
    const onLeave = event => { if (hasFiles(event)) { depth = Math.max(0, depth - 1); if (!depth) setDragging(false) } }
    const onDrop = event => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setDragging(false)
      if (!request.current && event.dataTransfer.files.length) openHandler.current({ files: [...event.dataTransfer.files] })
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  const resetCamera = () => setResetKey(value => value + 1)
  const startInMiddle = () => {
    const spot = suggestSpawn(buildWalkWorld(walls, bounds, { floor: walkFloor }))
    if (spot) enterWalk(spot)
  }
  const planFloor = activeFloor === 'all' ? 0 : activeFloor
  const planCaption = floors > 1 ? `Floor ${planFloor + 1} plan` : 'Original plan'
  const hint = cut.drawing ? 'Drag on the floor, or click two corners. Esc cancels.' : mode === 'escape' && evacuation.plan ? HINTS.escape : HINTS.orbit
  const statusText = !hasModel || loading ? '' : humanMode === 'human' ? 'Walking. Use W A S D or the arrow keys to move, and Escape to stop.' : `3D model ready: ${model.name}.`

  return <div className="relative min-h-svh overflow-hidden bg-[#171c22] font-[family-name:Archivo,ui-sans-serif,system-ui,sans-serif] text-slate-100 selection:bg-sky-300/30">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_62%_42%,#2a323c_0%,#171c22_68%)]" />
    <div aria-hidden={!hasModel} aria-label={hasModel ? '3D model. Drag to orbit, scroll to zoom, right-drag to pan.' : undefined} className={`fixed inset-0 ${hasModel ? '' : 'pointer-events-none'}`}>
      <Suspense fallback={null}>
        <Viewer walls={shownWalls} hero={!hasModel} modelKey={modelKey} floor={hasModel ? activeFloor : 'all'} section={cut.section} sectionRange={cut.range} area={cut.area} resetKey={resetKey}
          drawingArea={cut.drawing} onArea={cut.updateArea} onCompleteArea={cut.completeArea} onCancelArea={cut.cancelArea} onPosition={cut.setPosition}
          humanMode={humanMode} humanPlacement={humanPlacement} humanSpawn={humanSpawn} humanMovement={humanMovement} onHumanPreview={setHumanPlacement} onHumanEnter={enterWalk} onHumanExit={exitWalk} onHumanTransition={setHumanTransition}
          roofPlan={roofPlan} roofType={roofType} maxHeight={maxHeight} loadedAt={loadedAt} evacuation={evacuation} />
      </Suspense>
    </div>
    <div inert={loading}>
      {!hasModel && <div className="pointer-events-none fixed top-0 left-0 z-20 p-3 sm:px-[6vw] sm:py-6"><Wordmark /></div>}
      {hasModel && <Header loading={loading} mode={mode} onMode={changeMode} onUpload={browse} walking={humanMode === 'human'} />}
      <input ref={input} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="hidden" aria-label="Upload floor plans" onChange={event => { const files = [...event.target.files]; event.target.value = ''; if (files.length) open({ files }) }} />
      {!hasModel && <Landing onBrowse={browse} onSample={sampleId => open({ sampleId })} samples={[SAMPLES.house, SAMPLES.apartment]} />}
      {hasModel && humanMode !== 'human' && <ModelTitle name={model.name} counts={counts} bounds={bounds} floors={floors} demoUpload={model.demoUpload} />}
      {hasModel && humanMode !== 'human' && <PlanCard previewUrl={model.previews[planFloor] ?? model.previews[0]} caption={planCaption} hint={hint} />}
      {hasModel && mode === 'explore' && <ExplorePanel floors={floors} floor={floorView} onFloor={changeFloor} roofType={roofType} onRoof={setRoofType} cut={cut} onResetView={resetCamera} />}
      {hasModel && humanMode === 'placing' && <WalkStart floors={floors} floor={walkFloor} onFloor={changeFloor} placement={humanPlacement} onMiddle={startInMiddle} />}
      {hasModel && humanMode === 'human' && <WalkControls movement={humanMovement} transitioning={humanTransition} onRepick={leaveWalk} />}
      {hasModel && mode === 'escape' && <EvacuationPanel evacuation={evacuation} imageUrl={model.previews[0]} floors={floors} onResetView={resetCamera} />}
    </div>
    {dragging && !loading && <div className="pointer-events-none fixed inset-3 z-30 grid place-items-center rounded-xl border-2 border-dashed border-sky-300 bg-[#171c22]/70"><p className="text-xl font-medium text-slate-100">Drop to build this floor plan</p></div>}
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-30 bg-[#171c22] transition-opacity duration-500 motion-reduce:transition-none ${humanTransition ? 'opacity-100' : 'opacity-0'}`} />
    {loading && pending && <LoadingOverlay previewUrl={pending.preview} floors={pending.floors} sample={pending.sample} onCancel={cancel} />}
    {error && <ErrorToast key={error} message={error} onClose={dismissError} />}
    <p className="sr-only" role="status">{statusText}</p>
  </div>
}
