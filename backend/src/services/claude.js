// The ONLY module that imports the Anthropic SDK, so tests can inject a fake service.
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, USER_PROMPT, RETRY_PROMPT } = require('../prompts/blueprintPrompt');
const { EVACUATION_SYSTEM_PROMPT, EVACUATION_OUTPUT_SCHEMA } = require('../prompts/evacuationPrompt');
const { HttpError } = require('../lib/errors');

/**
 * @returns {{ parseBlueprintImage: (base64: string, mediaType: string, previousOutput?: string) => Promise<string> }}
 */
function createClaudeService(config) {
  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
    timeout: 120000,
    maxRetries: 2,
  });

  /**
   * Sends the image to Claude and returns the concatenated text output.
   * When previousOutput is given, appends a corrective follow-up turn (used for the single retry).
   */
  async function parseBlueprintImage(base64, mediaType, previousOutput) {
    const messages = [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ];
    if (previousOutput !== undefined) {
      messages.push({ role: 'assistant', content: previousOutput || '(empty)' });
      messages.push({ role: 'user', content: RETRY_PROMPT });
    }

    const response = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages,
    });

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }

  /**
   * Puts a computed evacuation route into plain words. The route itself is not up for discussion:
   * this only ever narrates facts the pathfinder produced. Returns the parsed JSON object.
   */
  async function writeEvacuationBrief(facts, image) {
    const content = [{ type: 'text', text: JSON.stringify(facts) }];
    if (image) {
      content.unshift({ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } });
    }

    const response = await client.messages.create({
      model: config.anthropicModel,
      max_tokens: 8192,
      system: EVACUATION_SYSTEM_PROMPT,
      output_config: { format: { type: 'json_schema', schema: EVACUATION_OUTPUT_SCHEMA } },
      messages: [{ role: 'user', content }],
    });

    if (response.stop_reason !== 'end_turn') {
      throw new HttpError(502, 'MODEL_OUTPUT_INVALID', 'The AI service could not write this explanation. The route and steps still apply.');
    }
    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(502, 'MODEL_OUTPUT_INVALID', 'The AI service could not write this explanation. The route and steps still apply.');
    }
  }

  return { parseBlueprintImage, writeEvacuationBrief };
}

module.exports = { createClaudeService };
