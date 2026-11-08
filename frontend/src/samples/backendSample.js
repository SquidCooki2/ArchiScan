import walls from '../../../sample_output/apartment_furnished_preview.walls.json'
import previewUrl from '../../../backend/assets/house0/apartment_furnished_preview.png'

// Use the committed backend artifact directly so the demo cannot drift from it.
export const backendSample = {
  name: 'Furnished apartment',
  previewUrl,
  walls,
}
