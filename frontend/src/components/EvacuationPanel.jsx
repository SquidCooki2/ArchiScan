import { canExplainRoute } from '../api/evacuationBrief'
import { roomAt } from '../lib/evacuation'
import Icon from './Icon'
import { Button, focusRing, Panel } from './ui'

const PROMPTS = { fire: 'Click the floor where the fire is.', person: 'Click the floor where you are.' }

const roomLabel = (room, names) => names?.[room.id] ?? room.name

function PlaceRow({ kind, label, icon, iconClass, point, evacuation, names }) {
  const { map, placing, placeInRoom, startPlacing } = evacuation
  const current = point && map ? roomAt(map, point) : null
  const active = placing === kind
  const selectId = `escape-${kind}-room`
  return <div>
    <label htmlFor={selectId} className="flex items-center gap-2 text-sm font-medium text-slate-100"><Icon name={icon} className={`size-4 ${iconClass}`} />{label}</label>
    <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
      <select id={selectId} value={current?.id ?? ''} onChange={event => { if (event.target.value !== '') placeInRoom(kind, Number(event.target.value)) }}
        className={`min-h-10 min-w-0 cursor-pointer rounded-lg bg-black/30 px-2 text-sm text-slate-100 pointer-coarse:min-h-11 ${focusRing}`}>
        <option value="" disabled>Choose a room</option>
        {map?.rooms.map(room => <option key={room.id} value={room.id}>{roomLabel(room, names)}, {room.area.toFixed(0)} m²</option>)}
      </select>
      <Button aria-pressed={active} onClick={() => startPlacing(kind)} className={active ? 'ring-1 ring-slate-100' : ''}>{active ? 'Cancel' : point ? 'Move' : 'Place'}</Button>
    </div>
  </div>
}

function RouteSummary({ plan }) {
  const { status, route, seconds } = plan
  if (status === 'shelter') return <div>
    <h2 className="text-xl font-medium tracking-tight text-red-200">No safe way out from here</h2>
    <p className="mt-1 text-sm leading-6 text-slate-300">The fire cuts off every door and window you can reach, so stay put and make yourself easy to find.</p>
  </div>
  return <div>
    <p className="text-4xl font-medium tracking-tight text-emerald-300 tabular-nums [font-stretch:112%]">{route.length.toFixed(1)} m</p>
    <p className="mt-1 text-sm leading-6 text-slate-300">{status === 'window' ? 'to a window you can climb out of' : route.exit === 'door' ? 'to the outside door' : 'to the opening in the outer wall'}, about {Math.max(1, Math.round(seconds))} seconds at a walk</p>
  </div>
}

function Warnings({ plan }) {
  const { nearFire, route, status, blockedExits, doorTooClose } = plan
  const messages = []
  if (nearFire) messages.push('You are right next to the fire. Move now, and don’t stop for belongings.')
  if (blockedExits.length && status !== 'route') messages.push(blockedExits.length === 1 ? 'The fire has cut off the outside door.' : `The fire has cut off ${blockedExits.length} outside doors.`)
  if (doorTooClose !== undefined) messages.push(`The way to the outside door passes ${doorTooClose.toFixed(1)} m from the fire, so a window is safer.`)
  if (route?.throughFireRoom && !nearFire) messages.push(`This route crosses the room with the fire, staying ${route.minFireDistance.toFixed(1)} m from it. Keep low to stay under the smoke.`)
  if (!messages.length) return null
  return <ul className="mt-3 space-y-2">
    {messages.map(message => <li key={message} className="flex gap-2 rounded-lg bg-orange-400/10 px-3 py-2 text-sm leading-6 text-orange-100"><Icon name="alert" className="mt-1 size-4 shrink-0 text-orange-300" />{message}</li>)}
  </ul>
}

function Explanation({ evacuation, imageUrl }) {
  const { brief, explain } = evacuation
  if (!canExplainRoute()) return null
  if (brief.status === 'ready') return <div className="border-t border-white/10 pt-4">
    <p className="text-sm leading-6 text-slate-100">{brief.text}</p>
    <p className="mt-2 text-[13px] leading-5 text-slate-400">Written by Claude from this route. The arrows and steps come from the plan’s geometry, not from the AI.</p>
  </div>
  return <div className="border-t border-white/10 pt-4">
    <Button className="w-full" onClick={() => explain(imageUrl)} disabled={brief.status === 'loading'} aria-busy={brief.status === 'loading'}>{brief.status === 'loading' ? 'Claude is writing…' : brief.status === 'error' ? 'Try the explanation again' : 'Explain this route with AI'}</Button>
    {brief.status === 'error' && <p role="alert" className="mt-2 text-sm leading-6 text-red-200">{brief.message}</p>}
  </div>
}

export default function EvacuationPanel({ evacuation, imageUrl, floors, onResetView }) {
  const { fire, person, placing, notice, plan, brief, clear } = evacuation
  const names = brief.status === 'ready' ? brief.roomNames : null
  const announcement = placing ? PROMPTS[placing] : !plan ? '' : plan.route ? `Escape route ready. ${plan.steps.join(' ')}` : `No safe way out. ${plan.steps.join(' ')}`
  return <Panel label="Escape route">
    <div className="space-y-3">
      <PlaceRow kind="fire" label="Fire" icon="flame" iconClass="text-orange-400" point={fire} evacuation={evacuation} names={names} />
      <PlaceRow kind="person" label="You" icon="person" iconClass="text-slate-100" point={person} evacuation={evacuation} names={names} />
    </div>
    {floors > 1 && <p className="text-[13px] leading-5 text-slate-300">Routes cover the ground floor. Upper floors need stairs, which floor plan data doesn’t include yet.</p>}
    {placing && <p className="text-sm font-medium text-slate-100">{PROMPTS[placing]}</p>}
    {notice && <p role="alert" className="text-sm text-orange-200">{notice}</p>}
    {plan && <div className="space-y-4">
      <div>
        <RouteSummary plan={plan} />
        <Warnings plan={plan} />
      </div>
      <ol className="space-y-2">
        {plan.steps.map((step, index) => <li key={step} className="grid grid-cols-[1.25rem_1fr] text-sm leading-6 text-slate-200"><span className="text-slate-400 tabular-nums">{index + 1}</span>{step}</li>)}
      </ol>
      {plan.backup && <p className="text-[13px] leading-5 text-slate-300">{plan.backup.exit === 'window' ? `If smoke blocks that way, the dim arrows lead to a window ${plan.backup.length.toFixed(1)} m from you.` : `If the window won’t open, the dim arrows lead to the way out, ${plan.backup.length.toFixed(1)} m from you.`}</p>}
      <Explanation evacuation={evacuation} imageUrl={imageUrl} />
    </div>}
    <p className="text-[13px] leading-5 text-slate-400">A planning aid, not a certified escape plan. It only knows what the floor plan shows.</p>
    <div className="-mt-2 grid grid-cols-2 gap-2">
      <Button variant="quiet" onClick={clear} disabled={!fire && !person}><Icon name="reset" className="size-3.5" />Start over</Button>
      <Button variant="quiet" onClick={onResetView}>Reset camera</Button>
    </div>
    <p className="sr-only" role="status">{announcement}</p>
  </Panel>
}
