import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ACCEPTED_TYPES, isMockMode, loadSample, parseBlueprint, validateFile } from './api/parseBlueprint'
import { computeBounds, countElements, PLAN_CUT_HEIGHT, WALL_HEIGHT } from './lib/geometry'
import { createSection, cutRange, defaultCutPosition } from './lib/sections'
import Header from './components/Header'
import UploadZone from './components/UploadZone'
import LoadingOverlay from './components/LoadingOverlay'
import ErrorToast from './components/ErrorToast'
import SectionControls from './components/SectionControls'
import Icon from './components/Icon'
import HumanPerspectiveControls from './components/HumanPerspectiveControls'
import { backendSample } from './samples/backendSample'

const Viewer = lazy(() => import('./components/viewer/Viewer'))

export default function App() {
  const [status, setStatus] = useState('idle')
  const [walls, setWalls] = useState([])
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [modelPreviewUrl, setModelPreviewUrl] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [section, setSection] = useState(createSection)
  const [selectedWalls, setSelectedWalls] = useState([])
  const [selectedArea, setSelectedArea] = useState(null)
  const [drawingArea, setDrawingArea] = useState(false)
  const [humanMode, setHumanMode] = useState('overview')
  const [humanPlacement, setHumanPlacement] = useState(null)
  const [humanSpawn, setHumanSpawn] = useState(null)
  const [humanLocked, setHumanLocked] = useState(false)
  const [humanTransition, setHumanTransition] = useState(false)
  const humanBridge = useRef(null)
  const humanMovement = useRef({})
  const exitHuman = useCallback(() => { setHumanMode('overview'); setHumanLocked(false); setHumanTransition(false); humanMovement.current = {} }, [])
  const enterHuman = useCallback(position => { setHumanSpawn(position); setHumanTransition(true); setHumanMode('human') }, [])
  const startHuman = useCallback(() => { setDrawingArea(false); setHumanPlacement(null); setHumanMode('placing'); humanMovement.current = {} }, [])
  const [modelKey, setModelKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [modelName, setModelName] = useState('')
  const [isSample, setIsSample] = useState(false)
  const [savedSample, setSavedSample] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const input = useRef()
  const request = useRef(null)
  const objectUrl = useRef(null)
  const committedUrl = useRef(null)
  const hasModel = walls.length > 0
  const loading = status === 'loading'
  const bounds = useMemo(() => computeBounds(walls), [walls])
  const counts = useMemo(() => countElements(walls), [walls])
  const elementSummary = ['wall', 'window', 'door'].map(type => `${counts[type]} ${type}${counts[type] === 1 ? '' : 's'}`).join(' · ')
  const dismissError = useCallback(() => setError(null), [])

  useEffect(() => () => {
    request.current?.abort()
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    if (committedUrl.current && committedUrl.current !== objectUrl.current) URL.revokeObjectURL(committedUrl.current)
  }, [])

  const browse = () => input.current?.click()
  const cancel = () => {
    request.current?.abort()
    request.current = null
    if (objectUrl.current && objectUrl.current !== committedUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = committedUrl.current
    setPreviewUrl(committedUrl.current)
    setStatus(hasModel ? 'ready' : 'idle')
  }
  async function startUpload(file, sample = false) {
    if (!sample) {
      try { validateFile(file) } catch (err) { setError(err.message); return }
    }
    exitHuman()
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    if (objectUrl.current && objectUrl.current !== committedUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = file ? URL.createObjectURL(file) : null
    setPreviewUrl(sample ? backendSample.previewUrl : objectUrl.current)
    const nextIsSample = sample || isMockMode()
    setLoadingSample(nextIsSample)
    setError(null)
    setStatus('loading')
    try {
      const nextWalls = sample ? await loadSample(controller.signal) : await parseBlueprint(file, { signal: controller.signal })
      if (request.current !== controller || controller.signal.aborted) return
      if (committedUrl.current) URL.revokeObjectURL(committedUrl.current)
      committedUrl.current = objectUrl.current
      setModelPreviewUrl(sample ? backendSample.previewUrl : committedUrl.current)
      setWalls(nextWalls)
      setIsSample(nextIsSample)
      setSavedSample(sample)
      setModelName(sample ? backendSample.name : file.name)
      setSection(createSection())
      setSelectedWalls([])
      setSelectedArea(null)
      setDrawingArea(false)
      setModelKey(value => value + 1)
      setStatus('ready')
    } catch (err) {
      if (request.current !== controller || controller.signal.aborted) return
      if (objectUrl.current && objectUrl.current !== committedUrl.current) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = committedUrl.current
      setPreviewUrl(committedUrl.current)
      setError(err.message || 'Something went wrong. Please try again.')
      setStatus(hasModel ? 'ready' : 'idle')
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  // Listen once and dispatch to the current upload handler, avoiding stale closures.
  const uploadHandler = useRef(startUpload)
  useEffect(() => { uploadHandler.current = startUpload })
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
      if (!request.current && event.dataTransfer.files[0]) uploadHandler.current(event.dataTransfer.files[0])
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

  const cancelArea = useCallback(() => setDrawingArea(false), [])
  const updatePosition = useCallback(position => setSection(current => ({ ...current, position })), [])
  const updateArea = useCallback(area => {
    setSelectedArea(area)
    setSection(current => {
      if (current.scope !== 'area') return current
      if (!area) return { ...current, enabled: false }
      const range = cutRange(bounds, current.axis, area)
      const position = current.position <= range.min || current.position >= range.max
        ? defaultCutPosition(bounds, current.axis, area) : current.position
      return { ...current, position }
    })
  }, [bounds])
  const completeArea = useCallback(area => {
    updateArea(area)
    setSection(current => {
      const range = cutRange(bounds, current.axis, area)
      return { ...current, scope: 'area', enabled: true,
        position: current.position <= range.min || current.position >= range.max ? defaultCutPosition(bounds, current.axis, area) : current.position }
    })
    setDrawingArea(false)
  }, [bounds, updateArea])
  function startArea() {
    setSection(current => ({ ...current, scope: 'area' }))
    setDrawingArea(true)
  }
  function toggleSection() {
    if (drawingArea) { setDrawingArea(false); return }
    if (section.scope === 'area' && !selectedArea) { startArea(); return }
    setSection(current => {
      const region = current.scope === 'area' ? selectedArea : null
      const range = cutRange(bounds, current.axis, region)
      const atEdge = current.position <= range.min + 0.01 || current.position >= range.max - 0.01
      return { ...current, enabled: !current.enabled, position: !current.enabled && atEdge ? defaultCutPosition(bounds, current.axis, region) : current.position }
    })
  }
  function changeAxis(axis) {
    const missingArea = section.scope === 'area' && !selectedArea
    if (missingArea) setDrawingArea(true)
    setSection(current => ({ ...current, axis, enabled: !missingArea,
      position: defaultCutPosition(bounds, axis, current.scope === 'area' ? selectedArea : null), flipped: axis === current.axis ? current.flipped : false }))
  }
  function changeScope(scope) {
    setDrawingArea(scope === 'area' && !selectedArea)
    setSection(current => ({ ...current, scope,
      position: scope === 'area' && selectedArea ? defaultCutPosition(bounds, current.axis, selectedArea) : current.position }))
  }
  const selectWall = index => setSelectedWalls(current => current.includes(index) ? current.filter(value => value !== index) : [...current, index])
  function resetSection() {
    setSection(createSection())
    setSelectedWalls([])
    setSelectedArea(null)
    setDrawingArea(false)
  }

  return <div className="relative min-h-svh overflow-hidden bg-neutral-950 font-sans text-white selection:bg-indigo-400/30">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#222035_0%,#0a0a0a_65%)]" />
    <div className={`fixed inset-0 transition-all duration-700 motion-reduce:transition-none ${hasModel ? 'opacity-100' : 'opacity-40 blur-[2px]'}`} aria-label="Interactive 3D floorplan. Drag to orbit, scroll to zoom, right-drag to pan.">
      <Suspense fallback={null}><Viewer walls={walls} modelKey={modelKey} section={section} selectedWalls={selectedWalls} area={selectedArea} onSelect={selectWall} resetKey={resetKey} drawingArea={drawingArea} onArea={updateArea} onCompleteArea={completeArea} onCancelArea={cancelArea} onPosition={updatePosition} humanMode={humanMode} humanPlacement={humanPlacement} humanSpawn={humanSpawn} humanBridge={humanBridge} humanMovement={humanMovement} onHumanPreview={setHumanPlacement} onHumanEnter={enterHuman} onHumanExit={exitHuman} onHumanLocked={setHumanLocked} onHumanTransition={setHumanTransition} /></Suspense>
    </div>
    <div inert={loading}>
      <Header hasModel={hasModel} loading={loading} mock={isMockMode()} onUpload={browse} previewUrl={modelPreviewUrl} humanMode={humanMode} onHuman={humanMode === 'overview' ? startHuman : exitHuman} />
      <input ref={input} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" aria-label="Upload a floorplan" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) startUpload(file) }} />
      {!hasModel && <main className="pointer-events-none relative z-10 flex min-h-svh items-center justify-center px-6 pt-28 pb-16"><UploadZone dragging={dragging} onBrowse={browse} onSample={() => startUpload(null, true)} /></main>}
      {hasModel && humanMode === 'overview' && <>
        <div className="pointer-events-none fixed top-28 left-6 z-10 max-w-[calc(100vw-3rem)] sm:top-32 sm:left-9">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-indigo-200"><span className="size-1.5 rounded-full bg-indigo-300" />{savedSample ? 'Saved backend output' : isSample ? 'Sample space' : 'Your space, reimagined'}</div>
          <h1 className="max-w-xs truncate text-xl font-light tracking-tight sm:max-w-md sm:text-3xl">{modelName}</h1>
          <p className="mt-2 text-xs text-white/40">{elementSummary} <span className="px-2 text-white/20">/</span> {bounds.width.toFixed(1)} × {bounds.depth.toFixed(1)} m <span className="px-2 text-white/20">/</span> {WALL_HEIGHT.toFixed(1)} m high</p>
          {isSample && <p className="mt-2 max-w-xs text-[11px] text-indigo-200/60">{savedSample ? 'Apartment floorplan · previously parsed by the backend' : 'Demonstration geometry · not derived from your image'}</p>}
        </div>
        <SectionControls section={section} bounds={bounds} walls={walls} selectedWalls={selectedWalls} area={selectedArea} drawingArea={drawingArea} onStartArea={startArea} onCancelArea={cancelArea}
          onToggle={toggleSection}
          onAxis={changeAxis}
          onPosition={updatePosition}
          onFlip={flipped => setSection(current => ({ ...current, flipped }))}
          onScope={changeScope}
          onSelect={selectWall} onSelectAll={() => setSelectedWalls(walls.map((_, i) => i))} onClear={() => setSelectedWalls([])} onArea={area => { if (area) completeArea(area); else { cancelArea(); updateArea(null) } }}
          onReset={resetSection} onFit={() => setResetKey(value => value + 1)}
          onPlanCut={() => { if (section.scope === 'area' && !selectedArea) startArea(); setSection(current => ({ ...current, axis: 'y', enabled: current.scope !== 'area' || Boolean(selectedArea), position: PLAN_CUT_HEIGHT, flipped: false })) }} />
        <div className="pointer-events-none fixed bottom-8 left-9 hidden items-center gap-2 text-[11px] text-white/35 lg:flex"><Icon name="cube" className="size-4" />{drawingArea ? 'Drag on the model floor or click two corners · Esc cancels' : 'Drag to orbit · Scroll to zoom · Right-drag to pan'}</div>
        <div className="pointer-events-none fixed right-9 bottom-8 hidden text-[10px] tracking-[0.15em] text-white/25 uppercase lg:block">Perspective / 3D</div>
      </>}
      {!hasModel && <footer className="pointer-events-none fixed inset-x-0 bottom-5 z-10 text-center text-[10px] tracking-[0.12em] text-white/25 uppercase">A clearer view of what comes next</footer>}
    </div>
    {hasModel && dragging && !loading && <div className="pointer-events-none fixed inset-3 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-indigo-300 bg-indigo-950/40 backdrop-blur-sm"><p className="text-xl font-light text-indigo-200">Drop to scan a new floorplan</p></div>}
    {hasModel && humanMode !== 'overview' && <HumanPerspectiveControls mode={humanMode} placement={humanPlacement} bounds={bounds} bridge={humanBridge} movement={humanMovement} onCancel={exitHuman} onReposition={startHuman} locked={humanLocked} transitioning={humanTransition} />}
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 z-30 bg-neutral-950 transition-opacity duration-500 motion-reduce:transition-none ${humanTransition ? 'opacity-100' : 'opacity-0'}`} />
    {loading && <LoadingOverlay previewUrl={previewUrl} sample={loadingSample} onCancel={cancel} />}
    {error && <ErrorToast key={error} message={error} onClose={dismissError} />}
    <p className="sr-only" role="status">{hasModel && !loading ? `3D model ready. ${elementSummary}. Use the section controls to adjust cut height.` : ''}</p>
  </div>
}
