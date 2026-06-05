import { cn } from '@/lib/utils';

const intentMap: Record<string, { label: string; className: string }> = {
  knowledge: { label: '知识查询', className: 'bg-blue-500/20 text-blue-400' },
  process: { label: '流程指引', className: 'bg-green-500/20 text-green-400' },
  ticket: { label: '工单发起', className: 'bg-orange-500/20 text-orange-400' },
  human: { label: '人工转接', className: 'bg-purple-500/20 text-purple-400' },
  chat: { label: '日常对话', className: 'bg-gray-500/20 text-gray-400' },
};

interface IntentBadgeProps {
  intent: string;
}

export default function IntentBadge({ intent }: IntentBadgeProps) {
  const config = intentMap[intent];
  if (!config) return null;

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
