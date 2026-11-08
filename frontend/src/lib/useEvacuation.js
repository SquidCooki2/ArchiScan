import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requestEvacuationBrief } from '../api/evacuationBrief'
import { buildEvacuationMap, computeFireField, planEvacuation, snapToFloor } from './evacuation'

const IDLE_BRIEF = { status: 'idle' }

/** State for the escape route mode: where the fire and the person are, and the resulting plan. */
export function useEvacuation(walls) {
  const [active, setActive] = useState(false)
  const [fire, setFire] = useState(null)
  const [person, setPerson] = useState(null)
  const [placing, setPlacing] = useState(null)
  const [notice, setNotice] = useState(null)
  const [brief, setBrief] = useState(IDLE_BRIEF)
  const request = useRef(null)

  const map = useMemo(() => (active && walls.length ? buildEvacuationMap(walls) : null), [active, walls])
  const fireField = useMemo(() => (map && fire ? computeFireField(map, fire) : null), [map, fire])
  const plan = useMemo(() => (map && fire && person ? planEvacuation(map, fire, person, fireField) : null), [map, fire, person, fireField])

  const dropBrief = useCallback(() => {
    request.current?.abort()
    request.current = null
    setBrief(IDLE_BRIEF)
  }, [])
  useEffect(() => () => request.current?.abort(), [])

  const setters = useMemo(() => ({ fire: setFire, person: setPerson }), [])
  const open = useCallback(() => {
    setActive(true)
    setPlacing(fire ? (person ? null : 'person') : 'fire')
  }, [fire, person])
  // Keeps the fire and the person, so switching back to explore and return doesn't lose the plan.
  const close = useCallback(() => {
    setActive(false)
    setPlacing(null)
    setNotice(null)
  }, [])
  const reset = useCallback(() => {
    setFire(null)
    setPerson(null)
    setPlacing(null)
    setNotice(null)
    dropBrief()
  }, [dropBrief])
  const clear = useCallback(() => {
    reset()
    setPlacing('fire')
  }, [reset])
  const leave = useCallback(() => {
    reset()
    setActive(false)
  }, [reset])

  /** Live position changes from dragging. Spots off the floor are ignored. */
  const move = useCallback((kind, point) => {
    if (!map) return false
    const snapped = snapToFloor(map, point)
    if (!snapped) return false
    setters[kind](snapped)
    dropBrief()
    return true
  }, [map, setters, dropBrief])

  /** A click or tap on the floor while placing. Moves on to whatever is still unplaced. */
  const place = useCallback(point => {
    if (!placing) return
    if (!move(placing, point)) {
      setNotice('Pick a spot inside the building.')
      return
    }
    setNotice(null)
    setPlacing(placing === 'fire' && !person ? 'person' : null)
  }, [placing, person, move])

  const placeInRoom = useCallback((kind, roomId) => {
    const room = map?.rooms[roomId]
    if (!room) return
    setters[kind](room.center)
    setNotice(null)
    dropBrief()
    setPlacing(current => (current === kind ? (kind === 'fire' && !person ? 'person' : kind === 'person' && !fire ? 'fire' : null) : current))
  }, [map, setters, person, fire, dropBrief])

  const startPlacing = useCallback(kind => {
    setNotice(null)
    setPlacing(current => (current === kind ? null : kind))
  }, [])
  const cancelPlacing = useCallback(() => {
    setNotice(null)
    setPlacing(null)
  }, [])

  const explain = useCallback(async imageUrl => {
    if (!plan) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBrief({ status: 'loading' })
    try {
      const result = await requestEvacuationBrief({ map, plan, fire, person, imageUrl, signal: controller.signal })
      if (request.current === controller) setBrief({ status: 'ready', ...result })
    } catch (error) {
      if (request.current === controller && !controller.signal.aborted) setBrief({ status: 'error', message: error.message })
    }
  }, [map, plan, fire, person])

  return { active, open, close, leave, reset, clear, map, fire, person, fireField, plan, placing, notice, brief, move, place, placeInRoom, startPlacing, cancelPlacing, explain }
}
