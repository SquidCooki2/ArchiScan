/* oxlint-disable react/immutability -- Held arrows write to a ref the walking camera reads each frame. */
import { useEffect, useState } from 'react'
import { floorOptions } from '../lib/floorOptions'
import Icon from './Icon'
import { Button, focusRing, Panel, Segmented } from './ui'

/** Before walking: pick the spot. */
export function WalkStart({ floors, floor, onFloor, placement, onMiddle }) {
  return <Panel label="Choose where to start walking">
    <div>
      <h2 className="text-lg font-medium tracking-tight text-slate-100">Pick a starting spot</h2>
      <p className="mt-1 text-sm leading-6 text-slate-300">Click anywhere on the floor to start walking there at eye height.{floors > 1 ? ' Walk up or down the stairs to change floors.' : ''}</p>
    </div>
    {floors > 1 && <Segmented legend="Floor" name="walk-floor" options={floorOptions(floors)} value={floor} onChange={onFloor} />}
    {placement && !placement.valid && <p role="status" className="text-sm leading-6 text-red-200">{placement.reason}</p>}
    <Button className="w-full" onClick={onMiddle}>Start in the middle</Button>
    <p className="text-[13px] leading-5 text-slate-400">Ceiling heights are assumed, at 2.7 m per floor.</p>
  </Panel>
}

const ARROWS = [
  { direction: 'forward', name: 'Walk forward', rotate: '-rotate-90', place: 'col-start-2' },
  { direction: 'left', name: 'Walk left', rotate: 'rotate-180', place: 'col-start-1 row-start-2' },
  { direction: 'backward', name: 'Walk backward', rotate: 'rotate-90', place: 'col-start-2 row-start-2' },
  { direction: 'right', name: 'Walk right', rotate: '', place: 'col-start-3 row-start-2' },
]

const stairsText = stairs => `Stairs ${stairs.direction} to Floor ${stairs.floor + 1}`

/** Pointer hidden: only where you are, and how to get the pointer back until you've seen it. */
function LockedHud({ floor, stairs }) {
  const [showKeys, setShowKeys] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setShowKeys(false), 6000)
    return () => clearTimeout(timer)
  }, [])
  const line = stairs ? stairsText(stairs) : floor !== null ? `Floor ${floor + 1}` : null
  return <div className="pointer-events-none fixed inset-x-3 bottom-5 z-20 flex flex-col items-center gap-2">
    <p className={`rounded-lg bg-[#20262e] px-3 py-2 text-center text-sm leading-6 text-slate-100 transition-opacity duration-300 motion-reduce:transition-none ${showKeys ? 'opacity-100' : 'opacity-0'}`}>W A S D to walk. Move the mouse to look. Esc shows the pointer.</p>
    {line && <p className="rounded-lg bg-[#20262e] px-3 py-2 text-sm font-medium text-slate-100">{line}</p>}
    <span aria-hidden="true" className="fixed top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 ring-1 ring-black/40" />
  </div>
}

/** While walking: how to move, on-screen arrows for touch, and a way to start somewhere else. */
export function WalkControls({ movement, transitioning, onRepick, floor, locked, stairs }) {
  const hold = (direction, held) => { movement.current[direction] = held }
  if (locked) return <LockedHud floor={floor} stairs={stairs} />
  return <section aria-label="Walking controls" className="fixed inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3 sm:inset-x-5 sm:bottom-5">
    <div className="rounded-xl border border-white/10 bg-[#20262e] p-3">
      {floor !== null && <p className="text-sm font-medium text-slate-100">Floor {floor + 1}</p>}
      {stairs && <p className="text-sm font-medium text-sky-300" role="status">{stairsText(stairs)}</p>}
      <p className="text-sm leading-6 text-slate-100"><span className="pointer-coarse:hidden">Click the view to look around with the mouse. W A S D or the arrow keys walk, and Q and E turn.</span><span className="hidden pointer-coarse:inline">Hold an arrow to walk. Drag to look.</span></p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button onClick={onRepick}>Pick another spot</Button>
        <span className="text-[13px] text-slate-400 pointer-coarse:hidden">Esc leaves the walk</span>
      </div>
    </div>
    <div role="group" aria-label="Walk" className="hidden shrink-0 grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#20262e] p-2 pointer-coarse:grid">
      {ARROWS.map(({ direction, name, rotate, place }) => <button key={direction} type="button" aria-label={name} disabled={transitioning}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); hold(direction, true) }}
        onPointerUp={event => { hold(direction, false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
        onPointerCancel={() => hold(direction, false)} onLostPointerCapture={() => hold(direction, false)}
        onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); hold(direction, true) } }}
        onKeyUp={() => hold(direction, false)} onBlur={() => hold(direction, false)}
        className={`${place} grid size-11 cursor-pointer touch-none place-items-center rounded-lg bg-white/8 text-slate-100 transition-colors duration-150 hover:bg-white/14 disabled:opacity-40 ${focusRing}`}><Icon name="arrow" className={`size-5 ${rotate}`} /></button>)}
    </div>
  </section>
}
