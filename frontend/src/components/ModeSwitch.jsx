import { Segmented } from './ui'

const MODES = [
  { id: 'explore', label: 'Explore', icon: 'cube' },
  { id: 'walk', label: 'Walk', icon: 'person' },
  { id: 'escape', label: 'Escape route', icon: 'route' },
]

/** The one place to choose what you're doing with the model. */
export default function ModeSwitch({ mode, onChange }) {
  return <div className="rounded-xl bg-[#20262e] shadow-[0_8px_24px_rgb(0_0_0/0.3)] sm:w-[23rem]">
    <Segmented legend="What to do with the model" hideLegend name="viewer-mode" options={MODES} value={mode} onChange={onChange} />
  </div>
}
