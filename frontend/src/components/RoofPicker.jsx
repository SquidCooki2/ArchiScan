import { ROOF_TYPES } from '../lib/roof'
import { FlatRoofIcon, GableRoofIcon, HipRoofIcon } from './Icons'

const ICONS = { flat: FlatRoofIcon, gable: GableRoofIcon, hip: HipRoofIcon }

/** Segmented radio group for the roof style. Native radios give arrow-key navigation for free. */
export default function RoofPicker({ value, onChange }) {
  return (
    <fieldset className="flex items-center justify-between gap-3">
      <legend className="sr-only">Roof style</legend>
      <span aria-hidden="true" className="text-sm font-medium text-neutral-200">
        Roof
      </span>
      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {ROOF_TYPES.map(({ id, label }) => {
          const RoofIcon = ICONS[id]
          return (
            <label
              key={id}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm text-neutral-400 transition-all duration-300 ease-out hover:bg-white/10 hover:text-neutral-100 has-checked:bg-blueprint-300/20 has-checked:text-blueprint-200 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-blueprint-300"
            >
              <input
                type="radio"
                name="roof-style"
                value={id}
                checked={value === id}
                onChange={() => onChange(id)}
                className="sr-only"
              />
              <RoofIcon className="size-4" />
              {label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
