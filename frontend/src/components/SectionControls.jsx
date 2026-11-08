import { MIN_CUT_HEIGHT, PLAN_CUT_HEIGHT } from '../lib/geometry'
import { ResetIcon } from './Icons'
import RoofPicker from './RoofPicker'

export default function SectionControls({
  clipEnabled,
  clipHeight,
  maxHeight,
  roofType,
  onRoofType,
  onToggle,
  onHeight,
  onPlanCut,
  onReset,
}) {
  const atPlanCut = clipEnabled && Math.abs(clipHeight - PLAN_CUT_HEIGHT) < 0.005

  return (
    <section
      aria-labelledby="section-title"
      className="fixed bottom-4 left-1/2 z-30 w-[22rem] max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl transition-all duration-500 ease-out starting:translate-y-4 starting:opacity-0 sm:bottom-6"
    >
      <RoofPicker value={roofType} onChange={onRoofType} />
      <hr className="my-4 border-white/10" />

      <div className="flex items-center justify-between gap-4">
        <h2 id="section-title" className="text-sm font-medium text-neutral-200">
          Section cut
        </h2>
        <button
          type="button"
          role="switch"
          aria-checked={clipEnabled}
          aria-labelledby="section-title"
          onClick={onToggle}
          className={`relative h-6 w-11 cursor-pointer rounded-full border transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-300 ${
            clipEnabled ? 'border-blueprint-300 bg-blueprint-300/90' : 'border-white/20 bg-white/10'
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-[1.125rem] rounded-full transition-transform duration-300 ease-out ${
              clipEnabled ? 'translate-x-5 bg-neutral-950' : 'translate-x-0 bg-neutral-300'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <output
          htmlFor="cut-height"
          className={`text-3xl font-light tracking-tight tabular-nums transition-colors duration-300 ${
            clipEnabled ? 'text-blueprint-200' : 'text-neutral-500'
          }`}
        >
          {clipHeight.toFixed(2)} m
        </output>
        <span className="text-sm text-neutral-500 tabular-nums">of {maxHeight.toFixed(2)} m total height</span>
      </div>

      <label htmlFor="cut-height" className="sr-only">
        Cut height in meters
      </label>
      <input
        id="cut-height"
        type="range"
        min={MIN_CUT_HEIGHT}
        max={maxHeight}
        step={0.01}
        value={clipHeight}
        disabled={!clipEnabled}
        onChange={(e) => onHeight(Number(e.target.value))}
        aria-valuetext={`${clipHeight.toFixed(2)} meters`}
        className="mt-2 h-6 w-full cursor-pointer accent-blueprint-300 transition-opacity duration-300 disabled:cursor-not-allowed disabled:opacity-40"
      />

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPlanCut}
          aria-pressed={atPlanCut}
          className={`h-9 cursor-pointer rounded-lg border px-3 text-sm transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-300 ${
            atPlanCut
              ? 'border-blueprint-300/70 bg-blueprint-300/20 text-blueprint-200'
              : 'border-white/10 text-neutral-300 hover:border-white/25 hover:bg-white/10'
          }`}
        >
          Plan cut at {PLAN_CUT_HEIGHT.toFixed(1)} m
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm text-neutral-400 transition-all duration-300 ease-out hover:bg-white/10 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-300"
        >
          <ResetIcon className="size-4" />
          Reset view
        </button>
      </div>
    </section>
  )
}
