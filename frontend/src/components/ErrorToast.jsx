import { useEffect } from 'react'
import { AlertIcon, CloseIcon } from './Icons'

const DISMISS_MS = 6000

export default function ErrorToast({ message, onClose }) {
  useEffect(() => {
    const id = setTimeout(onClose, DISMISS_MS)
    return () => clearTimeout(id)
  }, [onClose])

  return (
    <div
      role="alert"
      className="fixed top-20 right-3 z-50 flex w-[min(24rem,calc(100vw-1.5rem))] items-start gap-3 rounded-2xl border border-red-400/25 bg-red-950/50 p-4 backdrop-blur-xl transition-all duration-300 ease-out starting:translate-x-4 starting:opacity-0 sm:top-22 sm:right-4"
    >
      <AlertIcon className="mt-0.5 size-5 shrink-0 text-red-300" />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-red-50 [overflow-wrap:anywhere]">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss error"
        className="-m-2 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-red-200 transition-colors duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-blueprint-300"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  )
}
