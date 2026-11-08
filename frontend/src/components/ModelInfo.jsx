const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** What's loaded: its name and size. */
export default function ModelTitle({ name, counts, bounds, floors, demoUpload }) {
  const extras = [counts.stairs && plural(counts.stairs, 'staircase'), counts.furniture && `${counts.furniture} ${counts.furniture === 1 ? 'piece' : 'pieces'} of furniture`].filter(Boolean)
  return <div className="pointer-events-none fixed top-28 left-3 z-10 max-w-[calc(100vw-1.5rem)] sm:top-20 sm:left-5 sm:max-w-[24rem]">
    <h1 className="truncate text-base font-medium tracking-tight text-slate-100 sm:text-xl">{name}</h1>
    <p className="mt-1 hidden text-sm leading-6 text-slate-300 sm:block">{plural(counts.wall, 'wall')}, {plural(counts.window, 'window')}, {plural(counts.door, 'door')}<br />{extras.length > 0 && <>{extras.join(', ')}<br /></>}{bounds.width.toFixed(1)} × {bounds.depth.toFixed(1)} m{floors > 1 ? ` on ${floors} floors` : ''}</p>
    {demoUpload && <p className="mt-1 text-[13px] leading-5 text-amber-200">Demo mode: this is a sample model, not your image.</p>}
  </div>
}
