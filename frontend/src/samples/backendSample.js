import house from '../../../sample_output/house1_2floors.walls.json'
import apartment from '../../../sample_output/apartment_furnished_preview.walls.json'
import housePreview from '../assets/samples/house-floor1.png'
import upperPreview from '../assets/samples/house-floor2.png'
import apartmentPreview from '../assets/samples/apartment.png'

// Geometry comes directly from committed backend artifacts; Vite owns preview assets.
export const backendSamples = [
  { name: 'Two-floor house', previewUrl: housePreview, previews: [housePreview, upperPreview], walls: house },
  { name: 'Furnished apartment', previewUrl: apartmentPreview, previews: [apartmentPreview], walls: apartment },
]
export const backendSample = backendSamples[0]
