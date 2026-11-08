// The ONLY module that imports the Anthropic SDK, so tests can inject a fake service.
const Anthropic = require('@anthropic-ai/sdk');
const { SYSTEM_PROMPT, USER_PROMPT, RETRY_PROMPT } = require('../prompts/blueprintPrompt');

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

  return { parseBlueprintImage };
}

module.exports = { createClaudeService };
