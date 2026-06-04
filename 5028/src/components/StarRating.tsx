import { Star } from 'lucide-react'

interface StarRatingProps {
  rating: number
  size?: number
  interactive?: boolean
  onChange?: (rating: number) => void
}

export default function StarRating({
  rating,
  size = 16,
  interactive = false,
  onChange,
}: StarRatingProps) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < Math.round(rating)
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(i + 1)}
            className={interactive ? 'cursor-pointer' : 'cursor-default'}
          >
            <Star
              size={size}
              className={
                filled ? 'text-coral-500' : 'text-gray-200'
              }
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={1.5}
            />
          </button>
        )
      })}
    </div>
  )
}
