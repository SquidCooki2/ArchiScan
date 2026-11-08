// What makes a fixture look lived-with: warm ivory instead of clinical white, brass instead of chrome,
// wood where a home would have it, and the odd towel. Sizes and positions are in meters on the fitted
// model, front toward +Z, standing on y = 0.
const PORCELAIN = '#f4eee1'
const BRASS = '#b8955c'
const SHADOW_BRASS = '#5c4d38'
const OAK = '#b78c5e'
const DARK_OAK = '#8d6a45'
const STONE = '#e6dfd0'
const CREAM = '#e8ddc4'
const SAGE = '#8ea58b'
const CLAY = '#c08467'
const LINEN = '#efe7d6'
const PAPER = '#f7f2e6'

export const FINISHES = {
  fridge: {
    palette: { metalLight: CREAM, metalMedium: BRASS },
    dressing: [
      { at: [0.17, 1.28, 0.312], size: [0.13, 0.17, 0.004], color: PAPER },
      { at: [0.17, 1.35, 0.316], size: [0.03, 0.03, 0.006], color: CLAY },
      { at: [0.24, 1.14, 0.316], size: [0.035, 0.035, 0.006], color: SAGE },
      { at: [0.12, 1.08, 0.316], size: [0.03, 0.03, 0.006], color: BRASS },
    ],
  },
  sink: {
    palette: { wood: OAK, woodDark: DARK_OAK, metal: STONE, metalLight: BRASS, metalDark: SHADOW_BRASS, _defaultMat: BRASS },
    regions: [{ material: 'metal', min: [-0.37, 0.29, -0.01], max: [-0.27, 0.33, 0.03], color: BRASS }],
    dressing: [
      { shape: 'cylinder', at: [0.22, 0.74, -0.18], size: [0.075, 0.07, 0.075], color: CLAY },
      { shape: 'sphere', at: [0.22, 0.81, -0.18], size: [0.1, 0.09, 0.1], color: SAGE },
    ],
  },
  bathroomSink: {
    palette: { carpetWhite: PORCELAIN, metalLight: BRASS, metalDark: SHADOW_BRASS },
    dressing: [
      { at: [0.1, 0.75, 0.232], size: [0.17, 0.25, 0.012], color: SAGE },
      { at: [0.1, 0.874, 0.2], size: [0.17, 0.012, 0.075], color: SAGE },
    ],
  },
  toilet: {
    palette: { carpetWhite: PORCELAIN, metalLight: BRASS, metalDark: SHADOW_BRASS, _defaultMat: OAK },
    dressing: [{ shape: 'cylinder', at: [0.12, 0.8, -0.24], size: [0.09, 0.09, 0.09], color: PAPER }],
  },
  bath: {
    palette: { carpetWhite: PORCELAIN, metalLight: LINEN, metalDark: SHADOW_BRASS },
    // The taps share the shell's material, so they're picked out by where they sit in the raw model.
    regions: [{ material: 'metalLight', min: [-1.16, 0.34, 0.15], max: [-0.95, 0.5, 0.42], color: BRASS }],
    dressing: [
      { at: [-0.1, 0.57, 0], size: [0.15, 0.022, 0.72], color: OAK },
      { at: [0.45, 0.42, 0.372], size: [0.34, 0.26, 0.014], color: CLAY },
      { at: [0.45, 0.555, 0.33], size: [0.34, 0.014, 0.1], color: CLAY },
    ],
  },
}
