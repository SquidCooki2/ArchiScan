import { useState } from 'react'
import { ROOF_TYPES } from '../lib/roof'
import Icon from './Icon'
import { floorOptions } from '../lib/floorOptions'
import { Button, focusRing, Panel, Segmented, Switch } from './ui'

const DIRECTIONS = [
  { id: 'y', label: 'Above' },
  { id: 'x', label: 'Side' },
  { id: 'z', label: 'Front' },
]

function CutSlider({ cut }) {
  const { section, range, cutting } = cut
  const height = section.axis === 'y'
  const value = height && !cutting ? range.max : section.position
  const readout = height && !cutting ? 'Whole model' : `${value.toFixed(1)} m`
  return <div>
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor="cut-position" className="text-sm font-medium text-slate-100">{height ? 'Cut height' : 'Cut position'}</label>
      <output htmlFor="cut-position" className={`text-sm tabular-nums ${cutting ? 'text-sky-300' : 'text-slate-300'}`}>{readout}</output>
    </div>
    <input id="cut-position" type="range" min={range.min} max={range.max} step="0.01" value={value} onChange={event => cut.setPosition(Number(event.target.value))} aria-valuetext={readout} className={`mt-1 h-8 w-full cursor-pointer accent-sky-300 ${focusRing}`} />
  </div>
}

function AreaTool({ cut }) {
  const { area, drawing, startArea, cancelArea, removeArea } = cut
  if (drawing) return <div>
    <p className="text-sm leading-6 text-slate-200" role="status">Drag on the floor, or click two corners.</p>
    <Button className="mt-2 w-full" onClick={cancelArea}>Cancel</Button>
  </div>
  if (area) return <div>
    <p className="text-sm leading-6 text-slate-200" role="status">Cutting a {(area.maxX - area.minX).toFixed(1)} × {(area.maxZ - area.minZ).toFixed(1)} m area. Drag its corners to resize it, or the white center handle to move it. The roof stays off while an area is cut.</p>
    <Button className="mt-2 w-full" onClick={removeArea}>Cut the whole model again</Button>
  </div>
  return <div>
    <p className="text-sm leading-6 text-slate-300">Cut just one part of the model.</p>
    <Button className="mt-2 w-full" onClick={startArea}>Draw an area</Button>
  </div>
}

function MoreOptions({ cut }) {
  const { section, cutting, changeAxis, flip } = cut
  const [open, setOpen] = useState(section.axis !== 'y' || section.scope === 'area')
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="group border-t border-white/10 pt-3">
    <summary className={`flex min-h-9 cursor-pointer list-none items-center justify-between rounded-md text-sm text-slate-200 hover:text-white [&::-webkit-details-marker]:hidden ${focusRing}`}>
      More options<Icon name="chevron" className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="mt-3 space-y-4">
      <Segmented legend="Cut from" name="cut-direction" options={DIRECTIONS} value={section.axis} onChange={changeAxis} />
      <Button className="w-full" aria-pressed={section.flipped} disabled={!cutting} onClick={flip}>{section.axis === 'y' ? (section.flipped ? 'Show the part below' : 'Show the part above') : 'Show the other side'}</Button>
      <AreaTool cut={cut} />
    </div>
  </details>
}

export default function ExplorePanel({ floors, floor, onFloor, roofType, onRoof, cut, onResetView, hasFurniture, showFurniture, onShowFurniture }) {
  return <Panel label="Explore the model">
    {floors > 1 && <Segmented legend="Floors" name="floors" options={floorOptions(floors, { all: true })} value={floor} onChange={onFloor} />}
    {floor === 'all' && <Segmented legend="Roof" name="roof-style" options={ROOF_TYPES} value={roofType} onChange={onRoof} />}
    <div>
      <CutSlider cut={cut} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button onClick={cut.showPlan}>See floor plan</Button>
        <Button variant="quiet" disabled={!cut.cutting && !cut.area} onClick={cut.reset}>Undo cut</Button>
      </div>
    </div>
    {hasFurniture && <Switch label="Furniture" checked={showFurniture} onChange={onShowFurniture} />}
    <MoreOptions key={floor} cut={cut} />
    <Button variant="quiet" className="-mt-2 w-full" onClick={onResetView}>Reset camera</Button>
  </Panel>
}
