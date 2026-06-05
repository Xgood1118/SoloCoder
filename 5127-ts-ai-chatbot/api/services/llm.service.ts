import OpenAI from 'openai';

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

const MOCK_RESPONSE = '这是一个模拟回复。OpenAI API Key 未配置。';

async function* mockStream(): AsyncGenerator<string> {
  for (const char of MOCK_RESPONSE) {
    yield char;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function* streamChat(
  messages: Array<{ role: string; content: string }>
): AsyncGenerator<string> {
  const client = getClient();
  if (!client) {
    yield* mockStream();
    return;
  }
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    stream: true,
  });
  for await (const chunk of response) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) yield content;
  }
}

export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  stream: boolean
): Promise<AsyncGenerator<string> | string> {
  const client = getClient();

  if (!client) {
    if (stream) return mockStream();
    return MOCK_RESPONSE;
  }

  if (stream) {
    return streamChat(messages);
  }

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    stream: false,
  });
  return response.choices[0]?.message?.content || '';
}
