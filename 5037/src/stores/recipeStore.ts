import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Recipe, Favorite, Note } from '@/types';
import { mockRecipes } from '@/data/mockRecipes';

interface RecipeState {
  recipes: Recipe[];
  favorites: Favorite[];
  notes: Note[];
  likedRecipes: Set<string>;
  addRecipe: (recipe: Recipe) => void;
  toggleFavorite: (userId: string, recipeId: string) => void;
  isFavorite: (userId: string, recipeId: string) => boolean;
  addNote: (note: Note) => void;
  getNotesForRecipe: (recipeId: string) => Note[];
  getRecipeById: (id: string) => Recipe | undefined;
  getRecipesByCategory: (categoryId: string) => Recipe[];
  getRecipesByAuthor: (authorId: string) => Recipe[];
  toggleLike: (recipeId: string) => void;
  isLiked: (recipeId: string) => boolean;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: mockRecipes,
      favorites: [],
      notes: [],
      likedRecipes: new Set<string>(),

      addRecipe: (recipe) =>
        set((state) => ({ recipes: [...state.recipes, recipe] })),

      toggleFavorite: (userId, recipeId) =>
        set((state) => {
          const existing = state.favorites.find(
            (f) => f.userId === userId && f.recipeId === recipeId
          );
          if (existing) {
            return {
              favorites: state.favorites.filter((f) => f.id !== existing.id),
              recipes: state.recipes.map((r) =>
                r.id === recipeId
                  ? { ...r, favoriteCount: Math.max(0, r.favoriteCount - 1) }
                  : r
              ),
            };
          }
          return {
            favorites: [
              ...state.favorites,
              {
                id: `fav_${Date.now()}`,
                userId,
                recipeId,
                createdAt: new Date().toISOString(),
              },
            ],
            recipes: state.recipes.map((r) =>
              r.id === recipeId ? { ...r, favoriteCount: r.favoriteCount + 1 } : r
            ),
          };
        }),

      isFavorite: (userId, recipeId) =>
        get().favorites.some((f) => f.userId === userId && f.recipeId === recipeId),

      addNote: (note) => set((state) => ({ notes: [...state.notes, note] })),

      getNotesForRecipe: (recipeId) =>
        get().notes.filter((n) => n.recipeId === recipeId),

      getRecipeById: (id) => get().recipes.find((r) => r.id === id),

      getRecipesByCategory: (categoryId) =>
        get().recipes.filter((r) => r.categoryId === categoryId),

      getRecipesByAuthor: (authorId) =>
        get().recipes.filter((r) => r.authorId === authorId),

      toggleLike: (recipeId) =>
        set((state) => {
          const newLiked = new Set(state.likedRecipes);
          if (newLiked.has(recipeId)) {
            newLiked.delete(recipeId);
            return {
              likedRecipes: newLiked,
              recipes: state.recipes.map((r) =>
                r.id === recipeId
                  ? { ...r, likeCount: Math.max(0, r.likeCount - 1) }
                  : r
              ),
            };
          }
          newLiked.add(recipeId);
          return {
            likedRecipes: newLiked,
            recipes: state.recipes.map((r) =>
              r.id === recipeId ? { ...r, likeCount: r.likeCount + 1 } : r
            ),
          };
        }),

      isLiked: (recipeId) => get().likedRecipes.has(recipeId),
    }),
    {
      name: 'recipe-store',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const parsed = JSON.parse(str);
          return {
            ...parsed,
            state: {
              ...parsed.state,
              likedRecipes: new Set(parsed.state.likedRecipes || []),
            },
          };
        },
        setItem: (name, value) => {
          const serialized = {
            ...value,
            state: {
              ...value.state,
              likedRecipes: Array.from(value.state.likedRecipes),
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
