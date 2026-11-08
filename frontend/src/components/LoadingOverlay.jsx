import { useEffect, useState } from 'react'
import Icon from './Icon'

const messages = ['Reading floorplan…', 'Tracing walls and openings…', 'Building your space…', 'Adding another dimension…']

export default function LoadingOverlay({ previewUrl, onCancel, sample }) {
  const [step, setStep] = useState(0)
  useEffect(() => { const interval = setInterval(() => setStep(value => (value + 1) % messages.length), 5000); return () => clearInterval(interval) }, [])
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="loading-title" aria-busy="true">
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900/90 p-8 text-center shadow-2xl">
      <div className="relative mx-auto mb-6 grid size-24 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {previewUrl ? <img src={previewUrl} alt="Floorplan being processed" className="size-full object-contain p-2 opacity-60" /> : <Icon name="cube" className="size-9 text-indigo-300" />}
        <div className="absolute inset-0 border-t-2 border-indigo-300 motion-safe:animate-spin" />
      </div>
      <h2 id="loading-title" className="text-xl font-light tracking-tight" role="status">{sample ? 'Opening sample space…' : messages[step]}</h2>
      <p className="mt-3 text-xs leading-5 text-white/40">{sample ? 'An L-shaped space, ready to explore.' : 'A little detail takes a little time. Complex plans may take up to 150 seconds.'}</p>
      <button autoFocus type="button" onClick={onCancel} className="mt-6 rounded-lg px-4 py-2 text-xs text-white/60 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Cancel</button>
    </div>
  </div>
}
