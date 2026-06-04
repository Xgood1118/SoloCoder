import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: 1 | 2 | 3
  size?: 'sm' | 'md'
}

export default function StarRating({ rating, size = 'md' }: StarRatingProps) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', size === 'sm' ? 'text-sm' : 'text-base')}>
      {[1, 2, 3].map((star) => (
        <span key={star} className={star <= rating ? 'text-brand-500' : 'text-warm-gray'}>
          {star <= rating ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}
