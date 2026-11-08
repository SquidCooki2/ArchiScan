const express = require('express');
const { HttpError } = require('../lib/errors');
const { parseRequestBody } = require('./parseBlueprint');

const MAX_FACTS_BYTES = 20_000;
const MAX_NAME_LENGTH = 60;

/** The frontend computes the route; this route only checks the shape it needs to write about it. */
function parseFacts(facts) {
  const valid = facts && typeof facts === 'object' && ['route', 'window', 'shelter'].includes(facts.outcome)
    && Array.isArray(facts.rooms) && Array.isArray(facts.steps) && facts.steps.every((step) => typeof step === 'string');
  if (!valid) throw new HttpError(400, 'INVALID_REQUEST', '"facts" must describe a finished evacuation plan');
  if (Buffer.byteLength(JSON.stringify(facts)) > MAX_FACTS_BYTES) {
    throw new HttpError(400, 'INVALID_REQUEST', '"facts" is too large');
  }
  return facts;
}

/** Keeps only names for rooms that exist, so model output can't invent one. */
function cleanResult(result, facts) {
  if (!result || typeof result.brief !== 'string' || !result.brief.trim()) {
    throw new HttpError(502, 'MODEL_OUTPUT_INVALID', 'The model returned output that could not be understood. Please try again.');
  }
  const roomIds = new Set(facts.rooms.map((room) => room.id));
  const roomNames = (Array.isArray(result.roomNames) ? result.roomNames : [])
    .filter(({ id, name }) => roomIds.has(id) && typeof name === 'string' && name.trim() && name.length <= MAX_NAME_LENGTH)
    .map(({ id, name }) => ({ id, name: name.trim() }));
  return { brief: result.brief.trim(), roomNames };
}

function createEvacuationBriefRouter({ config, claude }) {
  const router = express.Router();

  router.post('/evacuation-brief', async (req, res) => {
    const facts = parseFacts(req.body?.facts);

    let image = null;
    if (req.body.image !== undefined) {
      image = parseRequestBody(req.body);
      const bytes = Buffer.from(image.base64, 'base64').length;
      if (bytes > config.maxImageBytes) {
        throw new HttpError(413, 'IMAGE_TOO_LARGE', `Image exceeds the ${config.maxImageBytes} byte limit`);
      }
      req.imageBytes = bytes;
    }

    res.json(cleanResult(await claude.writeEvacuationBrief(facts, image), facts));
  });

  return router;
}

module.exports = { createEvacuationBriefRouter };
