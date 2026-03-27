const { getOpenAIClient } = require('../../config/openai');
const { SYSTEM_JSON_ONLY } = require('./prompts');

const createJsonResponse = async ({ prompt, model }) => {
  const client = getOpenAIClient();
  const completion = await client.responses.create({
    model: model || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    input: [
      { role: 'system', content: SYSTEM_JSON_ONLY },
      { role: 'user', content: prompt },
    ],
  });

  const text = completion.output_text || '{}';
  return JSON.parse(text);
};

module.exports = { createJsonResponse };
