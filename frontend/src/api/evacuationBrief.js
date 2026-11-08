import { fileToBase64, isMockMode } from './parseBlueprint'

export const canExplainRoute = () => !isMockMode()

const round = value => Math.round(value * 100) / 100

/** Only what the writer needs: rooms, where things are, and the finished route's facts. */
export function routeFacts({ map, plan, fire, person }) {
  const { bounds } = map
  const fraction = point => ({ acrossPlan: round((point.x - bounds.minX) / bounds.width), downPlan: round((point.z - bounds.minZ) / bounds.depth) })
  return {
    outcome: plan.status,
    rooms: map.rooms.map(room => ({ id: room.id, name: room.name, areaSquareMeters: round(room.area), ...fraction(room.center) })),
    fire: { roomId: plan.fireRoom?.id ?? null, ...fraction(fire) },
    person: { roomId: plan.personRoom?.id ?? null, nextToFire: plan.nearFire, ...fraction(person) },
    route: plan.route && {
      meters: round(plan.route.length),
      exit: plan.route.exit,
      closestMetersToFire: Number.isFinite(plan.route.minFireDistance) ? round(plan.route.minFireDistance) : null,
      passesThroughFireRoom: Boolean(plan.route.throughFireRoom),
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
export async function requestEvacuationBrief({ map, plan, fire, person, imageUrl, signal }) {
  const body = { facts: routeFacts({ map, plan, fire, person }), ...(await imagePayload(imageUrl, signal)) }
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
