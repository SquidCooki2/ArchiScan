import Icon from './Icon'
import ModeSwitch from './ModeSwitch'
import { Button, focusRing } from './ui'

export function Wordmark() {
  return <a href={window.location.pathname + window.location.search} aria-label="ArchiScan home" className={`pointer-events-auto inline-flex items-center gap-2.5 rounded-md text-slate-100 ${focusRing}`}>
    <Icon name="logo" className="size-6 text-sky-300" />
    <span className="text-lg font-semibold tracking-tight [font-stretch:115%]">ArchiScan</span>
  </a>
}

/** While walking, only the mode switch stays: the rest would sit unreadably on bright walls. */
export default function Header({ loading, mode, onMode, onUpload, walking }) {
  return <header className="pointer-events-none fixed inset-x-0 top-0 z-20 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 p-3 sm:grid-cols-[1fr_auto_1fr] sm:px-5 sm:py-4">
    <div>{!walking && <Wordmark />}</div>
    <div className="pointer-events-auto col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1"><ModeSwitch mode={mode} onChange={onMode} /></div>
    {!walking && <div className="pointer-events-auto col-start-2 row-start-1 justify-self-end sm:col-start-3">
      <Button onClick={onUpload} disabled={loading}><Icon name="upload" className="size-4" />New plan</Button>
    </div>}
  </header>
}
