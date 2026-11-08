import { PlanIcon } from './Icons'

/** Registration marks at the sheet corners, as on a drawing set. */
function CornerMarks({ active }) {
  const base = `pointer-events-none absolute transition-all duration-300 ease-out ${
    active ? 'size-6 border-blueprint-300' : 'size-4 border-neutral-500'
  }`
  return (
    <>
      <span className={`${base} top-2 left-2 border-t border-l`} />
      <span className={`${base} top-2 right-2 border-t border-r`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} right-2 bottom-2 border-r border-b`} />
    </>
  )
}

export default function UploadZone({ dragging, mock, onBrowse, onSample }) {
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onBrowse()
    }
  }

  return (
    <main className="fixed inset-0 z-20 flex items-center justify-center overflow-y-auto px-4 pt-24 pb-10">
      <div className="w-full max-w-xl transition-all duration-500 ease-out starting:translate-y-2 starting:opacity-0">
        <h1 className="text-4xl leading-[1.05] font-light tracking-tight text-balance text-neutral-50 sm:text-5xl">
          Floorplan in.
          <br />
          <span className="text-neutral-400">3D model out.</span>
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-neutral-400">
          Upload a 2D plan and ArchiScan traces its walls into a model you can orbit and cut in section.
        </p>

        <div
          role="button"
          tabIndex={0}
          onClick={onBrowse}
          onKeyDown={onKeyDown}
          aria-describedby="upload-hint"
          className={`group relative mt-8 flex aspect-[16/10] w-full cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-6 text-center backdrop-blur-xl transition-all duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blueprint-300 ${
            dragging
              ? 'scale-[1.01] border-blueprint-300 bg-blueprint-300/10'
              : 'border-white/20 bg-white/5 hover:border-blueprint-300/60 hover:bg-white/10'
          }`}
        >
          <CornerMarks active={dragging} />
          <span
            className={`grid size-14 place-items-center rounded-2xl border transition-colors duration-300 ${
              dragging
                ? 'border-blueprint-300/50 text-blueprint-200'
                : 'border-white/10 text-neutral-300 group-hover:text-blueprint-200'
            }`}
          >
            <PlanIcon className="size-7" />
          </span>
          <span className="text-lg font-normal text-neutral-100">
            {dragging ? 'Release to scan this plan' : 'Drop a floorplan image here'}
          </span>
          <span id="upload-hint" className="text-sm text-neutral-400">
            or click to browse. PNG, JPEG, WebP, or GIF up to 5 MB.
          </span>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
          <button
            type="button"
            onClick={onSample}
            className="cursor-pointer rounded-md py-1 text-blueprint-200 underline decoration-blueprint-300/40 underline-offset-4 transition-colors duration-300 hover:decoration-blueprint-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-300"
          >
            View a sample model
          </button>
          {mock && (
            <span className="text-neutral-500">No backend connected. Uploads show the sample plan.</span>
          )}
        </div>
      </div>
    </main>
  )
}
