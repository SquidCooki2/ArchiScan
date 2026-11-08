import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSampleWalls, isMockMode, parseBlueprint } from './api/parseBlueprint'
import ErrorToast from './components/ErrorToast'
import Header from './components/Header'
import LoadingOverlay from './components/LoadingOverlay'
import SectionControls from './components/SectionControls'
import UploadZone from './components/UploadZone'
import Viewer from './components/viewer/Viewer'
import {
  ACCEPTED_TYPES,
  MAX_IMAGE_BYTES,
  PLAN_CUT_HEIGHT,
  computeBounds,
  formatBytes,
} from './lib/geometry'
import { DEFAULT_ROOF, computeRoofPlan, roofTopHeight } from './lib/roof'
import { useReducedMotion } from './lib/useReducedMotion'

function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return `${file.name} isn't a supported image. Use a PNG, JPEG, WebP, or GIF.`
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name} is ${formatBytes(file.size)}. Use an image under 5 MB.`
  }
  return null
}

const hasFiles = (e) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

export default function App() {
  const reducedMotion = useReducedMotion()
  const mock = useMemo(() => isMockMode(), [])

  const [status, setStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [walls, setWalls] = useState([])
  const [error, setError] = useState(null) // { id, message }
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fileName, setFileName] = useState('')
  const [pending, setPending] = useState(null) // { url, name } while scanning
  const [clipEnabled, setClipEnabled] = useState(false)
  const [clipHeight, setClipHeight] = useState(null) // null = top of the building (no cut)
  const [roofType, setRoofType] = useState(DEFAULT_ROOF)
  const [loadedAt, setLoadedAt] = useState(0) // when the current model appeared, for the roof drop-in
  const [modelKey, setModelKey] = useState(0)
  const [fitKey, setFitKey] = useState(0)
  const [dragging, setDragging] = useState(false)

  const inputRef = useRef(null)
  const abortRef = useRef(null)

  const bounds = useMemo(() => computeBounds(walls), [walls])
  const hasModel = walls.length > 0

  const roofPlan = useMemo(() => computeRoofPlan(walls), [walls])
  const maxHeight = roofTopHeight(roofPlan, roofType)
  const cutHeight = Math.min(clipHeight ?? maxHeight, maxHeight)

  // Revoke an uploaded image's object URL once it is replaced.
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  const showError = useCallback((message) => setError({ id: Date.now(), message }), [])
  const dismissError = useCallback(() => setError(null), [])

  const showModel = useCallback((nextWalls, url, name) => {
    setWalls(nextWalls)
    setPreviewUrl(url)
    setFileName(name)
    setModelKey((k) => k + 1)
    setFitKey((k) => k + 1)
    setClipEnabled(false)
    setClipHeight(null)
    setLoadedAt(performance.now())
    setStatus('ready')
  }, [])

  const handleFile = async (file) => {
    if (!file || status === 'loading') return
    const problem = validateFile(file)
    if (problem) {
      showError(problem)
      return
    }

    setError(null)
    const url = URL.createObjectURL(file)
    setPending({ url, name: file.name })
    setStatus('loading')
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await parseBlueprint(file, { signal: controller.signal })
      showModel(result, url, file.name)
    } catch (err) {
      URL.revokeObjectURL(url)
      if (err.name !== 'AbortError') showError(err.message)
      // Back to where the user was: keep a previous model if there is one.
      setStatus(hasModel ? 'ready' : 'idle')
    } finally {
      abortRef.current = null
      setPending(null)
    }
  }

  // The window drop listener is attached once; it calls the latest handler through this ref.
  const handleFileRef = useRef(handleFile)
  useEffect(() => {
    handleFileRef.current = handleFile
  })

  const cancelScan = useCallback(() => abortRef.current?.abort(), [])
  const openPicker = useCallback(() => inputRef.current?.click(), [])
  const showSample = useCallback(() => showModel(getSampleWalls(), null, 'Sample plan'), [showModel])

  // Files can be dropped anywhere in the window, in any state.
  useEffect(() => {
    let depth = 0
    const onEnter = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth += 1
      setDragging(true)
    }
    const onOver = (e) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onLeave = (e) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onDrop = (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      handleFileRef.current(e.dataTransfer.files[0])
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

  const toggleClip = () => {
    if (!clipEnabled && cutHeight >= maxHeight) setClipHeight(PLAN_CUT_HEIGHT)
    setClipEnabled((v) => !v)
  }
  const planCut = () => {
    setClipEnabled(true)
    setClipHeight(PLAN_CUT_HEIGHT)
  }
  const resetView = () => {
    setClipEnabled(false)
    setClipHeight(null)
    setFitKey((k) => k + 1)
  }

  const ready = status === 'ready'

  return (
    <>
      <div
        className={`fixed inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#16191e_0%,#0a0a0a_65%)] transition-[filter,opacity] duration-700 ease-out ${
          ready ? '' : 'opacity-70 blur-[3px]'
        }`}
      >
        <Viewer
          walls={walls}
          modelKey={modelKey}
          fitKey={fitKey}
          clipEnabled={clipEnabled}
          clipHeight={cutHeight}
          maxHeight={maxHeight}
          roofPlan={roofPlan}
          roofType={roofType}
          loadedAt={loadedAt}
          reducedMotion={reducedMotion}
        />
      </div>

      <Header
        status={status}
        fileName={fileName}
        previewUrl={previewUrl}
        wallCount={walls.length}
        bounds={bounds}
        mock={mock}
        onNewUpload={openPicker}
      />

      {!hasModel && status !== 'loading' && (
        <UploadZone dragging={dragging} mock={mock} onBrowse={openPicker} onSample={showSample} />
      )}

      {ready && (
        <>
          <h1 className="sr-only">3D model of {fileName}</h1>
          <SectionControls
            clipEnabled={clipEnabled}
            clipHeight={cutHeight}
            maxHeight={maxHeight}
            roofType={roofType}
            onRoofType={setRoofType}
            onToggle={toggleClip}
            onHeight={setClipHeight}
            onPlanCut={planCut}
            onReset={resetView}
          />
        </>
      )}

      {ready && dragging && (
        <div className="pointer-events-none fixed inset-3 z-40 grid place-items-center rounded-3xl border-2 border-dashed border-blueprint-300 bg-blueprint-900/40 backdrop-blur-sm transition-opacity duration-300 starting:opacity-0">
          <p className="text-2xl font-light tracking-tight text-blueprint-200">Drop to scan a new floorplan</p>
        </div>
      )}

      {status === 'loading' && pending && (
        <LoadingOverlay previewUrl={pending.url} fileName={pending.name} onCancel={cancelScan} />
      )}

      {error && <ErrorToast key={error.id} message={error.message} onClose={dismissError} />}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </>
  )
}
