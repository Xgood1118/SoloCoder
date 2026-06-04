import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Heart, BookMarked, Users, ChefHat, LogOut } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { useRecipeStore } from '@/stores/recipeStore';
import RecipeCard from '@/components/recipe/RecipeCard';
import EmptyState from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/helpers';

type TabType = 'recipes' | 'favorites' | 'notes' | 'following';

export default function Profile() {
  const { currentUser, users, follows, isFollowing } = useUserStore();
  const { getRecipesByAuthor, isFavorite, notes, recipes } = useRecipeStore();
  const [activeTab, setActiveTab] = useState<TabType>('recipes');

  const userRecipes = getRecipesByAuthor(currentUser.id);
  const favoriteRecipes = recipes.filter((r) => isFavorite(currentUser.id, r.id));
  const userNotes = notes.filter((n) => n.userId === currentUser.id);
  const followedUsers = users.filter((u) => isFollowing(u.id));

  const tabs = [
    { key: 'recipes' as TabType, label: '我的菜谱', icon: ChefHat },
    { key: 'favorites' as TabType, label: '我的收藏', icon: Heart },
    { key: 'notes' as TabType, label: '我的笔记', icon: BookMarked },
    { key: 'following' as TabType, label: '我的关注', icon: Users },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 pb-32">
      <div className="flex items-start justify-between py-4">
        <div className="flex items-center gap-4">
          <img
            src={currentUser.avatar}
            alt={currentUser.nickname}
            className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-card"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-warm-brown">{currentUser.nickname}</h1>
              {currentUser.isExpert && (
                <span className="px-2 py-0.5 rounded-full bg-brand-100 text-brand-600 text-xs font-medium">
                  美食达人
                </span>
              )}
            </div>
            <p className="text-sm text-warm-muted mt-1 max-w-md">{currentUser.bio}</p>
          </div>
        </div>
        <button className="p-2 rounded-lg hover:bg-warm-gray transition-colors text-warm-brown">
          <Settings size={20} />
        </button>
      </div>

      <div className="flex items-center gap-8 py-4 border-y border-warm-gray/50">
        <div className="text-center">
          <div className="text-lg font-bold text-warm-brown">{userRecipes.length}</div>
          <div className="text-xs text-warm-muted">菜谱</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-warm-brown">{currentUser.followerCount}</div>
          <div className="text-xs text-warm-muted">粉丝</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-warm-brown">{currentUser.followingCount}</div>
          <div className="text-xs text-warm-muted">关注</div>
        </div>
      </div>

      <div className="flex gap-1 py-4 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-brand-500 text-white'
                  : 'text-warm-muted hover:text-warm-brown hover:bg-warm-gray'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="py-4">
        {activeTab === 'recipes' && (
          <>
            {userRecipes.length === 0 ? (
              <EmptyState
                icon={<ChefHat size={48} />}
                title="还没有发布菜谱"
                description="分享你的第一道美食作品吧"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} variant="compact" />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'favorites' && (
          <>
            {favoriteRecipes.length === 0 ? (
              <EmptyState
                icon={<Heart size={48} />}
                title="还没有收藏菜谱"
                description="看到喜欢的菜谱就收藏起来吧"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {favoriteRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} variant="compact" />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'notes' && (
          <>
            {userNotes.length === 0 ? (
              <EmptyState
                icon={<BookMarked size={48} />}
                title="还没有笔记"
                description="在做菜谱时可以记录你的心得"
              />
            ) : (
              <div className="space-y-3">
                {userNotes.map((note) => {
                  const recipe = recipes.find((r) => r.id === note.recipeId);
                  return (
                    <Link
                      key={note.id}
                      to={`/recipe/${note.recipeId}`}
                      className="block p-4 rounded-card bg-white shadow-card hover:shadow-card-hover transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-medium text-warm-brown">{recipe?.title || '未知菜谱'}</h3>
                        <span className="text-xs text-warm-muted">{formatDate(note.createdAt)}</span>
                      </div>
                      <p className="text-sm text-warm-muted line-clamp-3">{note.content}</p>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'following' && (
          <>
            {followedUsers.length === 0 ? (
              <EmptyState
                icon={<Users size={48} />}
                title="还没有关注任何人"
                description="关注喜欢的美食达人吧"
              />
            ) : (
              <div className="flex gap-4 overflow-x-auto pb-2">
                {followedUsers.map((user) => (
                  <Link
                    key={user.id}
                    to={`/user/${user.id}`}
                    className="flex flex-col items-center gap-2 flex-shrink-0 w-20"
                  >
                    <img
                      src={user.avatar}
                      alt={user.nickname}
                      className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-card"
                    />
                    <span className="text-xs text-warm-brown text-center line-clamp-1 font-medium">
                      {user.nickname}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
