/* oxlint-disable react/immutability -- Held arrows write to a ref the walking camera reads each frame. */
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

/** While walking: how to move, on-screen arrows for touch, and a way to start somewhere else. */
export function WalkControls({ movement, transitioning, onRepick, floor }) {
  const hold = (direction, held) => { movement.current[direction] = held }
  return <section aria-label="Walking controls" className="fixed inset-x-3 bottom-3 z-20 flex items-end justify-between gap-3 sm:inset-x-5 sm:bottom-5">
    <div className="rounded-xl border border-white/10 bg-[#20262e] p-3">
      {floor !== null && <p className="text-sm font-medium text-slate-100">Floor {floor + 1}</p>}
      <p className="text-sm leading-6 text-slate-100"><span className="pointer-coarse:hidden">Use W A S D or the arrow keys to walk. Drag to look.</span><span className="hidden pointer-coarse:inline">Hold an arrow to walk. Drag to look.</span></p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button onClick={onRepick}>Pick another spot</Button>
        <span className="text-[13px] text-slate-400 pointer-coarse:hidden">Esc leaves the walk</span>
      </div>
    </div>
    <div role="group" aria-label="Walk" className="grid shrink-0 grid-cols-3 gap-1 rounded-xl border border-white/10 bg-[#20262e] p-2">
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
