import Icon from './Icon'
import { Button } from './ui'
import { useHeroSideBySide } from '../lib/useHeroLayout'

/** The first screen. The model rising beside the headline shows what the product does. */
export default function Landing({ onBrowse, onSample, samples }) {
  const side = useHeroSideBySide()
  return <main className={`pointer-events-none relative z-10 flex min-h-svh ${side ? 'items-center px-[6vw] pt-20 pb-16' : 'items-end px-5 pt-[48svh] pb-8 sm:px-[6vw]'}`}>
    <div className={`pointer-events-auto ${side ? 'w-[max(38vw,16rem)] max-w-[34rem]' : 'w-full max-w-[40rem]'}`}>
      <h1 className={`leading-[1.08] font-medium tracking-tight text-balance text-slate-100 [font-stretch:112%] ${side ? 'text-[clamp(1.75rem,3.9vw,3.5rem)]' : 'text-[2.15rem] sm:text-[2.75rem]'}`}>Turn a floor plan into a building you can walk through.</h1>
      <p className={`max-w-[28rem] text-slate-300 ${side ? 'mt-6 text-[clamp(1rem,1.25vw,1.125rem)] leading-[1.7]' : 'mt-4 text-base leading-7 sm:text-lg sm:leading-8'}`}>Upload a drawing. ArchiTech finds the walls, doors, and windows, then builds them in 3D.</p>
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${side ? 'mt-8' : 'mt-6'}`}>
        <Button variant="primary" onClick={onBrowse} className="min-h-12 px-5 text-base pointer-coarse:min-h-12"><Icon name="upload" className="size-5" />Upload floor plan</Button>
        <span className="hidden text-sm text-slate-300 sm:inline">or drop a file anywhere</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-400">PNG, JPG, WebP, or GIF, up to 5 MB each. For more than one floor, select one image per floor, with file names in order from the ground up. A plan saved as JSON opens straight away.</p>
      <div className={`flex flex-wrap items-center gap-x-1 gap-y-1 ${side ? 'mt-7' : 'mt-5'}`}>
        <span className="mr-2 text-sm text-slate-300">Or try a sample:</span>
        {samples.map(sample => <Button key={sample.id} variant="quiet" onClick={() => onSample(sample.id)} className="px-2.5 underline decoration-white/30 underline-offset-4">{sample.name}</Button>)}
      </div>
    </div>
  </main>
}
