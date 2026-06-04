import { useState, useMemo } from 'react';
import { Search, X, SlidersHorizontal, Clock } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { useRecipeStore } from '@/stores/recipeStore';
import { categories } from '@/data/categories';
import RecipeCard from '@/components/recipe/RecipeCard';
import TagChip from '@/components/ui/TagChip';
import StarRating from '@/components/ui/StarRating';
import EmptyState from '@/components/ui/EmptyState';
import { formatCookTime } from '@/utils/helpers';

const difficultyOptions = [
  { value: 1, label: '简单' },
  { value: 2, label: '中等' },
  { value: 3, label: '困难' },
];

const cookTimeOptions = [
  { value: 30, label: '30分钟以内' },
  { value: 60, label: '60分钟以内' },
  { value: null, label: '不限' },
];

export default function SearchPage() {
  const { filters, setKeyword, setCategory, setDifficulty, setMaxCookTime } =
    useSearchStore();
  const { recipes } = useRecipeStore();
  const [showFilters, setShowFilters] = useState(false);

  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const titleMatch = recipe.title.toLowerCase().includes(kw);
        const ingredientMatch = recipe.ingredients.some((ing) =>
          ing.name.toLowerCase().includes(kw)
        );
        if (!titleMatch && !ingredientMatch) return false;
      }

      if (filters.categoryId && recipe.categoryId !== filters.categoryId) {
        return false;
      }

      if (filters.difficulty !== null && recipe.difficulty !== filters.difficulty) {
        return false;
      }

      if (filters.maxCookTime !== null && recipe.cookTime > filters.maxCookTime) {
        return false;
      }

      return true;
    });
  }, [recipes, filters]);

  return (
    <div className="min-h-screen bg-cream pb-8">
      <div className="sticky top-0 z-40 bg-cream px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-muted" />
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索菜谱、食材..."
              className="w-full rounded-full bg-white py-2.5 pl-9 pr-9 text-sm text-warm-brown shadow-sm outline-none placeholder:text-warm-muted focus:ring-2 focus:ring-brand-500/30"
            />
            {filters.keyword && (
              <button
                onClick={() => setKeyword('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-muted hover:text-warm-brown"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
              showFilters
                ? 'bg-brand-500 text-white'
                : 'bg-white text-warm-brown shadow-sm'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: showFilters ? '400px' : '0px' }}
      >
        <div className="space-y-4 border-b border-warm-gray/50 px-4 pb-4">
          <div>
            <p className="mb-2 text-xs font-medium text-warm-muted">分类</p>
            <div className="flex flex-wrap gap-2">
              <TagChip
                label="全部"
                active={filters.categoryId === ''}
                onClick={() => setCategory('')}
              />
              {categories.map((cat) => (
                <TagChip
                  key={cat.id}
                  label={cat.name}
                  icon={cat.icon}
                  active={filters.categoryId === cat.id}
                  onClick={() =>
                    setCategory(filters.categoryId === cat.id ? '' : cat.id)
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-warm-muted">难度</p>
            <div className="flex gap-2">
              {difficultyOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() =>
                    setDifficulty(filters.difficulty === opt.value ? null : opt.value)
                  }
                  className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium transition-colors ${
                    filters.difficulty === opt.value
                      ? 'bg-brand-500 text-white'
                      : 'bg-warm-gray text-warm-brown'
                  }`}
                >
                  <StarRating rating={opt.value as 1 | 2 | 3} size="sm" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-warm-muted">烹饪时间</p>
            <div className="flex gap-2">
              {cookTimeOptions.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setMaxCookTime(opt.value)}
                  className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-medium transition-colors ${
                    filters.maxCookTime === opt.value
                      ? 'bg-brand-500 text-white'
                      : 'bg-warm-gray text-warm-brown'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 pt-4">
        <p className="mb-3 text-sm text-warm-muted">
          找到 <span className="font-semibold text-warm-brown">{filteredRecipes.length}</span> 个菜谱
        </p>

        {filteredRecipes.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} variant="compact" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Search className="h-10 w-10" />}
            title="没有找到相关菜谱"
            description="换个关键词或调整筛选条件试试"
          />
        )}
      </div>
    </div>
  );
}
