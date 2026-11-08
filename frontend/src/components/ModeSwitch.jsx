import { Segmented } from './ui'

const MODES = [
  { id: 'explore', label: 'Explore' },
  { id: 'walk', label: 'Walk' },
  // Four tabs leave too little room for the whole name on the narrowest screens.
  { id: 'escape', label: <span>Escape<span className="hidden min-[390px]:inline sm:hidden md:inline"> route</span></span> },
  { id: 'bom', label: 'BoM' },
]

/** The one place to choose what you're doing with the model. */
export default function ModeSwitch({ mode, onChange }) {
  return <div className="rounded-xl bg-[#20262e] shadow-[0_8px_24px_rgb(0_0_0/0.3)] lg:w-[28rem]">
    <Segmented legend="What to do with the model" hideLegend name="viewer-mode" options={MODES} value={mode} onChange={onChange} />
  </div>
}
