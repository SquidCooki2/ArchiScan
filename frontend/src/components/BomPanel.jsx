import { Fragment, useMemo } from 'react'
import { billCost, billOfMaterials, displayQuantity, displaySize, measureBuilding, orderQuantity, rowPrice, UNIT_SYSTEMS } from '../lib/billOfMaterials'
import { floorOptions } from '../lib/floorOptions'
import { money, PRICE_BASIS, roughMoney } from '../lib/prices'
import { ROOF_TYPES } from '../lib/roof'
import Icon from './Icon'
import { focusRing, Panel, Segmented } from './ui'

const numberCell = 'pl-3 text-right whitespace-nowrap tabular-nums align-top'
const note = 'text-[13px] leading-5 text-slate-400'

/** A heading that opens one table. Sharing a name means opening one closes the last, so the panel stays short. */
function Fold({ title, count, children }) {
  return <details name="bom-section" className="group border-t border-white/8">
    <summary className={`flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md text-sm font-medium text-slate-100 pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden ${focusRing}`}>
      <span className="flex-1">{title}</span>
      <span className="font-normal text-slate-400 tabular-nums">{count}</span>
      <Icon name="chevron" className="size-4 shrink-0 text-slate-400 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
    </summary>
    <div className="space-y-3 pb-3">{children}</div>
  </details>
}

/** Children are one or more tbody elements. */
function Table({ heads, children }) {
  return <div className="overflow-x-auto">
    <table className="w-full border-collapse text-sm text-slate-100">
      <thead>
        <tr>{heads.map((head, index) => <th key={head} scope="col" className={`pb-1 text-[13px] font-normal text-slate-400 ${index ? 'pl-3 text-right whitespace-nowrap' : 'text-left'}`}>{head}</th>)}</tr>
      </thead>
      {children}
    </table>
  </div>
}

const Row = ({ children }) => <tr className="border-t border-white/8 [&>td]:py-1.5">{children}</tr>
const Stat = ({ label, value }) => <div>
  <dt className="text-[13px] leading-5 text-slate-400">{label}</dt>
  <dd className="text-base font-medium text-slate-100 tabular-nums">{value}</dd>
</div>

/** The totals and anything to look at. The takeoff and schedules fold away until they're wanted. */
export default function BomPanel({ walls, floors, floor, onFloor, roofType, onRoof, units, onUnits }) {
  const measured = useMemo(() => measureBuilding(walls), [walls])
  const bom = useMemo(() => billOfMaterials(walls, { roofType, floor }, measured), [walls, roofType, floor, measured])
  const size = meters => displaySize(meters, units)
  const metric = units === 'metric'
  const sizeHead = metric ? 'Size, mm' : 'Size'
  const area = value => displayQuantity(value, 'area', units).text
  const length = value => displayQuantity(value, 'length', units).text
  const { summary } = bom
  const concerns = bom.checks.filter(check => !check.pass)
  const fine = bom.checks.filter(check => check.pass).map(check => check.label.toLowerCase())
  const cost = billCost(bom, units)

  return <Panel label="Bill of materials">
    <h2 className="text-base font-medium tracking-tight text-slate-100">Bill of materials</h2>

    <div className="space-y-2">
      {floors > 1 && <Segmented legend="Floors" hideLegend name="bom-floor" options={floorOptions(floors, { all: true })} value={floor} onChange={onFloor} />}
      <Segmented legend="Units" hideLegend name="bom-units" options={UNIT_SYSTEMS} value={units} onChange={onUnits} />
      {floor === 'all' && <Segmented legend="Roof" hideLegend name="bom-roof" options={ROOF_TYPES} value={roofType} onChange={onRoof} />}
    </div>

    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <Stat label="Estimated cost" value={roughMoney(cost.total)} />
        <Stat label="Gross floor area" value={area(summary.grossFloor)} />
        <Stat label="Net floor area" value={area(summary.netFloor)} />
        <Stat label="Glass to floor" value={`${Math.round(summary.glazingRatio * 100)}%`} />
      </dl>
      <p className={note}>{PRICE_BASIS}</p>
    </div>

    {bom.checks.length > 0 && <div className="space-y-2">
      {concerns.map(check => <p key={check.label} className="flex gap-2 text-sm leading-5 text-slate-100">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
        <span><span className="font-medium">{check.label}.</span> {check.text}</span>
      </p>)}
      <p className={note}>{fine.length > 0 && `Checked and fine: ${fine.join(', ')}. `}A first look against 2021 IRC figures, not a code review.</p>
    </div>}

    <div className="border-b border-white/8">
      <Fold title="Materials" count={roughMoney(cost.materials)}>
        <Table heads={['Item', 'To order', 'Price']}>
          {bom.sections.map(section => <tbody key={section.id}>
            <tr>
              <th colSpan={2} scope="rowgroup" className="pt-3 pb-1 text-left text-[13px] font-medium text-slate-300">{section.code} {section.title}</th>
              <td className={`pt-3 pb-1 text-[13px] font-medium text-slate-300 ${numberCell}`}>{money(cost.sections[section.id])}</td>
            </tr>
            {section.rows.map(row => {
              const price = rowPrice(row, units)
              const needed = `${displayQuantity(row.quantity, row.kind, units).text} needed${price ? `, ${money(price.each)}/${price.per}` : ''}.`
              return <Fragment key={row.item}>
                <tr className="border-t border-white/8">
                  <td className="pt-1.5 align-top">{row.item}</td>
                  <td className={`pt-1.5 text-slate-300 ${numberCell}`}>{orderQuantity(row, units).text}</td>
                  <td className={`pt-1.5 font-medium ${numberCell}`}>{price ? money(price.total) : 'No price'}</td>
                </tr>
                <tr><td colSpan={3} className={`pb-1.5 ${note}`}>{needed} {row.detail}</td></tr>
              </Fragment>
            })}
          </tbody>)}
        </Table>
        <p className={note}>To order includes waste. A plan doesn't say what things are made of, so framing, boards, paint and slab assume a typical light-frame house. Check before buying.</p>
      </Fold>

      <Fold title="Wall types" count={bom.walls.length}>
        <Table heads={['Type', 'Length', 'Area']}>
          <tbody>
            {bom.walls.map(wall => <Row key={wall.mark}>
              <td className="align-top">
                <span className="font-medium">{wall.mark}</span> {wall.exterior ? 'Exterior' : 'Interior'}
                <span className={`block ${note}`}>{size(wall.thickness)}{metric ? ' mm' : ''} thick</span>
              </td>
              <td className={numberCell}>{length(wall.length)}</td>
              <td className={numberCell}>{area(wall.area)}</td>
            </Row>)}
          </tbody>
        </Table>
        <p className={note}>Area includes openings, with walls {length(summary.wallHeight)} high. Less openings, the total is {area(summary.wallArea)}.</p>
      </Fold>

      {bom.doors.length + bom.windows.length > 0 && <Fold title="Doors and windows" count={roughMoney(cost.openings)}>
        {bom.doors.length > 0 && <Table heads={['Door', sizeHead, 'Count', 'Price']}>
          <tbody>
            {bom.doors.map(door => <Fragment key={door.mark}>
              <tr className="border-t border-white/8">
                <td className="pt-1.5 align-top"><span className="font-medium">{door.mark}</span> {door.where}</td>
                <td className={`pt-1.5 ${numberCell}`}>{size(door.width)} × {size(door.height)}</td>
                <td className={`pt-1.5 ${numberCell}`}>{door.count}</td>
                <td className={`pt-1.5 font-medium ${numberCell}`}>{money(door.each * door.count)}</td>
              </tr>
              <tr><td colSpan={4} className={`pb-1.5 ${note}`}>{money(door.each)} each.</td></tr>
            </Fragment>)}
          </tbody>
        </Table>}
        {bom.windows.length > 0 && <Table heads={['Window', sizeHead, 'Count', 'Price']}>
          <tbody>
            {bom.windows.map(window => <Fragment key={window.mark}>
              <tr className="border-t border-white/8">
                <td className="pt-1.5 align-top font-medium">{window.mark}</td>
                <td className={`pt-1.5 ${numberCell}`}>{size(window.width)} × {size(window.height)}</td>
                <td className={`pt-1.5 ${numberCell}`}>{window.count}</td>
                <td className={`pt-1.5 font-medium ${numberCell}`}>{money(window.each * window.count)}</td>
              </tr>
              <tr><td colSpan={4} className={`pb-1.5 ${note}`}>Sill {size(window.sill)}{metric ? ' mm' : ''}, {money(window.each)} each.</td></tr>
            </Fragment>)}
          </tbody>
        </Table>}
        <p className={note}>Sizes are grouped to the nearest 50 mm.</p>
      </Fold>}

      {bom.rooms.length > 0 && <Fold title="Rooms" count={bom.rooms.length}>
        <Table heads={['Room', 'Area', 'Glass to floor']}>
          <tbody>
            {bom.rooms.map(room => <Row key={room.key}>
              <td className="align-top">
                {room.name}{floors > 1 && floor === 'all' ? `, Floor ${room.floor + 1}` : ''}
                {room.type && <span className={`block ${note}`}>{room.type}</span>}
              </td>
              <td className={numberCell}>{area(room.area)}</td>
              <td className={numberCell}>{Math.round(room.daylight * 100)}%</td>
            </Row>)}
          </tbody>
        </Table>
        <p className={note}>Uses are guessed from the furniture.</p>
      </Fold>}
    </div>
  </Panel>
}
