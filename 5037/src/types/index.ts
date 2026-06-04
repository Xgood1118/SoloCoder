export interface User {
  id: string;
  nickname: string;
  avatar: string;
  bio: string;
  isExpert: boolean;
  followerCount: number;
  followingCount: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Ingredient {
  id: string;
  recipeId: string;
  name: string;
  amount: string;
  category: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Step {
  id: string;
  recipeId: string;
  order: number;
  description: string;
  image: string;
}

export interface Recipe {
  id: string;
  authorId: string;
  title: string;
  coverImage: string;
  categoryId: string;
  difficulty: 1 | 2 | 3;
  cookTime: number;
  description: string;
  favoriteCount: number;
  likeCount: number;
  createdAt: string;
  ingredients: Ingredient[];
  steps: Step[];
}

export interface Favorite {
  id: string;
  userId: string;
  recipeId: string;
  createdAt: string;
}

export interface Note {
  id: string;
  userId: string;
  recipeId: string;
  content: string;
  createdAt: string;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  amount: string;
  category: string;
  supermarketSection: string;
  purchased: boolean;
  recipeSource?: string;
}

export interface ShoppingList {
  id: string;
  userId: string;
  name: string;
  groupMode: 'category' | 'supermarket';
  createdAt: string;
  items: ShoppingItem[];
}

export type GroupMode = 'category' | 'supermarket';

export interface NutritionSummary {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface SearchFilters {
  keyword: string;
  categoryId: string;
  difficulty: number | null;
  maxCookTime: number | null;
}
