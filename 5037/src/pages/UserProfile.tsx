import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChefHat } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { useRecipeStore } from '@/stores/recipeStore';
import RecipeCard from '@/components/recipe/RecipeCard';
import EmptyState from '@/components/ui/EmptyState';

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getUserById, isFollowing, toggleFollow } = useUserStore();
  const { getRecipesByAuthor } = useRecipeStore();

  const user = getUserById(id || '');
  const userRecipes = user ? getRecipesByAuthor(user.id) : [];
  const followed = user ? isFollowing(user.id) : false;

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 pb-32">
        <div className="py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-warm-muted hover:text-warm-brown transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">返回</span>
          </button>
        </div>
        <EmptyState title="用户不存在" description="该用户可能已被注销或不存在" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 pb-32">
      <div className="flex items-center justify-between py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-warm-muted hover:text-warm-brown transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm">返回</span>
        </button>
      </div>

      <div className="flex items-start justify-between py-4">
        <div className="flex items-center gap-4">
          <img
            src={user.avatar}
            alt={user.nickname}
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-card"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-warm-brown">{user.nickname}</h1>
              {user.isExpert && (
                <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-600 text-xs font-medium">
                  美食达人
                </span>
              )}
            </div>
            <p className="text-sm text-warm-muted mt-1 max-w-md">{user.bio}</p>
          </div>
        </div>
        <button
          onClick={() => toggleFollow(user.id)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            followed
              ? 'bg-warm-gray text-warm-brown hover:bg-warm-gray/80'
              : 'bg-brand-500 text-white hover:bg-brand-600'
          }`}
        >
          {followed ? '已关注' : '关注'}
        </button>
      </div>

      <div className="flex items-center gap-8 py-4 border-y border-warm-gray/50">
        <div className="text-center">
          <div className="text-lg font-bold text-warm-brown">{userRecipes.length}</div>
          <div className="text-xs text-warm-muted">菜谱</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-warm-brown">{user.followerCount}</div>
          <div className="text-xs text-warm-muted">粉丝</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-warm-brown">{user.followingCount}</div>
          <div className="text-xs text-warm-muted">关注</div>
        </div>
      </div>

      <div className="py-4">
        <h2 className="text-lg font-semibold text-warm-brown mb-4">TA的菜谱</h2>
        {userRecipes.length === 0 ? (
          <EmptyState
            icon={<ChefHat size={48} />}
            title="还没有发布菜谱"
            description="该用户暂时没有分享美食作品"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} variant="compact" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
