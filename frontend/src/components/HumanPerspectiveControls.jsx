import { useRef } from 'react'
import { EYE_HEIGHT, HUMAN_DRAG_TYPE, WALK_SPEED } from '../lib/walkthrough'
import Icon from './Icon'

export default function HumanPerspectiveControls({ mode, placement, bounds, floor, bridge, onCancel, onReposition, movement, locked, transitioning }) {
  const touchDrag = useRef(null)
  const buttonClass = 'rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/80 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-indigo-400'
  if (mode === 'placing') return <section aria-label="Human placement" className="fixed bottom-4 left-1/2 z-20 max-h-[42svh] w-80 max-w-[92vw] -translate-x-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-neutral-900/95 p-5 shadow-2xl backdrop-blur-xl sm:top-28 sm:right-6 sm:bottom-auto sm:left-auto sm:max-h-[calc(100svh-8rem)] sm:translate-x-0">
    <h2 className="flex items-center gap-2 text-sm font-medium"><Icon name="person" className="size-5 text-indigo-300" />Place yourself in the model</h2>
    <p className="mt-3 text-xs leading-5 text-white/55">Drag the person onto clear floor and drop to enter. Or click a floor spot, preview it, then enter.</p>
    <button type="button" draggable aria-label="Drag human onto model" title="Drag onto clear model floor"
      onDragStart={event => { event.dataTransfer.setData(HUMAN_DRAG_TYPE, '1'); event.dataTransfer.effectAllowed = 'copy' }}
      onPointerDown={event => { if (event.pointerType !== 'touch') return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); touchDrag.current = event.pointerId }}
      onPointerMove={event => { if (touchDrag.current === event.pointerId) bridge.current?.preview(event.clientX, event.clientY) }}
      onPointerUp={event => { if (touchDrag.current !== event.pointerId) return; touchDrag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); bridge.current?.drop(event.clientX, event.clientY) }}
      onPointerCancel={() => { touchDrag.current = null }}
      className="mt-4 flex w-full touch-none cursor-grab items-center justify-center gap-3 rounded-xl border border-dashed border-indigo-400/40 bg-indigo-400/10 p-4 text-sm text-indigo-200 active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-indigo-400"><Icon name="person" className="size-9" />Drag to place</button>
    <p role="status" className={`mt-4 rounded-lg px-3 py-2 text-xs leading-5 ${placement?.valid ? 'bg-indigo-400/10 text-indigo-200' : placement ? 'bg-red-400/10 text-red-200' : 'bg-white/5 text-white/50'}`}>{placement?.reason ?? 'Choose a starting location on the model floor.'}</p>
    <button type="button" disabled={!placement?.valid} onClick={() => bridge.current?.enter()} className="mt-3 w-full rounded-xl border border-indigo-400/40 bg-indigo-400/20 px-3 py-3 text-xs font-medium text-indigo-100 hover:bg-indigo-400/30 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-30">Enter Human Perspective</button>
    <details className="mt-3 text-[11px] text-white/50"><summary className="cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-indigo-400">Set location in meters</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">{[['x', 'From left', bounds.width], ['z', 'From top', bounds.depth]].map(([axis, label, size]) => <label key={axis}>{label}<input aria-label={`Human position ${label.toLowerCase()} in meters`} type="number" min={0} max={size} step="0.1" value={Number(((placement?.[axis] ?? 0) + size / 2).toFixed(2))} onChange={event => {
        const value = Number(event.target.value)
        if (Number.isFinite(value)) bridge.current?.set({ x: placement?.x ?? 0, z: placement?.z ?? 0, [axis]: value - size / 2 })
      }} className="mt-1 w-full rounded-lg border border-white/15 bg-neutral-950 px-2 py-2 text-xs text-white focus-visible:outline-2 focus-visible:outline-indigo-400" /></label>)}</div>
    </details>
    <p className="mt-4 text-[10px] leading-5 text-white/45">{floor?.label} · Base {floor?.elevation.toFixed(1)} m<br />Eye height {EYE_HEIGHT.toFixed(2)} m · Walking {WALK_SPEED.toFixed(1)} m/s<br /><span className="text-indigo-200/80">Model scale unverified; 2.7 m height assumed.</span><br />Floor coverage is inferred from plan bounds. Doors open for the walkthrough. Section edits return in overview.</p>
    <button type="button" onClick={onCancel} className={`${buttonClass} mt-3 w-full`}>Back to overview</button>
  </section>

  if (mode !== 'human') return null
  return <>
    <div className="pointer-events-none fixed top-24 left-4 z-20 rounded-xl border border-white/10 bg-neutral-950/80 px-3 py-2 text-[10px] text-white/70 backdrop-blur-xl sm:top-28 sm:left-7">Human Perspective · {floor?.label} · {EYE_HEIGHT.toFixed(2)} m eye height<br /><span className="text-indigo-200/70">Scale unverified · 2.7 m height assumed</span></div>
    <section aria-label="Walkthrough navigation" className="fixed right-4 bottom-4 left-4 z-20 flex items-end justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/90 p-3 backdrop-blur-xl sm:right-7 sm:bottom-7 sm:left-7 sm:p-4">
      <div className="space-y-2">
        <p className="text-xs text-white/75">{transitioning ? 'Moving to your viewpoint…' : locked ? 'Mouse look active · WASD / arrows to walk' : 'Drag to look · WASD / arrows to walk'}</p>
        <p className="text-[10px] text-white/45">{WALK_SPEED.toFixed(1)} m/s · Escape or Exit returns to overview</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={onReposition} className={buttonClass}>Choose another starting point</button><button id="human-mouse-look" type="button" disabled={locked || transitioning} onClick={() => bridge.current?.lock()} className={`${buttonClass} hidden sm:block disabled:opacity-40`}>{locked ? 'Mouse look active' : 'Enable mouse look'}</button></div>
      </div>
      <div className="grid shrink-0 grid-cols-3 gap-1" role="group" aria-label="Walking controls">
        {[['forward', '↑', 'Move forward', 'col-start-2'], ['left', '←', 'Move left', 'col-start-1 row-start-2'], ['backward', '↓', 'Move backward', 'row-start-2'], ['right', '→', 'Move right', 'row-start-2']].map(([direction, label, name, position]) => <button key={direction} type="button" aria-label={name} disabled={transitioning}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); movement.current[direction] = true }}
          onPointerUp={event => { movement.current[direction] = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
          onPointerCancel={() => { movement.current[direction] = false }} onLostPointerCapture={() => { movement.current[direction] = false }}
          onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); movement.current[direction] = true } }}
          onKeyUp={() => { movement.current[direction] = false }} onBlur={() => { movement.current[direction] = false }}
          className={`${position} grid size-10 touch-none place-items-center rounded-lg border border-white/15 bg-white/5 text-lg text-white/80 hover:bg-indigo-400/20 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-30`}>{label}</button>)}
      </div>
    </section>
  </>
}
