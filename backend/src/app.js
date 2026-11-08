const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { HttpError } = require('./lib/errors');
const { createParseBlueprintRouter } = require('./routes/parseBlueprint');
const { createEvacuationBriefRouter } = require('./routes/evacuationBrief');
const { createMaskRcnnService } = require('./services/maskRcnn');

function sendError(res, status, code, message, headers = {}) {
  for (const [k, v] of Object.entries(headers)) res.set(k, v);
  res.status(status).json({ error: { code, message } });
}

/**
 * Express app factory. `maskRcnn` (primary CNN segmentation service) and `claude`
 * (fallback vision service) are injected so tests can mock either layer.
 */
function createApp({ config, claude, maskRcnn = createMaskRcnnService(config) }) {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '50mb' }));

  // Request log: method, path, status, duration, image byte length only.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const bytes = req.imageBytes !== undefined ? ` image=${req.imageBytes}B` : '';
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms${bytes}`);
    });
    next();
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api', createParseBlueprintRouter({ config, claude, maskRcnn }));
  app.use('/api', createEvacuationBriefRouter({ config, claude }));

  app.use((req, res) => sendError(res, 404, 'NOT_FOUND', 'Route not found'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) {
      return sendError(res, err.status, err.code, err.message, err.headers);
    }
    // body-parser errors
    if (err.type === 'entity.too.large') {
      return sendError(res, 413, 'IMAGE_TOO_LARGE', 'Request body is too large');
    }
    if (err.type === 'entity.parse.failed') {
      return sendError(res, 400, 'INVALID_REQUEST', 'Request body is not valid JSON');
    }
    // Anthropic SDK errors (timeout class extends APIError, so check it first)
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return sendError(res, 504, 'UPSTREAM_TIMEOUT', 'The AI service timed out. Please try again.');
    }
    if (err instanceof Anthropic.APIError) {
      if (err.status === 429) {
        const retryAfter = err.headers && (err.headers['retry-after'] ?? err.headers.get?.('retry-after'));
        return sendError(res, 429, 'RATE_LIMITED', 'The AI service is rate limited. Please retry shortly.',
          retryAfter ? { 'Retry-After': String(retryAfter) } : {});
      }
      if (err.status === 401 || err.status === 403) {
        console.error(`Anthropic auth error (${err.status}): check ANTHROPIC_API_KEY`);
        return sendError(res, 502, 'UPSTREAM_AUTH', 'The AI service is misconfigured.');
      }
      if (err.status === 400) {
        console.error(`Anthropic rejected request: ${err.message}`);
        return sendError(res, 400, 'INVALID_REQUEST', 'The AI service could not process this image.');
      }
    }
    console.error(err.message, err.stack);
    return sendError(res, 500, 'INTERNAL', 'Internal server error');
  });

  return app;
}

module.exports = { createApp };
