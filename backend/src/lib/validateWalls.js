const { ModelOutputError } = require('./errors');

const STRUCTURAL_TYPES = new Set(['wall', 'window', 'door']);
const FURNITURE_TYPES = new Set([
  'couch',
  'chair',
  'fridge',
  'sink',
  'bed',
  'wardrobe',
  'cabinet',
  'toilet',
  'table',
  'bath',
]);
const TYPE_ALIASES = {
  sofa: 'couch',
  armchair: 'chair',
  stool: 'chair',
  refrigerator: 'fridge',
  washbasin: 'sink',
  basin: 'sink',
  closet: 'wardrobe',
  dresser: 'wardrobe',
  cabinets: 'cabinet',
  counter: 'cabinet',
  wc: 'toilet',
  desk: 'table',
  bathtub: 'bath',
  tub: 'bath',
  shower: 'bath',
};
const WALL_HEIGHT = 2.7;
const DEFAULTS = {
  window: { sillHeight: 0.9, height: 1.2 },
  door: { sillHeight: 0, height: 2.1 },
};
const MAX_WALLS = 500;
const MAX_INVALID_RATIO = 0.2;

function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return NaN;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

function normalizeRotation(r, period = Math.PI) {
  let out = r % period;
  if (out < 0) out += period;
  if (out >= period) out = 0;
  return out;
}

function normalizeWall(item, defaultFloor = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const rawTypeInput = item.type === undefined ? 'wall' : String(item.type).toLowerCase().trim();
  const rawType = TYPE_ALIASES[rawTypeInput] || rawTypeInput;
  const isStructural = STRUCTURAL_TYPES.has(rawType);
  const isFurniture = FURNITURE_TYPES.has(rawType);
  if (!isStructural && !isFurniture) return null;

  const rawFloor = item.floor === undefined ? defaultFloor : toNumber(item.floor);
  if (!Number.isInteger(rawFloor) || rawFloor < 0) return null;

  const x = toNumber(item.x);
  const z = toNumber(item.z);
  const rotation = toNumber(item.rotation);
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(rotation)) return null;

  if (isFurniture) {
    return {
      type: rawType,
      floor: rawFloor,
      x: round3(x),
      z: round3(z),
      rotation: round3(normalizeRotation(rotation, 2 * Math.PI)),
    };
  }

  const width = toNumber(item.width);
  const depth = toNumber(item.depth);
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null;

  const wall = {
    type: rawType,
    floor: rawFloor,
    x: round3(x),
    z: round3(z),
    width: round3(width),
    depth: round3(depth),
    rotation: round3(normalizeRotation(rotation, Math.PI)),
  };

  if (rawType === 'window' || rawType === 'door') {
    const def = DEFAULTS[rawType];
    const sillRaw = item.sillHeight === undefined ? def.sillHeight : toNumber(item.sillHeight);
    const heightRaw = item.height === undefined ? def.height : toNumber(item.height);
    if (!Number.isFinite(sillRaw) || sillRaw < 0 || sillRaw >= WALL_HEIGHT) return null;
    if (!Number.isFinite(heightRaw) || heightRaw <= 0) return null;

    const clampedHeight = Math.min(heightRaw, WALL_HEIGHT - sillRaw);
    wall.sillHeight = round3(sillRaw);
    wall.height = round3(clampedHeight);
  }

  return wall;
}

/**
 * Validates and normalizes an array of structural and furniture elements for a given floor.
 * Drops invalid items; throws ModelOutputError if more than 20% are invalid.
 * An empty input array returns an empty array.
 */
function validateWalls(arr, defaultFloor = 0) {
  if (!Array.isArray(arr)) throw new ModelOutputError('Walls payload is not an array');
  if (arr.length === 0) return [];

  const valid = [];
  let invalid = 0;
  for (const item of arr) {
    const wall = normalizeWall(item, defaultFloor);
    if (wall) valid.push(wall);
    else invalid += 1;
  }

  if (invalid / arr.length > MAX_INVALID_RATIO) {
    throw new ModelOutputError(`${invalid} of ${arr.length} elements were invalid`);
  }
  return valid.slice(0, MAX_WALLS);
}

module.exports = { validateWalls, MAX_WALLS, WALL_HEIGHT, STRUCTURAL_TYPES, FURNITURE_TYPES };
