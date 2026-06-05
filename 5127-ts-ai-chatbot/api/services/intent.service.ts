import { chatCompletion } from './llm.service.js';
import type { IntentType, Message } from '../../shared/types.js';

const INTENT_KEYWORDS: Record<IntentType, string[]> = {
  knowledge: ['查', '搜索', '查找', '什么是', '介绍'],
  process: ['流程', '步骤', '如何办理', '怎么操作'],
  ticket: ['工单', '报修', '故障', '问题反馈'],
  human: ['转人工', '人工客服', '真人'],
  chat: [],
};

function classifyByKeywords(message: string): IntentType {
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === 'chat') continue;
    if (keywords.some(kw => message.includes(kw))) {
      return intent as IntentType;
    }
  }
  return 'chat';
}

async function classifyByLLM(message: string): Promise<IntentType | null> {
  const prompt = '分析用户意图，只返回: knowledge/process/ticket/human/chat';
  const contextSummary = message.slice(0, 200);
  try {
    const result = await chatCompletion(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: contextSummary },
      ],
      false
    );
    if (typeof result !== 'string') return null;
    const trimmed = result.trim().toLowerCase();
    const validIntents: IntentType[] = ['knowledge', 'process', 'ticket', 'human', 'chat'];
    if (validIntents.includes(trimmed as IntentType)) {
      return trimmed as IntentType;
    }
    return null;
  } catch {
    return null;
  }
}

export async function recognizeIntent(
  message: string,
  _context: Message[]
): Promise<IntentType> {
  if (process.env.OPENAI_API_KEY) {
    const llmResult = await classifyByLLM(message);
    if (llmResult) return llmResult;
  }
  return classifyByKeywords(message);
}
