import type { Step } from '@/types';
import { cn } from '@/lib/utils';

interface StepTimelineProps {
  steps: Step[];
}

export default function StepTimeline({ steps }: StepTimelineProps) {
  return (
    <div className="flex flex-col">
      {steps.map((step, index) => (
        <div key={step.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
              {step.order}
            </div>
            {index < steps.length - 1 && (
              <div className="w-0.5 flex-1 bg-brand-200" />
            )}
          </div>
          <div className={cn('flex-1', index < steps.length - 1 && 'pb-8')}>
            <p className="text-sm leading-relaxed text-warm-brown">{step.description}</p>
            {step.image && (
              <img
                src={step.image}
                alt={`步骤${step.order}`}
                className="mt-3 max-h-48 rounded-card object-cover"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
