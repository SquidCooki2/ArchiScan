const { ModelOutputError } = require('./errors');

const KEYS = ['x', 'z', 'width', 'depth', 'rotation'];
const ALLOWED_TYPES = new Set(['wall', 'window', 'door']);
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

function normalizeRotation(r) {
  const twoPi = Math.PI;
  let out = r % twoPi;
  if (out < 0) out += twoPi;
  // Guard against floating point landing exactly on PI
  if (out >= Math.PI) out = 0;
  return out;
}

function normalizeWall(item, defaultFloor = 0) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;

  const rawType = item.type === undefined ? 'wall' : String(item.type).toLowerCase().trim();
  if (!ALLOWED_TYPES.has(rawType)) return null;

  const rawFloor = item.floor === undefined ? defaultFloor : toNumber(item.floor);
  if (!Number.isInteger(rawFloor) || rawFloor < 0) return null;

  const wall = { type: rawType, floor: rawFloor };
  for (const key of KEYS) {
    const n = toNumber(item[key]);
    if (!Number.isFinite(n)) return null;
    wall[key] = n;
  }
  if (wall.width <= 0 || wall.depth <= 0) return null;
  wall.rotation = normalizeRotation(wall.rotation);
  for (const key of KEYS) wall[key] = round3(wall[key]);

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
 * Validates and normalizes an array of wall/window/door elements for a given floor.
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
    throw new ModelOutputError(`${invalid} of ${arr.length} walls were invalid`);
  }
  return valid.slice(0, MAX_WALLS);
}

module.exports = { validateWalls, MAX_WALLS, WALL_HEIGHT };
