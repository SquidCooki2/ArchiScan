import { useEffect, useRef, useState } from 'react'
import { billOfMaterials } from '../lib/billOfMaterials'
import { bomCsv, fileStem, floorPlansDxf, modelJson } from '../lib/exports'
import Icon from './Icon'
import { Button, focusRing } from './ui'

const FORMATS = [
  { id: 'csv', title: 'Bill of materials (.csv)', opens: 'Excel, Google Sheets, Numbers' },
  { id: 'dxf', title: 'Floor plans (.dxf)', opens: 'AutoCAD, Revit, SketchUp, ArchiCAD' },
  { id: 'json', title: 'Model and quantities (.json)', opens: 'Your own scripts and tools' },
]

function save(filename, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Takes the loaded model to other software. Exports always cover the whole building. */
export default function ExportMenu({ walls, name, roofType, units, disabled }) {
  const [open, setOpen] = useState(false)
  const root = useRef()
  const trigger = useRef()

  useEffect(() => {
    if (!open) return undefined
    const onPointer = event => { if (!root.current?.contains(event.target)) setOpen(false) }
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function download(format) {
    setOpen(false)
    const stem = fileStem(name)
    if (format === 'dxf') { save(`${stem}-plans.dxf`, floorPlansDxf(walls, { name }), 'application/dxf'); return }
    const bom = billOfMaterials(walls, { roofType })
    if (format === 'csv') save(`${stem}-bom.csv`, bomCsv(bom, { name, units }), 'text/csv;charset=utf-8')
    else save(`${stem}-model.json`, modelJson(walls, bom, { name, units }), 'application/json')
  }

  return <div ref={root} className="relative">
    <div ref={trigger}>
      <Button onClick={() => setOpen(value => !value)} disabled={disabled} aria-expanded={open} aria-haspopup="true">
        Export<Icon name="chevron" className={`size-4 transition-transform duration-150 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`} />
      </Button>
    </div>
    {open && <div className="absolute top-full right-0 z-30 mt-2 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-[#20262e] p-1.5 shadow-[0_16px_48px_rgb(0_0_0/0.4)]">
      {FORMATS.map(format => <button key={format.id} type="button" onClick={() => download(format.id)} className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left transition-colors duration-150 hover:bg-white/8 ${focusRing}`}>
        <span className="block text-sm font-medium text-slate-100">{format.title}</span>
        <span className="block text-[13px] leading-5 text-slate-300">{format.opens}</span>
      </button>)}
    </div>}
  </div>
}
