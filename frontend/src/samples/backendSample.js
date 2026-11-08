import apartmentWalls from '../../../sample_output/apartment_furnished_preview.walls.json'
import houseWalls from '../../../sample_output/house1_2floors.walls.json'
import apartmentImage from '../assets/samples/apartment.png'
import houseGround from '../assets/samples/house-floor1.png'
import houseUpper from '../assets/samples/house-floor2.png'

// Use the committed backend output directly so the demo cannot drift from it.
export const SAMPLES = {
  apartment: { id: 'apartment', name: 'Apartment', walls: apartmentWalls, previews: [apartmentImage] },
  house: { id: 'house', name: 'Two-floor house', walls: houseWalls, previews: [houseGround, houseUpper] },
}
