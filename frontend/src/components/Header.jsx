import ExportMenu from './ExportMenu'
import Icon from './Icon'
import ModeSwitch from './ModeSwitch'
import { Button, focusRing } from './ui'

export function Wordmark() {
  return <a href={window.location.pathname + window.location.search} aria-label="ArchiTech home" className={`pointer-events-auto inline-flex items-center rounded-md text-slate-100 ${focusRing}`}>
    <span className="text-lg font-semibold tracking-tight [font-stretch:115%]">ArchiTech</span>
  </a>
}

/** While walking, only the mode switch stays. With the pointer hidden, it couldn't be clicked anyway. */
export default function Header({ loading, mode, onMode, onUpload, walking, hidden, exportFrom }) {
  if (hidden) return null
  return <header className="pointer-events-none fixed inset-x-0 top-0 z-[25] grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 p-3 sm:grid-cols-[auto_1fr_auto] sm:px-5 sm:py-4 lg:grid-cols-[1fr_auto_1fr]">
    <div>{!walking && <Wordmark />}</div>
    <div className="pointer-events-auto col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1"><ModeSwitch mode={mode} onChange={onMode} /></div>
    {!walking && <div className="pointer-events-auto col-start-2 row-start-1 flex gap-2 justify-self-end sm:col-start-3">
      <ExportMenu {...exportFrom} disabled={loading} />
      <Button onClick={onUpload} disabled={loading} className="whitespace-nowrap"><Icon name="upload" className="size-4 shrink-0" />New plan</Button>
    </div>}
  </header>
}
