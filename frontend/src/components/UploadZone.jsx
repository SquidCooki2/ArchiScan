import Icon from './Icon'

export default function UploadZone({ onBrowse, onSample, dragging = false }) {
  return <section className="pointer-events-auto w-full max-w-xl text-center" aria-labelledby="upload-heading">
    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1.5 text-[10px] tracking-[0.18em] text-indigo-200 uppercase"><span className="size-1.5 rounded-full bg-indigo-300" />A new perspective</div>
    <h1 id="upload-heading" className="text-4xl leading-[1.1] font-light tracking-tight sm:text-6xl">Your plans.<br /><span className="text-indigo-300">Another dimension.</span></h1>
    <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-neutral-400">Bring your floorplan into focus. Upload an image to explore your space in interactive 3D.</p>
    <button type="button" onClick={onBrowse}
      className={`group mt-8 flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-7 backdrop-blur-xl transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-400 motion-reduce:transition-none ${dragging ? 'scale-[1.02] border-indigo-300 bg-indigo-400/15' : 'border-white/20 bg-white/5 hover:border-indigo-400/60 hover:bg-white/10'}`}>
      <span className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-indigo-200 transition-transform duration-300 group-hover:-translate-y-1"><Icon name="upload" /></span>
      <span className="text-sm font-medium text-white/90">{dragging ? 'Drop your floorplan here' : 'Drop your floorplan here, or browse'}</span>
      <span className="text-xs text-white/35">PNG, JPG, WebP or GIF · Up to 5 MB</span>
    </button>
    <button type="button" onClick={onSample} className="mt-5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-white/50 transition-colors hover:text-indigo-200 focus-visible:outline-2 focus-visible:outline-indigo-400">Just exploring? Try a sample space <Icon name="arrow" className="size-4" /></button>
    <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[10px] tracking-wide text-white/30"><span>01 / Upload a plan</span><span>02 / Explore in 3D</span><span>03 / Reveal a section</span></div>
  </section>
}
