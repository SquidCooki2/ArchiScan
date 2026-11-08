const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** What's loaded: its name and size, then the original drawing to compare the model against. */
export function ModelTitle({ name, counts, bounds, floors, demoUpload }) {
  return <div className="pointer-events-none fixed top-28 left-3 z-10 max-w-[calc(100vw-1.5rem)] sm:top-20 sm:left-5 sm:max-w-[24rem]">
    <h1 className="truncate text-base font-medium tracking-tight text-slate-100 sm:text-xl">{name}</h1>
    <p className="mt-1 hidden text-sm leading-6 text-slate-300 sm:block">{plural(counts.wall, 'wall')}, {plural(counts.window, 'window')}, {plural(counts.door, 'door')}<br />{bounds.width.toFixed(1)} × {bounds.depth.toFixed(1)} m{floors > 1 ? ` on ${floors} floors` : ''}</p>
    {demoUpload && <p className="mt-1 text-[13px] leading-5 text-amber-200">Demo mode: this is a sample model, not your image.</p>}
  </div>
}

export function PlanCard({ previewUrl, caption, hint }) {
  return <div className="pointer-events-none fixed bottom-5 left-5 z-10 hidden items-end gap-4 lg:flex">
    {previewUrl && <figure>
      <img src={previewUrl} alt={caption} className="h-28 w-40 rounded-lg bg-white object-contain p-1.5 shadow-[0_8px_24px_rgb(0_0_0/0.3)]" />
      <figcaption className="mt-1.5 text-[13px] text-slate-300">{caption}</figcaption>
    </figure>}
    <p className="pb-0.5 text-[13px] leading-5 text-slate-400">{hint}</p>
  </div>
}
