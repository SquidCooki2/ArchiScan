import { ROOF_TYPES } from '../lib/roof'
import Icon from './Icon'

/** Segmented radio group for the roof style. Native radios give arrow-key navigation for free. */
export default function RoofPicker({ value, onChange }) {
  return <fieldset className="mb-4 border-b border-white/10 pb-4">
    <legend className="mb-2 text-xs text-white/50">Roof</legend>
    <div className="grid grid-cols-3 gap-2">
      {ROOF_TYPES.map(({ id, label }) => <label key={id} className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-white/10 px-2 py-2 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white has-checked:border-indigo-400/50 has-checked:bg-indigo-400/15 has-checked:text-indigo-200 has-focus-visible:outline-2 has-focus-visible:outline-indigo-400">
        <input type="radio" name="roof-style" value={id} checked={value === id} onChange={() => onChange(id)} className="sr-only" />
        <Icon name={`${id}Roof`} className="size-4" />{label}
      </label>)}
    </div>
  </fieldset>
}
