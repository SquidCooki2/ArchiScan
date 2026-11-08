const { ModelOutputError } = require('./errors');

const KEYS = ['x', 'z', 'width', 'depth', 'rotation'];
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

function normalizeWall(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const wall = {};
  for (const key of KEYS) {
    const n = toNumber(item[key]);
    if (!Number.isFinite(n)) return null;
    wall[key] = n;
  }
  if (wall.width <= 0 || wall.depth <= 0) return null;
  wall.rotation = normalizeRotation(wall.rotation);
  for (const key of KEYS) wall[key] = round3(wall[key]);
  return wall;
}

/**
 * Validates and normalizes an array of walls.
 * Drops invalid items; throws ModelOutputError if more than 20% are invalid.
 * An empty input array returns an empty array.
 */
function validateWalls(arr) {
  if (!Array.isArray(arr)) throw new ModelOutputError('Walls payload is not an array');
  if (arr.length === 0) return [];

  const valid = [];
  let invalid = 0;
  for (const item of arr) {
    const wall = normalizeWall(item);
    if (wall) valid.push(wall);
    else invalid += 1;
  }

  if (invalid / arr.length > MAX_INVALID_RATIO) {
    throw new ModelOutputError(`${invalid} of ${arr.length} walls were invalid`);
  }
  return valid.slice(0, MAX_WALLS);
}

module.exports = { validateWalls, MAX_WALLS };
