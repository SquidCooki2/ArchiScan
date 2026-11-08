import { useMemo } from 'react'
import { billOfMaterials, displayQuantity, displaySize, measureBuilding, orderQuantity, UNIT_SYSTEMS } from '../lib/billOfMaterials'
import { floorOptions } from '../lib/floorOptions'
import { ROOF_TYPES } from '../lib/roof'
import Icon from './Icon'
import { Panel, Segmented } from './ui'

const headCell = 'pb-1.5 text-[13px] font-normal text-slate-400'
const numberCell = 'py-2 pl-3 text-right whitespace-nowrap tabular-nums align-top'

function Group({ code, title, children }) {
  return <section>
    <h3 className="text-sm font-medium text-slate-100">{code && <span className="mr-2 font-normal text-slate-400 tabular-nums">{code}</span>}{title}</h3>
    <div className="mt-2 overflow-x-auto">{children}</div>
  </section>
}

function Table({ heads, children }) {
  return <table className="w-full border-collapse text-sm text-slate-100">
    <thead>
      <tr>{heads.map((head, index) => <th key={head} scope="col" className={`${headCell} ${index ? 'pl-3 text-right whitespace-nowrap' : 'text-left'}`}>{head}</th>)}</tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
}

const Row = ({ children }) => <tr className="border-t border-white/8">{children}</tr>
const Stat = ({ label, value }) => <div>
  <dt className="text-[13px] leading-5 text-slate-400">{label}</dt>
  <dd className="mt-0.5 text-lg font-medium text-slate-100 tabular-nums">{value}</dd>
</div>

/** What the plan adds up to, with the schedules an architect would issue alongside it. */
export default function BomPanel({ walls, floors, floor, onFloor, roofType, onRoof, units, onUnits }) {
  const measured = useMemo(() => measureBuilding(walls), [walls])
  const bom = useMemo(() => billOfMaterials(walls, { roofType, floor }, measured), [walls, roofType, floor, measured])
  const size = meters => displaySize(meters, units)
  const sizeHead = units === 'metric' ? 'Size, mm' : 'Size'
  const area = value => displayQuantity(value, 'area', units).text
  const length = value => displayQuantity(value, 'length', units).text
  const { summary } = bom

  return <Panel label="Bill of materials" wide>
    <h2 className="text-base font-medium tracking-tight text-slate-100">Bill of materials</h2>

    <div className="grid gap-4 lg:grid-cols-2">
      {floors > 1 && <div className="lg:col-span-2"><Segmented legend="Floors" name="bom-floor" options={floorOptions(floors, { all: true })} value={floor} onChange={onFloor} /></div>}
      <Segmented legend="Units" name="bom-units" options={UNIT_SYSTEMS} value={units} onChange={onUnits} />
      {floor === 'all' && <Segmented legend="Roof" name="bom-roof" options={ROOF_TYPES} value={roofType} onChange={onRoof} />}
    </div>

    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
      <Stat label="Gross floor area" value={area(summary.grossFloor)} />
      <Stat label="Net floor area" value={area(summary.netFloor)} />
      <Stat label="Net wall area" value={area(summary.wallArea)} />
      <Stat label="Glass to floor" value={`${Math.round(summary.glazingRatio * 100)}%`} />
    </dl>

    {bom.checks.length > 0 && <Group title="Worth checking">
      <ul className="space-y-2">
        {bom.checks.map(check => <li key={check.label} className="flex gap-2 text-sm leading-6">
          {check.pass ? <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-slate-400" /> : <Icon name="alert" className="mt-1 size-4 shrink-0 text-slate-100" />}
          <p className={check.pass ? 'text-slate-300' : 'text-slate-100'}><span className="font-medium">{check.label}.</span> {check.text}</p>
        </li>)}
      </ul>
      <p className="mt-2 text-[13px] leading-5 text-slate-400">A first look against 2021 IRC figures, not a code review.</p>
    </Group>}

    <Group title="Wall types">
      <Table heads={['Type', units === 'metric' ? 'Thickness, mm' : 'Thickness', 'Length', 'Area']}>
        {bom.walls.map(wall => <Row key={wall.mark}>
          <td className="py-2 align-top"><span className="font-medium">{wall.mark}</span> {wall.exterior ? 'Exterior' : 'Interior'}</td>
          <td className={numberCell}>{size(wall.thickness)}</td>
          <td className={numberCell}>{length(wall.length)}</td>
          <td className={numberCell}>{area(wall.area)}</td>
        </Row>)}
      </Table>
    </Group>

    {bom.sections.map(section => <Group key={section.id} code={section.code} title={section.title}>
      <Table heads={['Item', 'Quantity', 'To order']}>
        {section.rows.map(row => <Row key={row.item}>
          <td className="py-2 align-top">
            {row.item}
            {row.detail && <span className="block text-[13px] leading-5 text-slate-400">{row.detail}</span>}
          </td>
          <td className={`${numberCell} text-slate-300`}>{displayQuantity(row.quantity, row.kind, units).text}</td>
          <td className={`${numberCell} font-medium`}>{orderQuantity(row, units).text}</td>
        </Row>)}
      </Table>
    </Group>)}

    {bom.doors.length > 0 && <Group code="08" title="Door schedule">
      <Table heads={['Mark', sizeHead, 'Count']}>
        {bom.doors.map(door => <Row key={door.mark}>
          <td className="py-2 align-top"><span className="font-medium">{door.mark}</span> {door.where}</td>
          <td className={numberCell}>{size(door.width)} × {size(door.height)}</td>
          <td className={numberCell}>{door.count}</td>
        </Row>)}
      </Table>
    </Group>}

    {bom.windows.length > 0 && <Group code="08" title="Window schedule">
      <Table heads={['Mark', sizeHead, 'Sill', 'Count']}>
        {bom.windows.map(window => <Row key={window.mark}>
          <td className="py-2 align-top font-medium">{window.mark}</td>
          <td className={numberCell}>{size(window.width)} × {size(window.height)}</td>
          <td className={numberCell}>{size(window.sill)}</td>
          <td className={numberCell}>{window.count}</td>
        </Row>)}
      </Table>
    </Group>}

    {bom.rooms.length > 0 && <Group title="Room schedule">
      <Table heads={['Room', 'Area', 'Glass to floor']}>
        {bom.rooms.map(room => <Row key={room.key}>
          <td className="py-2 align-top">
            {room.name}{floors > 1 && floor === 'all' ? `, Floor ${room.floor + 1}` : ''}
            {room.type && <span className="block text-[13px] leading-5 text-slate-400">{room.type}</span>}
          </td>
          <td className={numberCell}>{area(room.area)}</td>
          <td className={numberCell}>{Math.round(room.daylight * 100)}%</td>
        </Row>)}
      </Table>
    </Group>}

    <p className="text-[13px] leading-5 text-slate-400">Quantities are measured from the plan, with walls {displayQuantity(summary.wallHeight, 'length', units).text} high. A plan doesn't say what things are made of, so framing, boards, paint and slab assume a typical light-frame house. Door and window sizes are grouped to the nearest 50 mm, and room uses are guessed from the furniture. To order includes waste. Check everything before buying.</p>
  </Panel>
}
