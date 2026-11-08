import Icon from './Icon'
import { Button } from './ui'

/** The first screen. The model rising beside the headline shows what the product does. */
export default function Landing({ onBrowse, onSample, samples }) {
  return <main className="pointer-events-none relative z-10 flex min-h-svh items-end px-5 pt-20 pb-8 sm:items-center sm:px-[6vw] sm:pb-16">
    <div className="pointer-events-auto w-full max-w-[34rem]">
      <h1 className="text-[2.15rem] leading-[1.08] font-medium tracking-tight text-balance text-slate-100 [font-stretch:112%] sm:text-[3.5rem]">Turn a floor plan into a building you can walk through.</h1>
      <p className="mt-4 max-w-[28rem] text-base leading-7 text-slate-300 sm:mt-6 sm:text-lg sm:leading-8">Upload a drawing. ArchiScan finds the walls, doors, and windows, then builds them in 3D.</p>
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mt-8">
        <Button variant="primary" onClick={onBrowse} className="min-h-12 px-5 text-base pointer-coarse:min-h-12"><Icon name="upload" className="size-5" />Upload floor plan</Button>
        <span className="hidden text-sm text-slate-300 sm:inline">or drop an image anywhere</span>
      </div>
      <p className="mt-4 max-w-[28rem] text-sm leading-6 text-slate-400">PNG, JPG, WebP, or GIF, up to 5 MB each. For more than one floor, select one image per floor, with file names in order from the ground up.</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-1 gap-y-1 sm:mt-7">
        <span className="mr-2 text-sm text-slate-300">Or try a sample:</span>
        {samples.map(sample => <Button key={sample.id} variant="quiet" onClick={() => onSample(sample.id)} className="px-2.5 underline decoration-white/30 underline-offset-4">{sample.name}</Button>)}
      </div>
    </div>
  </main>
}
