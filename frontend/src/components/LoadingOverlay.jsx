import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../lib/useReducedMotion'
import Icon from './Icon'
import { Button } from './ui'

const MESSAGES = ['Reading your floor plan…', 'Finding walls, doors, and windows…', 'Building the model…']

/** A scan line passes over the drawing while it's read; the wait is the product working. */
export default function LoadingOverlay({ previewUrl, floors = 1, sample, onCancel }) {
  const [step, setStep] = useState(0)
  const line = useRef(null)
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    const interval = setInterval(() => setStep(value => Math.min(value + 1, MESSAGES.length - 1)), 5000)
    return () => clearInterval(interval)
  }, [])
  useEffect(() => {
    const onKeyDown = event => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  useEffect(() => {
    if (reducedMotion || !line.current) return
    const animation = line.current.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(9.5rem)' }], { duration: 1800, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' })
    return () => animation.cancel()
  }, [reducedMotion])
  const title = sample ? 'Opening the sample…' : floors > 1 && step === 0 ? `Reading ${floors} floor plans…` : MESSAGES[step]
  return <div className="fixed inset-0 z-40 grid place-items-center bg-[#171c22]/75 p-6" role="dialog" aria-modal="true" aria-labelledby="loading-title" aria-busy="true">
    <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#20262e] p-6 shadow-[0_16px_48px_rgb(0_0_0/0.4)]">
      <div className="relative h-40 overflow-hidden rounded-lg bg-white/95">
        {previewUrl ? <img src={previewUrl} alt="The floor plan being read" className="size-full object-contain p-2" /> : <div className="grid size-full place-items-center text-[#171c22]/40"><Icon name="cube" className="size-10" /></div>}
        <div ref={line} className="absolute inset-x-0 top-0 h-0.5 bg-sky-500 shadow-[0_0_12px_2px_rgb(14_165_233/0.6)]" />
      </div>
      <h2 id="loading-title" role="status" className="mt-5 text-lg font-medium tracking-tight text-slate-100">{title}</h2>
      {!sample && <p className="mt-1 text-sm leading-6 text-slate-300">Detailed plans can take up to two minutes.</p>}
      <Button autoFocus className="mt-4 w-full" onClick={onCancel}>Cancel</Button>
    </div>
  </div>
}
