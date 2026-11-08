import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ACCEPTED_TYPES, isMockMode, loadSample, parseBlueprint, validateFile } from './api/parseBlueprint'
import { computeBounds, WALL_HEIGHT } from './lib/geometry'
import Header from './components/Header'
import UploadZone from './components/UploadZone'
import LoadingOverlay from './components/LoadingOverlay'
import ErrorToast from './components/ErrorToast'
import SectionControls from './components/SectionControls'
import Icon from './components/Icon'

const Viewer = lazy(() => import('./components/viewer/Viewer'))

export default function App() {
  const [status, setStatus] = useState('idle')
  const [walls, setWalls] = useState([])
  const [error, setError] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [clipEnabled, setClipEnabled] = useState(false)
  const [clipHeight, setClipHeight] = useState(WALL_HEIGHT)
  const [modelKey, setModelKey] = useState(0)
  const [resetKey, setResetKey] = useState(0)
  const [modelName, setModelName] = useState('')
  const [isSample, setIsSample] = useState(false)
  const [loadingSample, setLoadingSample] = useState(false)
  const input = useRef()
  const request = useRef(null)
  const objectUrl = useRef(null)
  const hasModel = walls.length > 0
  const loading = status === 'loading'
  const bounds = computeBounds(walls)
  const dismissError = useCallback(() => setError(null), [])

  useEffect(() => () => {
    request.current?.abort()
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  const browse = () => input.current?.click()
  const cancel = () => {
    request.current?.abort()
    request.current = null
    setStatus(hasModel ? 'ready' : 'idle')
  }
  async function startUpload(file, sample = false) {
    if (!sample) {
      try { validateFile(file) } catch (err) { setError(err.message); return }
    }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    objectUrl.current = file ? URL.createObjectURL(file) : null
    setPreviewUrl(objectUrl.current)
    const nextIsSample = sample || isMockMode()
    setLoadingSample(nextIsSample)
    setError(null)
    setStatus('loading')
    try {
      const nextWalls = sample ? await loadSample(controller.signal) : await parseBlueprint(file, { signal: controller.signal })
      if (request.current !== controller || controller.signal.aborted) return
      setWalls(nextWalls)
      setIsSample(nextIsSample)
      setModelName(sample ? 'The corner residence' : file.name)
      setClipEnabled(false)
      setClipHeight(WALL_HEIGHT)
      setModelKey(value => value + 1)
      setStatus('ready')
    } catch (err) {
      if (request.current !== controller || controller.signal.aborted) return
      setError(err.message || 'Something went wrong. Please try again.')
      setStatus(hasModel ? 'ready' : 'idle')
    } finally {
      if (request.current === controller) request.current = null
    }
  }

  return <div className="relative min-h-svh overflow-hidden bg-neutral-950 font-sans text-white selection:bg-indigo-400/30">
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#222035_0%,#0a0a0a_65%)]" />
    <div className={`fixed inset-0 transition-all duration-700 motion-reduce:transition-none ${hasModel ? 'opacity-100' : 'opacity-40 blur-[2px]'}`} aria-label="Interactive 3D floorplan. Drag to orbit, scroll to zoom, right-drag to pan.">
      <Suspense fallback={null}><Viewer walls={walls} modelKey={modelKey} clipEnabled={clipEnabled} clipHeight={clipHeight} resetKey={resetKey} /></Suspense>
    </div>
    <div inert={loading}>
      <Header hasModel={hasModel} loading={loading} mock={isMockMode()} onUpload={browse} />
      <input ref={input} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" aria-label="Upload a floorplan" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) startUpload(file) }} />
      {!hasModel && <main className="pointer-events-none relative z-10 flex min-h-svh items-center justify-center px-6 pt-28 pb-16"><UploadZone onBrowse={browse} onFile={startUpload} onSample={() => startUpload(null, true)} /></main>}
      {hasModel && <>
        <div className="pointer-events-none fixed top-28 left-6 z-10 max-w-[calc(100vw-3rem)] sm:top-32 sm:left-9">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-indigo-200"><span className="size-1.5 rounded-full bg-indigo-300" />{isSample ? 'Sample space' : 'Your space, reimagined'}</div>
          <h1 className="max-w-xs truncate text-xl font-light tracking-tight sm:max-w-md sm:text-3xl">{modelName}</h1>
          <p className="mt-2 text-xs text-white/40">{walls.length} walls <span className="px-2 text-white/20">/</span> {bounds.width.toFixed(1)} × {bounds.depth.toFixed(1)} m <span className="px-2 text-white/20">/</span> {WALL_HEIGHT.toFixed(1)} m high</p>
          {isSample && <p className="mt-2 max-w-xs text-[11px] text-indigo-200/60">Demonstration geometry · not derived from your image</p>}
        </div>
        <SectionControls enabled={clipEnabled} height={clipHeight} onToggle={() => setClipEnabled(value => !value)} onHeight={setClipHeight} onReset={() => { setClipEnabled(false); setClipHeight(WALL_HEIGHT) }} onFit={() => setResetKey(value => value + 1)} />
        <div className="pointer-events-none fixed bottom-8 left-9 hidden items-center gap-2 text-[11px] text-white/35 lg:flex"><Icon name="cube" className="size-4" />Drag to orbit · Scroll to zoom · Right-drag to pan</div>
        <div className="pointer-events-none fixed right-9 bottom-8 hidden text-[10px] tracking-[0.15em] text-white/25 uppercase lg:block">Perspective / 3D</div>
      </>}
      {!hasModel && <footer className="pointer-events-none fixed inset-x-0 bottom-5 z-10 text-center text-[10px] tracking-[0.12em] text-white/25 uppercase">A clearer view of what comes next</footer>}
    </div>
    {loading && <LoadingOverlay previewUrl={previewUrl} sample={loadingSample} onCancel={cancel} />}
    {error && <ErrorToast key={error} message={error} onClose={dismissError} />}
    <p className="sr-only" role="status">{hasModel && !loading ? `3D model ready. ${walls.length} walls. Use the section controls to adjust cut height.` : ''}</p>
  </div>
}
