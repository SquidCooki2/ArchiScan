import { useEffect } from 'react'
import Icon from './Icon'
import { focusRing } from './ui'

export default function ErrorToast({ message, onClose }) {
  useEffect(() => { const timer = setTimeout(onClose, 8000); return () => clearTimeout(timer) }, [message, onClose])
  return <div role="alert" className="fixed inset-x-3 top-16 z-50 mx-auto flex max-w-md items-start gap-3 rounded-xl border border-red-300/25 bg-[#2c2024] p-3 text-sm text-red-100 shadow-[0_16px_48px_rgb(0_0_0/0.4)] sm:top-20">
    <Icon name="alert" className="mt-0.5 size-5 shrink-0 text-red-300" /><p className="flex-1 leading-6">{message}</p>
    <button type="button" onClick={onClose} aria-label="Dismiss error" className={`cursor-pointer rounded-md p-1.5 text-red-200 hover:bg-white/10 hover:text-white ${focusRing}`}><Icon name="close" className="size-4" /></button>
  </div>
}
