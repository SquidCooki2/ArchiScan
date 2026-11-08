import { LogoMark, UploadIcon } from './Icons'

export default function Header({ status, fileName, previewUrl, wallCount, bounds, mock, onNewUpload }) {
  const ready = status === 'ready'

  return (
    <header className="fixed inset-x-3 top-3 z-30 sm:inset-x-4 sm:top-4">
      <div className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 pr-2 pl-4 backdrop-blur-xl">
        <span className="flex shrink-0 items-center gap-2.5">
          <LogoMark />
          <span className="text-[1.05rem] font-medium tracking-tight font-stretch-expanded text-neutral-100">
            ArchiScan
          </span>
        </span>

        {ready && (
          <div className="ml-2 hidden min-w-0 items-center gap-3 border-l border-white/10 pl-4 text-sm text-neutral-400 transition-opacity duration-300 starting:opacity-0 md:flex">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Uploaded floorplan"
                className="size-8 shrink-0 rounded-md border border-white/10 bg-white object-contain"
              />
            )}
            <span className="truncate text-neutral-200" title={fileName}>
              {fileName}
            </span>
            <span className="shrink-0 tabular-nums">{wallCount} walls</span>
            <span className="shrink-0 tabular-nums">
              {bounds.sizeX.toFixed(1)} × {bounds.sizeZ.toFixed(1)} m
            </span>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {mock && (
            <span
              className="hidden rounded-full border border-blueprint-300/30 px-2.5 py-1 text-xs text-blueprint-200 sm:inline"
              title="No backend is configured, so every upload returns the bundled sample plan."
            >
              Sample data
            </span>
          )}
          {ready && (
            <button
              type="button"
              onClick={onNewUpload}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-neutral-100 px-3.5 text-sm font-medium text-neutral-950 transition-all duration-300 ease-out hover:bg-blueprint-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint-300 active:scale-[0.97]"
            >
              <UploadIcon className="size-4" />
              New upload
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
