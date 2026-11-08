/*
 * The shared look. Tokens live here as class strings because src/index.css holds only the Tailwind
 * import: table #171c22, panel #20262e, ink slate-100, secondary slate-300, drafting blue sky-300.
 */
export const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300'

const BUTTONS = {
  primary: 'bg-slate-100 font-medium text-[#171c22] hover:bg-white',
  secondary: 'bg-white/8 text-slate-100 hover:bg-white/14',
  quiet: 'text-slate-300 hover:bg-white/8 hover:text-white',
}

export function Button({ variant = 'secondary', className = '', children, ...props }) {
  return <button type="button" {...props} className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150 pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-45 ${BUTTONS[variant]} ${focusRing} ${className}`}>{children}</button>
}

/** One choice from a few. Native radios bring arrow-key navigation; the highlight slides between them. */
export function Segmented({ legend, hideLegend = false, name, options, value, onChange }) {
  const index = options.findIndex(option => option.id === value)
  return <fieldset className="min-w-0">
    <legend className={hideLegend ? 'sr-only' : 'mb-2 text-sm font-medium text-slate-100'}>{legend}</legend>
    <div className="relative grid rounded-lg bg-black/30 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {index >= 0 && <span aria-hidden="true" className="absolute top-1 bottom-1 left-1 rounded-md bg-white/14 transition-transform duration-200 ease-out motion-reduce:transition-none" style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />}
      {options.map(option => <label key={option.id} className={`relative flex min-h-9 cursor-pointer items-center justify-center rounded-md px-1.5 text-[13px] whitespace-nowrap transition-colors duration-150 pointer-coarse:min-h-11 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-sky-300 ${option.id === value ? 'text-white' : 'text-slate-300 hover:text-white'}`}>
        <input type="radio" name={name} value={option.id} checked={option.id === value} onChange={() => onChange(option.id)} className="sr-only" />
        {option.label}
      </label>)}
    </div>
  </fieldset>
}

/** On or off, with the change visible at once. A real checkbox, so it works from the keyboard. */
export function Switch({ label, checked, onChange }) {
  return <label className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-sm font-medium text-slate-100 pointer-coarse:min-h-11">
    {label}
    <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} className="peer sr-only" />
    <span aria-hidden="true" className={`relative h-6 w-10 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sky-300 motion-reduce:transition-none ${checked ? 'bg-slate-100' : 'bg-black/30'}`}>
      <span className={`absolute top-1 left-1 size-4 rounded-full transition-transform duration-150 motion-reduce:transition-none ${checked ? 'translate-x-4 bg-[#171c22]' : 'bg-slate-400'}`} />
    </span>
  </label>
}

/** The tool area for the current mode: right side on desktop, bottom sheet on phones. */
export function Panel({ label, wide = false, children }) {
  const size = wide ? 'max-h-[56svh] sm:w-[26rem] lg:w-[36rem]' : 'max-h-[42svh] sm:w-80'
  return <section aria-label={label} className={`fixed inset-x-3 bottom-3 z-20 space-y-5 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-[#20262e] p-4 shadow-[0_16px_48px_rgb(0_0_0/0.4)] sm:inset-x-auto sm:top-20 sm:right-5 sm:bottom-auto sm:max-h-[calc(100svh-6.5rem)] ${size}`}>
    {children}
  </section>
}
