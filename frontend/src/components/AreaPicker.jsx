import { useMemo, useRef, useState } from 'react'
import { centralArea, wallFootprint } from '../lib/sections'

export default function AreaPicker({ walls, bounds, area, onChange }) {
  const [draft, setDraft] = useState(null)
  const anchor = useRef(null)
  const footprints = useMemo(() => walls.map(wall => wallFootprint(wall, bounds)), [walls, bounds])
  const shown = draft ?? area
  const pointAt = event => {
    const svg = event.currentTarget
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM().inverse())
    return { x: Math.max(-bounds.width / 2, Math.min(bounds.width / 2, point.x)), z: Math.max(-bounds.depth / 2, Math.min(bounds.depth / 2, point.y)) }
  }
  const rectangle = (a, b) => ({ minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z) })
  const valid = rect => rect.maxX - rect.minX > 0.05 && rect.maxZ - rect.minZ > 0.05
  function setEdge(key, value) {
    if (!Number.isFinite(value)) return
    const next = { ...(area ?? centralArea(bounds)) }
    const axis = key.endsWith('X') ? 'X' : 'Z'
    const size = axis === 'X' ? bounds.width : bounds.depth
    const coordinate = value - size / 2
    next[key] = key.startsWith('min')
      ? Math.max(-size / 2, Math.min(next[`max${axis}`] - 0.05, coordinate))
      : Math.min(size / 2, Math.max(next[`min${axis}`] + 0.05, coordinate))
    onChange(next)
  }
  return <div className="mt-3 space-y-2">
    <p className="text-[11px] leading-5 text-white/50">Drag a rectangle on the plan. Only wall portions inside it will be cut.</p>
    <svg role="img" aria-label="Floorplan area selector" viewBox={`${-bounds.width / 2 - 0.3} ${-bounds.depth / 2 - 0.3} ${bounds.width + 0.6} ${bounds.depth + 0.6}`}
      className="h-36 w-full touch-none cursor-crosshair rounded-xl border border-white/10 bg-black/25"
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); anchor.current = pointAt(event); setDraft(null) }}
      onPointerMove={event => { if (anchor.current) setDraft(rectangle(anchor.current, pointAt(event))) }}
      onPointerUp={event => {
        if (!anchor.current) return
        const next = rectangle(anchor.current, pointAt(event))
        anchor.current = null
        setDraft(null)
        event.currentTarget.releasePointerCapture(event.pointerId)
        if (valid(next)) onChange(next)
      }}
      onPointerCancel={() => { anchor.current = null; setDraft(null) }}>
      {footprints.map((points, i) => <polygon key={i} points={points.map(p => `${p.x},${p.z}`).join(' ')} fill="#d4d4d8" pointerEvents="none" />)}
      {shown && <rect x={shown.minX} y={shown.minZ} width={shown.maxX - shown.minX} height={shown.maxZ - shown.minZ} fill="#818cf8" fillOpacity={0.25} stroke="#a5b4fc" strokeWidth={0.04} pointerEvents="none" />}
    </svg>
    <div className="flex justify-between gap-2">
      <button type="button" onClick={() => onChange(centralArea(bounds))} className="rounded px-1 py-1 text-[11px] text-indigo-200 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400">Use central area</button>
      <button type="button" onClick={() => onChange(null)} disabled={!area} className="rounded px-1 py-1 text-[11px] text-white/50 hover:text-white focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-30">Clear area</button>
    </div>
    {area && <details className="text-[11px] text-white/50">
      <summary className="cursor-pointer rounded py-1 focus-visible:outline-2 focus-visible:outline-indigo-400">Adjust area in meters</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {[['minX', 'Left'], ['maxX', 'Right'], ['minZ', 'Top'], ['maxZ', 'Bottom']].map(([key, label]) => {
          const size = key.endsWith('X') ? bounds.width : bounds.depth
          return <label key={key} className="space-y-1">{label}<input aria-label={`Area ${label.toLowerCase()} in meters`} type="number" min={0} max={size} step="0.1" value={Number((area[key] + size / 2).toFixed(2))} onChange={event => setEdge(key, Number(event.target.value))} className="w-full rounded-md border border-white/15 bg-neutral-950 px-2 py-1.5 text-white focus-visible:outline-2 focus-visible:outline-indigo-400" /></label>
        })}
      </div>
    </details>}
  </div>
}
