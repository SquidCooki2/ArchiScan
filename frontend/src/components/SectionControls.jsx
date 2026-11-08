import { WALL_HEIGHT, PLAN_CUT_HEIGHT } from '../lib/geometry'
import Icon from './Icon'

export default function SectionControls({ enabled, height, onToggle, onHeight, onReset, onFit, onPlanCut }) {
  return <section aria-label="Section controls" className="fixed bottom-5 left-1/2 z-20 w-80 max-w-[90vw] -translate-x-1/2 rounded-2xl border border-white/10 bg-neutral-900/80 p-5 shadow-2xl backdrop-blur-xl transition-all duration-500 motion-reduce:transition-none sm:bottom-7 starting:translate-y-3 starting:opacity-0">
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-sm font-medium"><Icon name="section" className="size-4 text-indigo-300" />Section view</h2>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Section view" onClick={onToggle} className={`relative h-6 w-10 rounded-full border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 ${enabled ? 'border-indigo-400 bg-indigo-400' : 'border-white/15 bg-white/10'}`}><span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform duration-300 ${enabled ? 'translate-x-4' : ''}`} /></button>
    </div>
    <div className="mt-5 flex items-baseline justify-between"><label htmlFor="clip-height" className="text-xs text-white/45">Cut height</label><output htmlFor="clip-height" className={`font-mono text-lg tracking-tight ${enabled ? 'text-indigo-200' : 'text-white/50'}`}>{height.toFixed(2)} <span className="text-xs">m</span></output></div>
    <input id="clip-height" type="range" min="0.1" max={WALL_HEIGHT} step="0.01" value={height} disabled={!enabled} onChange={e => onHeight(Number(e.target.value))} className="mt-3 h-5 w-full cursor-pointer accent-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:cursor-default disabled:opacity-30" aria-valuetext={`${height.toFixed(2)} meters`} />
    <div className="mt-1 flex justify-between text-[10px] text-white/30"><span>0.10 m</span><span>Full height · 2.70 m</span></div>
    <button type="button" onClick={onPlanCut} aria-pressed={enabled && Math.abs(height - PLAN_CUT_HEIGHT) < 0.005} className="mt-3 w-full rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-200 transition-colors hover:bg-indigo-400/20 focus-visible:outline-2 focus-visible:outline-indigo-400">Plan cut at {PLAN_CUT_HEIGHT.toFixed(1)} m</button>
    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
      <button type="button" onClick={onFit} className="rounded-md px-1 py-1 text-xs text-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Fit to view</button>
      <button type="button" onClick={onReset} className="flex items-center gap-1.5 rounded-md px-1 py-1 text-xs text-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"><Icon name="reset" className="size-3" />Reset section</button>
    </div>
  </section>
}
