const express = require('express');
const { HttpError, ModelOutputError } = require('../lib/errors');
const { extractJson } = require('../lib/extractJson');
const { validateWalls } = require('../lib/validateWalls');
const { sniffMediaType } = require('../lib/sniffMediaType');

const ALLOWED_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const DATA_URL_RE = /^data:([^;,]+);base64,/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const MAX_FLOORS = 5;

/** Parses a single image entry ({ image, mediaType } or raw string) into { base64, mediaType }. */
function parseSingleImage(entry) {
  const obj = typeof entry === 'string' ? { image: entry } : entry;
  if (!obj || typeof obj.image !== 'string' || !obj.image) {
    throw new HttpError(400, 'INVALID_REQUEST', '"image" must be a non-empty base64 string');
  }

  let base64 = obj.image.trim();
  let mediaType = typeof obj.mediaType === 'string' ? obj.mediaType.toLowerCase() : undefined;

  const match = DATA_URL_RE.exec(base64);
  if (match) {
    base64 = base64.slice(match[0].length);
    if (!mediaType) mediaType = match[1].toLowerCase();
  }
  if (mediaType === 'image/jpg') mediaType = 'image/jpeg';
  mediaType = mediaType || 'image/png';

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    throw new HttpError(400, 'INVALID_REQUEST', `Unsupported mediaType "${mediaType}". Use png, jpeg, webp, or gif.`);
  }
  if (base64.length % 4 !== 0 || !BASE64_RE.test(base64)) {
    throw new HttpError(400, 'INVALID_REQUEST', '"image" is not valid base64');
  }
  // Trust the actual bytes over the declared type (e.g. a WebP saved as .png).
  const sniffed = sniffMediaType(Buffer.from(base64.slice(0, 64), 'base64'));
  if (sniffed) mediaType = sniffed;
  return { base64, mediaType };
}

/** Backwards-compatible helper for single-image callers. */
function parseRequestBody(body) {
  return parseSingleImage(body);
}

/**
 * Parses either `{ image, mediaType }` (1 floor) or `{ images: [...] }` (1..MAX_FLOORS floors).
 * Returns an array of `{ base64, mediaType }` ordered from floor 0 upward.
 */
function parseRequestImages(body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'INVALID_REQUEST', 'Request body must be a JSON object');
  }
  if (body.images !== undefined) {
    if (!Array.isArray(body.images) || body.images.length === 0) {
      throw new HttpError(400, 'INVALID_REQUEST', '"images" must be a non-empty array of floor images');
    }
    if (body.images.length > MAX_FLOORS) {
      throw new HttpError(400, 'INVALID_REQUEST', `Too many floor images (maximum is ${MAX_FLOORS})`);
    }
    return body.images.map((item) => parseSingleImage(item));
  }
  return [parseSingleImage(body)];
}

function decodedSize(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

/**
 * Runs the primary CubiCasa5k Mask R-CNN pixel-segmentation & vectorization pipeline for one floor image.
 * Falls back to the Claude Opus Vision parser if the trained CNN weights are not present on disk.
 */
async function getWallsForFloor({ maskRcnn, claude }, base64, mediaType, floorIndex = 0) {
  const tagFloor = (items) => items.map((w) => ({ ...w, floor: floorIndex }));

  if (maskRcnn && typeof maskRcnn.hasTrainedWeights === 'function' && maskRcnn.hasTrainedWeights()) {
    const cnnElements = await maskRcnn.parseBlueprintImage(base64, mediaType);
    if (Array.isArray(cnnElements)) {
      return tagFloor(validateWalls(cnnElements, floorIndex));
    }
  }

  let text = await claude.parseBlueprintImage(base64, mediaType);
  try {
    return tagFloor(validateWalls(extractJson(text), floorIndex));
  } catch (err) {
    if (!(err instanceof ModelOutputError)) throw err;
  }

  text = await claude.parseBlueprintImage(base64, mediaType, text);
  try {
    return tagFloor(validateWalls(extractJson(text), floorIndex));
  } catch (err) {
    if (err instanceof ModelOutputError) {
      throw new HttpError(502, 'MODEL_OUTPUT_INVALID', 'The model returned output that could not be understood. Please try again.');
    }
    throw err;
  }
}

function createParseBlueprintRouter({ config, claude, maskRcnn }) {
  const router = express.Router();

  router.post('/parse-blueprint', async (req, res) => {
    const images = parseRequestImages(req.body);

    let totalBytes = 0;
    for (const img of images) {
      const size = decodedSize(img.base64);
      if (size > config.maxImageBytes) {
        throw new HttpError(413, 'IMAGE_TOO_LARGE', `Image exceeds the ${config.maxImageBytes} byte limit`);
      }
      totalBytes += size;
    }
    req.imageBytes = totalBytes;

    const perFloorWalls = await Promise.all(
      images.map((img, floorIndex) =>
        getWallsForFloor({ maskRcnn, claude }, img.base64, img.mediaType, floorIndex)
      )
    );
    const walls = perFloorWalls.flat();

    if (walls.length === 0) {
      throw new HttpError(422, 'NO_WALLS_FOUND', 'No walls were found. Is this image a floorplan?');
    }
    res.json(walls);
  });

  return router;
}

module.exports = { createParseBlueprintRouter, parseRequestBody, parseRequestImages, MAX_FLOORS };
