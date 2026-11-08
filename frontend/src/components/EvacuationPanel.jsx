import { canExplainRoute } from '../api/evacuationBrief'
import { roomAt } from '../lib/evacuation'
import { floorOptions } from '../lib/floorOptions'
import Icon from './Icon'
import { Button, focusRing, Panel, Segmented } from './ui'

const PROMPTS = { fire: 'Click the floor where the fire is.', person: 'Click the floor where you are.' }

const roomLabel = (room, names) => names?.[room.key] ?? room.name

function PlaceRow({ kind, label, icon, iconClass, point, evacuation, names }) {
  const { building, placing, placeInRoom, startPlacing } = evacuation
  const current = point && building ? roomAt(building.maps[point.floor], point) : null
  const active = placing === kind
  const selectId = `escape-${kind}-room`
  const options = map => map.rooms.map(room => <option key={room.key} value={`${room.floor}:${room.id}`}>{roomLabel(room, names)}, {room.area.toFixed(0)} m²</option>)
  const change = event => {
    if (event.target.value === '') return
    const [floor, id] = event.target.value.split(':').map(Number)
    placeInRoom(kind, floor, id)
  }
  return <div>
    <label htmlFor={selectId} className="flex items-center gap-2 text-sm font-medium text-slate-100">{icon && <Icon name={icon} className={`size-4 ${iconClass}`} />}{label}</label>
    <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-2">
      <select id={selectId} value={current ? `${current.floor}:${current.id}` : ''} onChange={change}
        className={`min-h-10 min-w-0 cursor-pointer rounded-lg bg-black/30 px-2 text-sm text-slate-100 pointer-coarse:min-h-11 ${focusRing}`}>
        <option value="" disabled>Choose a room</option>
        {building?.floors > 1
          ? building.maps.map((map, floor) => <optgroup key={floor} label={`Floor ${floor + 1}`}>{options(map)}</optgroup>)
          : building?.maps.map(options)}
      </select>
      <Button aria-pressed={active} onClick={() => startPlacing(kind)} className={active ? 'ring-1 ring-slate-100' : ''}>{active ? 'Cancel' : point ? 'Move' : 'Place'}</Button>
    </div>
  </div>
}

const flights = count => (count === 1 ? 'one flight of stairs' : `${count} flights of stairs`)

function routeEnd({ status, route }) {
  if (status === 'signal') return 'to a window on this floor where you can signal for help'
  const end = status === 'window' ? 'a window you can climb out of' : route.exit === 'door' ? 'the outside door' : 'the opening in the outer wall'
  return route.flights ? `down ${flights(route.flights)} to ${end}` : `to ${end}`
}

function RouteSummary({ plan }) {
  const { status, route, seconds } = plan
  if (status === 'shelter') return <div>
    <h2 className="text-xl font-medium tracking-tight text-red-200">No safe way out from here</h2>
    <p className="mt-1 text-sm leading-6 text-slate-300">The fire cuts off every door and window you can reach, so stay put and make yourself easy to find.</p>
  </div>
  return <div>
    <p className="text-4xl font-medium tracking-tight text-emerald-300 tabular-nums [font-stretch:112%]">{route.length.toFixed(1)} m</p>
    <p className="mt-1 text-sm leading-6 text-slate-300">{routeEnd(plan)}, about {Math.max(1, Math.round(seconds))} seconds at a walk</p>
  </div>
}

/** The steps as one connected line, split where the route changes floor. */
function RouteSteps({ groups }) {
  const total = groups.reduce((sum, group) => sum + group.steps.length, 0)
  const firsts = groups.map((_, index) => groups.slice(0, index).reduce((sum, group) => sum + group.steps.length, 1))
  return <div className="space-y-3">
    {groups.map(({ floor, steps }, group) => <div key={floor}>
      {groups.length > 1 && <h3 className="mb-2 text-sm font-medium text-slate-100">Floor {floor + 1}</h3>}
      <ol start={firsts[group]}>
        {steps.map((step, index) => {
          const number = firsts[group] + index
          return <li key={number} className="relative list-none pb-3 pl-8 text-sm leading-6 text-slate-200 last:pb-0">
            {number < total && index < steps.length - 1 && <span aria-hidden="true" className="absolute top-6 bottom-0 left-2.5 w-px bg-white/15" />}
            <span aria-hidden="true" className="absolute top-0.5 left-0 grid size-5 place-items-center rounded-full bg-white/10 text-xs text-slate-200 tabular-nums">{number}</span>
            {step}
          </li>
        })}
      </ol>
    </div>)}
  </div>
}

function Warnings({ plan }) {
  const { nearFire, route, status, blockedExits, doorTooClose, fireFloor, personFloor, stairsCutOff, pastFurniture } = plan
  const messages = []
  if (fireFloor !== personFloor) {
    const gap = Math.abs(fireFloor - personFloor)
    messages.push(`The fire is on Floor ${fireFloor + 1}, ${gap === 1 ? 'one floor' : `${gap} floors`} ${fireFloor < personFloor ? 'below' : 'above'} you.`)
  }
  if (stairsCutOff) messages.push('The fire has cut off the stairs. Don’t try to go down them.')
  if (pastFurniture) messages.push('Furniture blocks every clear way out, so this route goes past it. Move things aside as you go.')
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

export default function EvacuationPanel({ evacuation, previews, floors, onResetView }) {
  const { fire, person, placing, notice, plan, brief, clear, floor, setFloor } = evacuation
  const imageUrl = previews[person?.floor ?? 0] ?? previews[0]
  const prompt = placing && `${PROMPTS[placing]}${floors > 1 ? ` Showing Floor ${floor + 1}.` : ''}`
  const names = brief.status === 'ready' ? brief.roomNames : null
  const announcement = placing ? prompt : !plan ? '' : plan.route ? `Escape route ready. ${plan.steps.join(' ')}` : `No safe way out. ${plan.steps.join(' ')}`
  return <Panel label="Escape route">
    {floors > 1 && <Segmented legend="Floor on show" name="escape-floor" options={floorOptions(floors)} value={floor} onChange={setFloor} />}
    <div className="space-y-3">
      <PlaceRow kind="fire" label="Fire" icon="flame" iconClass="text-orange-400" point={fire} evacuation={evacuation} names={names} />
      <PlaceRow kind="person" label="You" point={person} evacuation={evacuation} names={names} />
    </div>
    {placing && <p className="text-sm font-medium text-slate-100">{prompt}</p>}
    {notice && <p role="alert" className="text-sm text-orange-200">{notice}</p>}
    {plan && <div className="space-y-4">
      <div>
        <RouteSummary plan={plan} />
        <Warnings plan={plan} />
      </div>
      <RouteSteps groups={plan.stepGroups} />
      {plan.backup && <p className="text-[13px] leading-5 text-slate-300">{plan.backup.signal ? `If smoke blocks the stairs, the dim arrows lead to a window ${plan.backup.length.toFixed(1)} m from you where you can signal for help.` : plan.backup.exit === 'window' ? `If smoke blocks that way, the dim arrows lead to a window ${plan.backup.length.toFixed(1)} m from you.` : `If the window won’t open, the dim arrows lead to the way out, ${plan.backup.length.toFixed(1)} m from you.`}</p>}
      <Explanation evacuation={evacuation} imageUrl={imageUrl} />
    </div>}
    <p className="text-[13px] leading-5 text-slate-400">A planning aid, not a certified escape plan. It only knows what the floor plan shows.</p>
    <div className="-mt-2 grid grid-cols-2 gap-2">
      <Button variant="quiet" onClick={clear} disabled={!fire && !person}>Start over</Button>
      <Button variant="quiet" onClick={onResetView}>Reset camera</Button>
    </div>
    <p className="sr-only" role="status">{announcement}</p>
  </Panel>
}
