import * as messageRepo from '../repositories/message.repository.js';
import * as sessionRepo from '../repositories/session.repository.js';
import * as sensitiveWordService from './sensitive-word.service.js';
import * as intentService from './intent.service.js';
import * as knowledgeService from './knowledge.service.js';
import { chatCompletion } from './llm.service.js';
import type { ChatStreamEvent, IntentType } from '../../shared/types.js';

export async function* chat(
  sessionId: string,
  userId: string,
  message: string
): AsyncGenerator<ChatStreamEvent> {
  messageRepo.create(sessionId, 'user', message);

  const filterResult = sensitiveWordService.filterText(message);

  if (filterResult.level === 'high') {
    const errorMsg = '抱歉，您的问题包含敏感内容，无法回答';
    messageRepo.create(sessionId, 'assistant', errorMsg);
    yield { type: 'error', data: errorMsg };
    return;
  }

  if (filterResult.level === 'low') {
    yield { type: 'warning', data: '您的提问包含敏感词汇，请注意措辞' };
  }

  const recentMessages = messageRepo.findRecentBySessionId(sessionId, 20);
  const intent: IntentType = await intentService.recognizeIntent(message, recentMessages);
  yield { type: 'intent', data: intent };

  if (intent === 'ticket') {
    const ticketMsg = '请填写工单表单，包括：问题描述、紧急程度、联系方式，提交后将由相关人员进行处理。';
    const ticketAssistantMsg = messageRepo.create(sessionId, 'assistant', ticketMsg, intent);
    yield { type: 'content', data: ticketMsg };
    yield { type: 'done', data: ticketAssistantMsg.id };
    return;
  }

  if (intent === 'human') {
    const humanMsg = '正在为您转接人工客服，请稍候...';
    const humanAssistantMsg = messageRepo.create(sessionId, 'assistant', humanMsg, intent);
    yield { type: 'content', data: humanMsg };
    yield { type: 'done', data: humanAssistantMsg.id };
    return;
  }

  let knowledgeContext = '';
  if (intent === 'knowledge' || intent === 'process') {
    const results = knowledgeService.searchKnowledge(filterResult.text);
    knowledgeContext = results.map(r => r.content).join('\n\n');
  }

  const contextMessages = recentMessages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const systemPrompt = knowledgeContext
    ? `你是企业知识问答助手。请根据以下知识库内容回答用户问题。如果知识库中没有相关信息，请如实告知。\n\n知识库内容：\n${knowledgeContext}`
    : '你是企业知识问答助手，请友好、专业地回答用户的问题。';

  const llmMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...contextMessages,
    { role: 'user' as const, content: filterResult.text },
  ];

  const result = await chatCompletion(llmMessages, true);
  let fullContent = '';

  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    for await (const chunk of result as AsyncGenerator<string>) {
      fullContent += chunk;
      yield { type: 'content', data: chunk };
    }
  } else if (typeof result === 'string') {
    fullContent = result;
    yield { type: 'content', data: fullContent };
  }

  const assistantMsg = messageRepo.create(sessionId, 'assistant', fullContent, intent);
  yield { type: 'done', data: assistantMsg.id };
}
