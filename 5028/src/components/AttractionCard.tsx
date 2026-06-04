import type { Attraction } from '@/types'
import StarRating from '@/components/StarRating'

interface AttractionCardProps {
  attraction: Attraction
  onClick?: () => void
}

export default function AttractionCard({ attraction, onClick }: AttractionCardProps) {
  return (
    <div
      className="card-base rounded-xl cursor-pointer"
      onClick={onClick}
    >
      <div className="aspect-video w-full overflow-hidden">
        <img
          src={attraction.images[0]}
          alt={attraction.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="p-3">
        <h3 className="font-serif font-semibold text-ocean-800 truncate">
          {attraction.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded-full bg-ocean-50 px-2.5 py-0.5 text-xs text-ocean-500">
            {attraction.city}
          </span>
          <StarRating rating={attraction.rating} size={14} />
        </div>
        <div className="mt-2 text-sm font-medium text-coral-500">
          {attraction.ticketPrice === 0
            ? '免费'
            : `¥${attraction.ticketPrice}`}
        </div>
      </div>
    </div>
  )
}
