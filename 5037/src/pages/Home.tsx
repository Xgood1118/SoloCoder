import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Heart } from 'lucide-react';
import { useRecipeStore } from '@/stores/recipeStore';
import { useUserStore } from '@/stores/userStore';
import { categories } from '@/data/categories';
import RecipeCard from '@/components/recipe/RecipeCard';
import TagChip from '@/components/ui/TagChip';
import StarRating from '@/components/ui/StarRating';
import { formatCookTime } from '@/utils/helpers';
import { cn } from '@/lib/utils';
import type { Recipe } from '@/types';

export default function Home() {
  const recipes = useRecipeStore((s) => s.recipes);
  const getExpertUsers = useUserStore((s) => s.getExpertUsers);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const featured: Recipe[] = [...recipes]
    .sort((a, b) => b.favoriteCount - a.favoriteCount)
    .slice(0, 4);

  const filtered = activeCategory
    ? recipes.filter((r) => r.categoryId === activeCategory)
    : recipes;

  const experts = getExpertUsers();

  useEffect(() => {
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % featured.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [featured.length]);

  return (
    <div className="max-w-5xl mx-auto px-4">
      <section className="py-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          <TagChip
            label="全部"
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categories.map((cat) => (
            <TagChip
              key={cat.id}
              label={cat.name}
              icon={cat.icon}
              active={activeCategory === cat.id}
              onClick={() => setActiveCategory(cat.id)}
            />
          ))}
        </div>
      </section>

      <section className="py-4">
        <div className="relative overflow-hidden rounded-card">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
          >
            {featured.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipe/${recipe.id}`}
                className="relative w-full flex-shrink-0"
              >
                <img
                  src={recipe.coverImage}
                  alt={recipe.title}
                  className="aspect-[16/9] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-5 pt-16">
                  <h2 className="font-serif text-2xl font-bold text-white">
                    {recipe.title}
                  </h2>
                  <div className="mt-2 flex items-center gap-3 text-sm text-white/90">
                    <span className="flex items-center gap-1">
                      <StarRating rating={recipe.difficulty} size="sm" />
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatCookTime(recipe.cookTime)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-4 w-4" />
                      {recipe.favoriteCount}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 pb-1">
            {featured.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCarouselIndex(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === carouselIndex
                    ? 'w-5 bg-brand-500'
                    : 'w-1.5 bg-white/60'
                )}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-bold text-warm-brown">
            热门菜谱
          </h2>
          <Link
            to="/search"
            className="flex items-center gap-0.5 text-sm text-brand-500 hover:text-brand-600"
          >
            查看更多
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-4 columns-2 gap-4 md:columns-3 lg:columns-4">
          {filtered.map((recipe, i) => (
            <div
              key={recipe.id}
              className={cn(
                'mb-4 break-inside-avoid opacity-0 animate-fade-in-up',
                i < 6 && `stagger-${i + 1}`
              )}
            >
              <RecipeCard recipe={recipe} variant="default" />
            </div>
          ))}
        </div>
      </section>

      <section className="py-4">
        <h2 className="font-serif text-xl font-bold text-warm-brown">
          美食达人
        </h2>
        <div className="mt-4 flex gap-5 overflow-x-auto scrollbar-hide pb-2">
          {experts.map((user) => (
            <Link
              key={user.id}
              to={`/user/${user.id}`}
              className="flex flex-shrink-0 flex-col items-center gap-2"
            >
              <img
                src={user.avatar}
                alt={user.nickname}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-brand-200"
              />
              <span className="text-sm font-medium text-warm-brown">
                {user.nickname}
              </span>
              <span className="text-xs text-warm-muted">
                {user.followerCount} 粉丝
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
