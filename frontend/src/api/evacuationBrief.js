import { buildingRooms } from '../lib/evacuation'
import { fileToBase64, isMockMode } from './parseBlueprint'

export const canExplainRoute = () => !isMockMode()

const round = value => Math.round(value * 100) / 100

/** Only what the writer needs: rooms, where things are, and the finished route's facts. */
export function routeFacts({ building, plan, fire, person }) {
  const fraction = (point, floor) => {
    const { bounds } = building.maps[floor]
    return { floor: floor + 1, acrossPlan: round((point.x - bounds.minX) / bounds.width), downPlan: round((point.z - bounds.minZ) / bounds.depth) }
  }
  return {
    // Signalling from a window is a form of sheltering, as far as the written brief goes.
    outcome: plan.status === 'signal' ? 'shelter' : plan.status,
    rooms: buildingRooms(building).map(room => ({ id: room.key, name: room.name, areaSquareMeters: round(room.area), ...fraction(room.center, room.floor) })),
    fire: { roomId: plan.fireRoom?.key ?? null, ...fraction(fire, fire.floor) },
    person: { roomId: plan.personRoom?.key ?? null, nextToFire: plan.nearFire, ...fraction(person, person.floor) },
    route: plan.route && {
      meters: round(plan.route.length),
      exit: plan.route.exit,
      closestMetersToFire: Number.isFinite(plan.route.minFireDistance) ? round(plan.route.minFireDistance) : null,
      passesThroughFireRoom: Boolean(plan.route.throughFireRoom),
      flightsOfStairsDown: plan.route.flights ?? 0,
    },
    outsideDoorsCutOff: plan.blockedExits.length,
    backupWindowMeters: plan.backup ? round(plan.backup.length) : null,
    steps: plan.steps,
  }
}

async function imagePayload(imageUrl, signal) {
  if (!imageUrl) return {}
  try {
    const response = await fetch(imageUrl, { signal })
    const blob = await response.blob()
    // The brief works without the image, it just can't use the drawing's room names.
    if (!blob.type.startsWith('image/') || blob.size > 5 * 1024 * 1024) return {}
    const { base64, mediaType } = await fileToBase64(blob, signal)
    return { image: base64, mediaType }
  } catch (error) {
    if (signal.aborted) throw error
    return {}
  }
}

/** Asks the backend to put a finished route into plain words. Never changes the route. */
export async function requestEvacuationBrief({ building, plan, fire, person, imageUrl, signal }) {
  const body = { facts: routeFacts({ building, plan, fire, person }), ...(await imagePayload(imageUrl, signal)) }
  let response
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '')}/api/evacuation-brief`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Cannot reach the server. The route and steps above still apply.')
  }
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.brief) throw new Error(result?.error?.message ?? 'Could not write the explanation. The route and steps above still apply.')
  return { text: result.brief, roomNames: Object.fromEntries((result.roomNames ?? []).map(({ id, name }) => [id, name])) }
}
