import { useEffect } from 'react'
import Icon from './Icon'

export default function ErrorToast({ message, onClose }) {
  useEffect(() => { const timer = setTimeout(onClose, 6000); return () => clearTimeout(timer) }, [message, onClose])
  return <div role="alert" className="fixed top-24 right-4 left-4 z-50 flex items-start gap-3 rounded-2xl border border-red-300/20 bg-red-950/85 p-4 text-sm text-red-100 shadow-xl backdrop-blur-xl sm:top-28 sm:right-7 sm:left-auto sm:max-w-md">
    <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-red-300" /><p className="flex-1 leading-6">{message}</p>
    <button type="button" onClick={onClose} aria-label="Dismiss error" className="rounded-md p-1 text-red-200/60 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-red-300"><Icon name="close" className="size-4" /></button>
  </div>
}
