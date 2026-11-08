const { ModelOutputError } = require('./errors');

function tryParseArray(text) {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Pulls a JSON array out of model text. Tries, in order:
 * the raw text, the text with markdown fences stripped, and the
 * substring between the first "[" and the last "]".
 */
function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new ModelOutputError('Model returned no text');
  }
  const trimmed = text.trim();

  let result = tryParseArray(trimmed);
  if (result) return result;

  const unfenced = trimmed
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();
  result = tryParseArray(unfenced);
  if (result) return result;

  const start = trimmed.indexOf('[');
  const end = trimmed.lastIndexOf(']');
  if (start !== -1 && end > start) {
    result = tryParseArray(trimmed.slice(start, end + 1));
    if (result) return result;
  }

  throw new ModelOutputError('Model output did not contain a valid JSON array');
}

module.exports = { extractJson };
