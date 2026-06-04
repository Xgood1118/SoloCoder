import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { useRecipeStore } from '@/stores/recipeStore';
import { useUserStore } from '@/stores/userStore';
import { useShoppingStore } from '@/stores/shoppingStore';
import IngredientList from '@/components/recipe/IngredientList';
import StepTimeline from '@/components/recipe/StepTimeline';
import NutritionRing from '@/components/recipe/NutritionRing';
import NoteModal from '@/components/ui/NoteModal';
import StarRating from '@/components/ui/StarRating';
import { calculateNutrition } from '@/utils/nutritionCalc';
import { formatCookTime, getDifficultyLabel, generateId, formatDate } from '@/utils/helpers';
import { categories } from '@/data/categories';
import { ArrowLeft, Heart, MessageSquare, ThumbsUp, Share2, ShoppingCart, Clock } from 'lucide-react';

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isHeartAnimating, setIsHeartAnimating] = useState(false);

  const getRecipeById = useRecipeStore((s) => s.getRecipeById);
  const toggleFavorite = useRecipeStore((s) => s.toggleFavorite);
  const isFavorite = useRecipeStore((s) => s.isFavorite);
  const getNotesForRecipe = useRecipeStore((s) => s.getNotesForRecipe);
  const addNote = useRecipeStore((s) => s.addNote);
  const toggleLike = useRecipeStore((s) => s.toggleLike);
  const isLiked = useRecipeStore((s) => s.isLiked);

  const currentUser = useUserStore((s) => s.currentUser);
  const getUserById = useUserStore((s) => s.getUserById);
  const toggleFollow = useUserStore((s) => s.toggleFollow);
  const isFollowing = useUserStore((s) => s.isFollowing);

  const addItemsFromRecipe = useShoppingStore((s) => s.addItemsFromRecipe);

  const recipe = getRecipeById(id || '');
  const category = categories.find((c) => c.id === recipe?.categoryId);
  const author = recipe ? getUserById(recipe.authorId) : undefined;
  const notes = getNotesForRecipe(id || '');
  const nutrition = recipe ? calculateNutrition(recipe.ingredients) : { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const favorite = isFavorite(currentUser.id, id || '');
  const liked = isLiked(id || '');
  const following = author ? isFollowing(author.id) : false;

  const handleBack = () => navigate(-1);

  const handleToggleFavorite = () => {
    setIsHeartAnimating(true);
    toggleFavorite(currentUser.id, id || '');
    setTimeout(() => setIsHeartAnimating(false), 600);
  };

  const handleToggleLike = () => {
    toggleLike(id || '');
  };

  const handleToggleFollow = () => {
    if (author) {
      toggleFollow(author.id);
    }
  };

  const handleAddToShoppingList = () => {
    if (recipe) {
      addItemsFromRecipe(
        recipe.id,
        recipe.title,
        recipe.ingredients.map((i) => ({
          name: i.name,
          amount: i.amount,
          category: i.category,
        }))
      );
    }
  };

  const handleSubmitNote = (content: string) => {
    addNote({
      id: generateId(),
      userId: currentUser.id,
      recipeId: id || '',
      content,
      createdAt: new Date().toISOString(),
    });
  };

  if (!recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-warm-muted">菜谱不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-24">
      <div className="relative">
        <img
          src={recipe.coverImage}
          alt={recipe.title}
          className="max-h-80 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-transparent to-transparent" />
        <button
          onClick={handleBack}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-card"
        >
          <ArrowLeft className="h-5 w-5 text-warm-brown" />
        </button>
        <button className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm shadow-card">
          <Share2 className="h-5 w-5 text-warm-brown" />
        </button>
      </div>

      <div className="px-4">
        <div className="mb-4">
          <h1 className="font-serif text-2xl font-bold text-warm-brown">
            {recipe.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-pill bg-brand-100 px-3 py-1 text-sm font-medium text-brand-600">
              {category?.name || '未分类'}
            </span>
            <StarRating rating={recipe.difficulty} />
            <span className="flex items-center gap-1 text-sm text-warm-muted">
              <Clock className="h-4 w-4" />
              {formatCookTime(recipe.cookTime)}
            </span>
          </div>
        </div>

        {author && (
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={author.avatar}
                alt={author.nickname}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <p className="font-medium text-warm-brown">{author.nickname}</p>
                <p className="text-xs text-warm-muted">
                  {author.followerCount} 粉丝
                </p>
              </div>
            </div>
            {author.id !== currentUser.id && (
              <button
                onClick={handleToggleFollow}
                className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                  following
                    ? 'bg-warm-gray text-warm-brown'
                    : 'bg-brand-500 text-white hover:bg-brand-600'
                }`}
              >
                {following ? '已关注' : '关注'}
              </button>
            )}
          </div>
        )}

        <p className="mb-6 text-sm leading-relaxed text-warm-muted">
          {recipe.description}
        </p>

        <section className="mb-8">
          <h2 className="mb-4 font-serif text-lg font-semibold text-warm-brown">
            食材清单
          </h2>
          <IngredientList
            ingredients={recipe.ingredients}
            onAddToShoppingList={handleAddToShoppingList}
          />
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-serif text-lg font-semibold text-warm-brown">
            烹饪步骤
          </h2>
          <StepTimeline steps={recipe.steps} />
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-serif text-lg font-semibold text-warm-brown">
            营养信息
          </h2>
          <NutritionRing nutrition={nutrition} />
          <p className="mt-3 text-center text-xs text-warm-muted">
            营养数据仅供参考，具体标准请咨询营养师
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 font-serif text-lg font-semibold text-warm-brown">
            烹饪笔记 ({notes.length})
          </h2>
          <div className="space-y-4">
            {notes.map((note) => {
              const noteUser = getUserById(note.userId);
              return (
                <div key={note.id} className="rounded-card bg-warm-gray/50 p-4">
                  <div className="flex items-center gap-2">
                    <img
                      src={noteUser?.avatar || ''}
                      alt={noteUser?.nickname || ''}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <span className="text-sm font-medium text-warm-brown">
                      {noteUser?.nickname || '匿名用户'}
                    </span>
                    <span className="text-xs text-warm-muted">
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-warm-brown">
                    {note.content}
                  </p>
                </div>
              );
            })}
            {notes.length === 0 && (
              <p className="text-center text-sm text-warm-muted">
                暂无笔记，点击右下角按钮添加第一条笔记
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="fixed bottom-16 left-0 right-0 z-[60] border-t border-warm-gray/50 bg-cream/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={handleToggleFavorite}
              className="flex flex-col items-center gap-0.5"
            >
              <Heart
                className={`h-6 w-6 transition-colors ${
                  isHeartAnimating ? 'animate-heartbeat' : ''
                } ${favorite ? 'fill-brand-500 text-brand-500' : 'text-warm-muted'}`}
              />
              <span className="text-xs text-warm-muted">
                {recipe.favoriteCount}
              </span>
            </button>
            <button
              onClick={handleToggleLike}
              className="flex flex-col items-center gap-0.5"
            >
              <ThumbsUp
                className={`h-6 w-6 transition-colors ${
                  liked ? 'fill-brand-500 text-brand-500' : 'text-warm-muted'
                }`}
              />
              <span className="text-xs text-warm-muted">
                {recipe.likeCount}
              </span>
            </button>
            <button
              onClick={() => setIsNoteModalOpen(true)}
              className="flex flex-col items-center gap-0.5"
            >
              <MessageSquare className="h-6 w-6 text-warm-muted" />
              <span className="text-xs text-warm-muted">
                {notes.length}
              </span>
            </button>
          </div>
          <button
            onClick={handleAddToShoppingList}
            className="flex items-center gap-2 rounded-pill bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            <ShoppingCart className="h-4 w-4" />
            加入购物清单
          </button>
        </div>
      </div>

      <NoteModal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        onSubmit={handleSubmitNote}
      />
    </div>
  );
}
