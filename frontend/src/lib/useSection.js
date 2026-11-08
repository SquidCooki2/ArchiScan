import { useCallback, useState } from 'react'
import { floorBase, MIN_CUT_HEIGHT, PLAN_CUT_HEIGHT, WALL_HEIGHT } from './geometry'
import { createSection, cutRange } from './sections'

/**
 * The model's cut. A height cut at the top of its slider is simply no cut, so there's no on/off
 * switch to explain. `floor` is the floor on show, or 'all'.
 */
export function useSection(bounds, floor, maxHeight) {
  const [section, setSection] = useState(createSection)
  const [area, setArea] = useState(null)
  const [drawing, setDrawing] = useState(false)
  const base = floor === 'all' ? 0 : floorBase(floor)
  const top = floor === 'all' ? maxHeight : base + WALL_HEIGHT
  const bottom = base + MIN_CUT_HEIGHT
  const range = cutRange(bounds, section.axis, section.scope === 'area' ? area : null, top, bottom)
  const cutting = section.enabled && (section.axis !== 'y' || section.position < range.max - 0.005)

  const setPosition = useCallback(position => {
    setSection(current => ({ ...current, position, enabled: current.axis !== 'y' || position < top - 0.005 }))
  }, [top])

  const showPlan = useCallback(() => {
    setSection(current => ({ ...current, axis: 'y', enabled: true, flipped: false, position: base + PLAN_CUT_HEIGHT }))
  }, [base])

  const changeAxis = useCallback(axis => {
    setSection(current => {
      const next = cutRange(bounds, axis, current.scope === 'area' ? area : null, top, bottom)
      return { ...current, axis, flipped: false, enabled: axis !== 'y', position: axis === 'y' ? top : (next.min + next.max) / 2 }
    })
  }, [bounds, area, top, bottom])

  const flip = useCallback(() => setSection(current => ({ ...current, flipped: !current.flipped })), [])

  const startArea = useCallback(() => setDrawing(true), [])
  const cancelArea = useCallback(() => setDrawing(false), [])

  /** Resizing or moving a drawn area keeps a side cut inside it. */
  const updateArea = useCallback(next => {
    setArea(next)
    setSection(current => {
      if (current.axis === 'y') return current
      const limits = cutRange(bounds, current.axis, next, top, bottom)
      return { ...current, position: Math.max(limits.min, Math.min(limits.max, current.position)) }
    })
  }, [bounds, top, bottom])

  const completeArea = useCallback(next => {
    setArea(next)
    setDrawing(false)
    setSection(current => {
      const limits = cutRange(bounds, current.axis, next, top, bottom)
      const fits = current.position > limits.min && current.position < limits.max
      if (current.axis === 'y') {
        return { ...current, scope: 'area', enabled: true, position: current.enabled && fits ? current.position : base + PLAN_CUT_HEIGHT }
      }
      return { ...current, scope: 'area', enabled: true, position: fits ? current.position : (limits.min + limits.max) / 2 }
    })
  }, [bounds, base, top, bottom])

  const removeArea = useCallback(() => {
    setArea(null)
    setDrawing(false)
    setSection(current => ({ ...current, scope: 'all' }))
  }, [])

  const reset = useCallback(() => {
    setSection(createSection())
    setArea(null)
    setDrawing(false)
  }, [])

  /** Keeps side cuts and any drawn area, and lifts a height cut off the model. */
  const clearHeightCut = useCallback(() => {
    setSection(current => (current.axis === 'y' ? { ...current, enabled: false, flipped: false } : current))
  }, [])

  return { section, area, drawing, range, cutting, setPosition, showPlan, changeAxis, flip, startArea, cancelArea, updateArea, completeArea, removeArea, reset, clearHeightCut }
}
