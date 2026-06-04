import { Link } from 'react-router-dom';
import { Clock, Heart, Star } from 'lucide-react';
import type { Recipe } from '@/types';
import { formatCookTime } from '@/utils/helpers';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: Recipe;
  variant?: 'default' | 'compact';
}

export default function RecipeCard({ recipe, variant = 'default' }: RecipeCardProps) {
  if (variant === 'compact') {
    return (
      <Link
        to={`/recipe/${recipe.id}`}
        className="flex items-center gap-3 rounded-card bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
      >
        <img
          src={recipe.coverImage}
          alt={recipe.title}
          className="h-20 w-20 flex-shrink-0 rounded-card object-cover"
        />
        <div className="flex flex-1 flex-col gap-1">
          <h3 className="line-clamp-1 font-serif text-sm font-semibold text-warm-brown">
            {recipe.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-warm-muted">
            {[1, 2, 3].map(i => (
              <Star
                key={i}
                className={cn(
                  'h-3 w-3',
                  i <= recipe.difficulty
                    ? 'fill-brand-500 text-brand-500'
                    : 'text-warm-muted'
                )}
              />
            ))}
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {formatCookTime(recipe.cookTime)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-warm-muted">
            <Heart className="h-3 w-3" />
            <span>{recipe.favoriteCount}</span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={`/recipe/${recipe.id}`}
      className="flex flex-col overflow-hidden rounded-card bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
    >
      <img
        src={recipe.coverImage}
        alt={recipe.title}
        className="aspect-[4/3] w-full object-cover"
      />
      <div className="flex flex-col gap-2 p-4">
        <h3 className="line-clamp-1 font-serif font-semibold text-warm-brown">
          {recipe.title}
        </h3>
        <div className="flex items-center gap-3 text-sm text-warm-muted">
          <span className="flex items-center gap-0.5">
            {[1, 2, 3].map(i => (
              <Star
                key={i}
                className={cn(
                  'h-3.5 w-3.5',
                  i <= recipe.difficulty
                    ? 'fill-brand-500 text-brand-500'
                    : 'text-warm-muted'
                )}
              />
            ))}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatCookTime(recipe.cookTime)}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="h-3.5 w-3.5" />
            {recipe.favoriteCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
