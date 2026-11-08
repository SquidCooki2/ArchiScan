import { useEffect, useState } from 'react'

const STEPS = ['Reading floorplan…', 'Finding wall lines…', 'Measuring rooms…', 'Building the model…']
const STEP_MS = 2600

function formatElapsed(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function LoadingOverlay({ previewUrl, fileName, onCancel }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  // Steps advance with time and hold on the last one.
  const step = STEPS[Math.min(Math.floor((elapsed * 1000) / STEP_MS), STEPS.length - 1)]

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/40 px-4 backdrop-blur-md transition-opacity duration-300 starting:opacity-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="loading-status"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-all duration-300 ease-out starting:scale-95 starting:opacity-0">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-neutral-100">
          {previewUrl && (
            <img src={previewUrl} alt={`Floorplan being scanned: ${fileName}`} className="size-full object-contain" />
          )}
          <div className="absolute inset-0 bg-blueprint-900/25" />
          <div className="pointer-events-none absolute inset-0 animate-scan motion-reduce:hidden">
            <div className="h-full border-b-2 border-blueprint-400 bg-gradient-to-b from-transparent via-blueprint-300/10 to-blueprint-300/35" />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 px-1">
          <span
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-blueprint-300 motion-reduce:animate-none"
            aria-hidden="true"
          />
          <p id="loading-status" className="text-base text-neutral-100" aria-live="polite">
            {step}
          </p>
          <span className="ml-auto text-sm text-neutral-500 tabular-nums">{formatElapsed(elapsed)}</span>
        </div>
        <p className="mt-1.5 px-1 text-sm text-neutral-400">
          {elapsed < 20 ? 'Detailed plans can take up to a minute.' : 'Still working. Complex plans take longer.'}
        </p>

        <button
          type="button"
          onClick={onCancel}
          className="mt-4 h-11 w-full cursor-pointer rounded-xl border border-white/10 text-sm text-neutral-200 transition-all duration-300 ease-out hover:border-white/25 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-300"
        >
          Cancel scan
        </button>
      </div>
    </div>
  )
}
