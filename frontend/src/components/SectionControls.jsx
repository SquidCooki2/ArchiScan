import { PLAN_CUT_HEIGHT, elementType } from '../lib/geometry'
import { cutRange } from '../lib/sections'
import AreaPicker from './AreaPicker'
import Icon from './Icon'

const buttonStyle = 'rounded-lg border px-2 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400'
const choiceStyle = active => `${buttonStyle} ${active ? 'border-indigo-400/50 bg-indigo-400/15 text-indigo-200' : 'border-white/10 text-white/55 hover:bg-white/10 hover:text-white'}`

export default function SectionControls({ floorNavigation, section, bounds, walls, selectedWalls, area, onToggle, onAxis, onPosition, onFlip, onScope, onSelect, onSelectAll, onClear, onArea, onReset, onFit, onPlanCut, drawingArea, onStartArea, onCancelArea }) {
  const { enabled, axis, position, flipped, scope } = section
  const range = cutRange(bounds, axis, scope === 'area' ? area : null)
  const sides = axis === 'y' ? ['Keep below', 'Keep above'] : axis === 'x' ? ['Keep left', 'Keep right'] : ['Keep top of plan', 'Keep bottom of plan']
  const label = axis === 'y' ? 'Cut height' : axis === 'x' ? 'Cut position from left' : 'Cut position from top'
  const targetMissing = scope === 'walls' ? !selectedWalls.length : scope === 'area' ? !area : false
  return <section aria-label="Section controls" className="fixed bottom-4 left-1/2 z-20 max-h-[42svh] w-80 max-w-[92vw] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-neutral-900/95 p-4 shadow-2xl backdrop-blur-xl sm:top-28 sm:right-6 sm:bottom-auto sm:left-auto sm:max-h-[calc(100svh-8rem)] sm:translate-x-0">
    <div className="mb-4 border-b border-white/10 pb-4">{floorNavigation}</div>
    <button type="button" role="switch" aria-checked={enabled} aria-label="Section view" onClick={onToggle}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 ${enabled ? 'border-indigo-400/40 bg-indigo-400/10' : 'border-white/15 bg-white/5 hover:bg-white/10'}`}>
      <span className="flex items-center gap-2 text-sm font-medium"><Icon name="section" className="size-4 text-indigo-300" />Section view</span>
      <span className={`text-xs font-medium ${enabled ? 'text-indigo-200' : 'text-white/45'}`}>{drawingArea ? 'Selecting' : enabled ? 'On' : 'Off'}</span>
    </button>
    <details aria-label="Selection tools" open={!area || drawingArea || scope !== 'area'} className="mt-4 border-t border-white/10 pt-3">
      <summary className="mb-3 flex cursor-pointer items-center justify-between gap-2 rounded py-1 text-xs text-indigo-200 focus-visible:outline-2 focus-visible:outline-indigo-400"><span>{scope === 'area' && area ? `${(area.maxX - area.minX).toFixed(2)} × ${(area.maxZ - area.minZ).toFixed(2)} m selected` : 'Choose selection'}</span><span className="text-[10px] text-white/45">Edit selection ▾</span></summary>
      <p className="mb-2 text-xs text-white/50">Selection tools</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Cut target">
        {[['area', 'Area'], ['walls', 'Elements'], ['all', 'Entire floor']].map(([value, name]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => onScope(value)} className={choiceStyle(scope === value)}>{name}</button>)}
      </div>
      {scope === 'walls' && <div className="mt-3 space-y-2">
        <p className="text-[11px] leading-5 text-white/50">Click walls, windows, or doors in 3D to select them. Drag to orbit.</p>
        <div className="flex items-center justify-between gap-2 text-[11px]"><span role="status" className="text-indigo-200">{selectedWalls.length} selected</span><div className="flex gap-2"><button type="button" onClick={onSelectAll} className="rounded p-1 text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Select all</button><button type="button" onClick={onClear} className="rounded p-1 text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Clear selection</button></div></div>
        <details className="text-[11px] text-white/50"><summary className="cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-indigo-400">Choose elements from list</summary>
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded-lg border border-white/10 p-2">
            {walls.map((wall, i) => <label key={i} className="flex cursor-pointer items-center justify-between gap-2 rounded px-1 py-1 hover:bg-white/5"><span className="flex items-center gap-2"><input type="checkbox" checked={selectedWalls.includes(i)} onChange={() => onSelect(i)} className="accent-indigo-400" />{elementType(wall)[0].toUpperCase() + elementType(wall).slice(1)} {i + 1}</span><span>{wall.width.toFixed(2)} m</span></label>)}
          </div>
        </details>
      </div>}
      {scope === 'area' && <div className="mt-3 space-y-2">
        <button type="button" aria-pressed={drawingArea} onClick={drawingArea ? onCancelArea : onStartArea} className="w-full rounded-lg border border-indigo-400/40 bg-indigo-400/15 px-3 py-2.5 text-xs font-medium text-indigo-100 hover:bg-indigo-400/25 focus-visible:outline-2 focus-visible:outline-indigo-400">{drawingArea ? 'Cancel drawing' : area ? 'Redraw area in 3D' : 'Select area in 3D'}</button>
        <p className="text-[11px] leading-5 text-white/55">{drawingArea ? 'Drag on the model floor, or click two corners. Orbit is paused. Esc cancels.' : area ? 'Drag the corner handles to resize; the white handle moves the selection. Drag the cut-plane handle to slice.' : 'Draw your own region directly in the 3D model. The cut updates as you explore.'}</p>
        {area && <div className="flex items-center justify-between gap-2 text-[11px]"><span role="status" className="text-indigo-200">{(area.maxX - area.minX).toFixed(2)} × {(area.maxZ - area.minZ).toFixed(2)} m selected</span><button type="button" onClick={() => onArea(null)} className="rounded px-1 py-1 text-white/60 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Clear area</button></div>}
        <details className="text-[11px] text-white/45"><summary className="cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-indigo-400">Plan and numeric bounds</summary><AreaPicker walls={walls} bounds={bounds} area={area} onChange={onArea} /></details>
      </div>}
      {enabled && targetMissing && <p role="status" className="mt-3 rounded-lg bg-indigo-400/10 px-3 py-2 text-[11px] leading-5 text-indigo-200">{scope === 'walls' ? 'Select elements to start cutting. Other parts stay intact.' : 'Select an area directly in the 3D viewer to start cutting.'}</p>}
    </details>
    <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Cut orientation">
      <button type="button" aria-pressed={axis === 'y'} onClick={() => onAxis('y')} className={choiceStyle(axis === 'y')}>Horizontal</button>
      <button type="button" aria-pressed={axis !== 'y'} onClick={() => onAxis(axis === 'y' ? 'x' : axis)} className={choiceStyle(axis !== 'y')}>Vertical</button>
    </div>
    {axis !== 'y' && <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Vertical cut direction">
      <button type="button" aria-pressed={axis === 'x'} onClick={() => onAxis('x')} className={choiceStyle(axis === 'x')}>Across width · X</button>
      <button type="button" aria-pressed={axis === 'z'} onClick={() => onAxis('z')} className={choiceStyle(axis === 'z')}>Along depth · Z</button>
    </div>}
    <fieldset disabled={!enabled} className="mt-4 disabled:opacity-40">
      <div className="flex items-baseline justify-between gap-2"><label htmlFor="clip-position" className="text-xs text-white/50">{label}</label><output htmlFor="clip-position" className="font-mono text-lg text-indigo-200">{position.toFixed(2)} <span className="text-xs">m</span></output></div>
      <input id="clip-position" type="range" min={range.min} max={range.max} step="0.01" value={position} onChange={event => onPosition(Number(event.target.value))} aria-valuetext={`${position.toFixed(2)} meters`} className="mt-2 h-6 w-full cursor-pointer accent-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:cursor-default" />
      <div className="flex justify-between text-[10px] text-white/35"><span>{range.min.toFixed(2)} m</span><span>{range.max.toFixed(2)} m</span></div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Retained side">
        {sides.map((side, i) => <button key={side} type="button" aria-pressed={flipped === Boolean(i)} onClick={() => onFlip(Boolean(i))} className={choiceStyle(flipped === Boolean(i))}>{side}</button>)}
      </div>
    </fieldset>
    <button type="button" onClick={onPlanCut} aria-pressed={enabled && axis === 'y' && !flipped && Math.abs(position - PLAN_CUT_HEIGHT) < 0.005} className="mt-3 w-full rounded-lg border border-indigo-400/20 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-200 transition-colors hover:bg-indigo-400/20 focus-visible:outline-2 focus-visible:outline-indigo-400">Plan cut at {PLAN_CUT_HEIGHT.toFixed(1)} m</button>
    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
      <button type="button" onClick={onFit} className="rounded-md px-1 py-1 text-xs text-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Fit to view</button>
      <button type="button" onClick={onReset} className="flex items-center gap-1.5 rounded-md px-1 py-1 text-xs text-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400"><Icon name="reset" className="size-3" />Reset section</button>
    </div>
  </section>
}
