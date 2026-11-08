/**
 * Reads and validates environment configuration.
 * Throws on missing required values (server.js turns this into a clean exit).
 */
function loadConfig(env = process.env) {
  const missing = ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}. See backend/.env.example.`);
  }

  const port = Number(env.PORT || 3000);
  const maxImageBytes = Number(env.MAX_IMAGE_BYTES || 5 * 1024 * 1024);
  if (!Number.isInteger(port) || port < 0) throw new Error('PORT must be a non-negative integer');
  if (!Number.isFinite(maxImageBytes) || maxImageBytes <= 0) throw new Error('MAX_IMAGE_BYTES must be a positive number');

  return Object.freeze({
    port,
    anthropicApiKey: env.ANTHROPIC_API_KEY.trim(),
    anthropicModel: env.ANTHROPIC_MODEL.trim(),
    corsOrigin: (env.CORS_ORIGIN || 'http://localhost:5173').trim(),
    maxImageBytes,
  });
}

module.exports = { loadConfig };
