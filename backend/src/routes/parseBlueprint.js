const express = require('express');
const { HttpError, ModelOutputError } = require('../lib/errors');
const { extractJson } = require('../lib/extractJson');
const { validateWalls } = require('../lib/validateWalls');
const { sniffMediaType } = require('../lib/sniffMediaType');

const ALLOWED_MEDIA_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const DATA_URL_RE = /^data:([^;,]+);base64,/i;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Returns { base64, mediaType } or throws HttpError 400. */
function parseRequestBody(body) {
  if (!body || typeof body.image !== 'string' || !body.image) {
    throw new HttpError(400, 'INVALID_REQUEST', '"image" must be a non-empty base64 string');
  }

  let base64 = body.image.trim();
  let mediaType = typeof body.mediaType === 'string' ? body.mediaType.toLowerCase() : undefined;

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

function decodedSize(base64) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
}

/** Calls the model, parses and validates; retries once on invalid output. */
async function getWalls(claude, base64, mediaType) {
  let text = await claude.parseBlueprintImage(base64, mediaType);
  try {
    return validateWalls(extractJson(text));
  } catch (err) {
    if (!(err instanceof ModelOutputError)) throw err;
  }

  text = await claude.parseBlueprintImage(base64, mediaType, text);
  try {
    return validateWalls(extractJson(text));
  } catch (err) {
    if (err instanceof ModelOutputError) {
      throw new HttpError(502, 'MODEL_OUTPUT_INVALID', 'The model returned output that could not be understood. Please try again.');
    }
    throw err;
  }
}

function createParseBlueprintRouter({ config, claude }) {
  const router = express.Router();

  router.post('/parse-blueprint', async (req, res) => {
    const { base64, mediaType } = parseRequestBody(req.body);

    if (decodedSize(base64) > config.maxImageBytes) {
      throw new HttpError(413, 'IMAGE_TOO_LARGE', `Image exceeds the ${config.maxImageBytes} byte limit`);
    }
    req.imageBytes = decodedSize(base64);

    const walls = await getWalls(claude, base64, mediaType);
    if (walls.length === 0) {
      throw new HttpError(422, 'NO_WALLS_FOUND', 'No walls were found. Is this image a floorplan?');
    }
    res.json(walls);
  });

  return router;
}

module.exports = { createParseBlueprintRouter, parseRequestBody };
