class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

/** Error thrown when model output cannot be parsed/validated (maps to MODEL_OUTPUT_INVALID). */
class ModelOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelOutputError';
  }
}

module.exports = { HttpError, ModelOutputError };
