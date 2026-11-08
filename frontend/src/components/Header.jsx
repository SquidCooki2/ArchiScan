import Icon from './Icon'

export default function Header({ hasModel, loading, mock, onUpload }) {
  return <header className="pointer-events-none fixed inset-x-0 top-0 z-20 p-4 sm:p-7">
    <div className="pointer-events-auto mx-auto flex max-w-[1600px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/60 px-4 py-3 backdrop-blur-xl sm:px-5">
      <a href={window.location.pathname + window.location.search} className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-400" aria-label="ArchiScan home">
        <span className="grid size-9 place-items-center rounded-xl border border-indigo-400/25 bg-indigo-400/10 text-indigo-300"><Icon name="cube" /></span>
        <span className="text-lg font-medium tracking-tight">Archi<span className="font-light text-white/60">Scan</span><span className="ml-2 hidden text-[10px] uppercase tracking-[0.2em] text-white/30 sm:inline">Studio</span></span>
      </a>
      <div className="flex items-center gap-4">
        {mock && <span className="shrink-0 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-2.5 py-1 text-[10px] tracking-wide whitespace-nowrap text-indigo-200">Demo mode</span>}
        {hasModel && <button type="button" onClick={onUpload} disabled={loading} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition-all duration-300 hover:border-indigo-400/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-indigo-400 disabled:opacity-40"><Icon name="upload" className="size-4" /><span className="hidden sm:inline">New upload</span><span className="sm:hidden">Upload</span></button>}
        {!hasModel && <span className="hidden text-xs text-white/35 md:block">From floorplan to possibility.</span>}
      </div>
    </div>
  </header>
}
