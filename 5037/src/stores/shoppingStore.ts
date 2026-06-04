import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ShoppingItem, GroupMode } from '@/types';

const CATEGORY_TO_SECTION: Record<string, string> = {
  '肉类': '生鲜区',
  '海鲜': '生鲜区',
  '蔬菜': '蔬果区',
  '调味料': '调味品区',
  '主食': '粮油区',
  '蛋奶': '乳品区',
  '豆制品': '豆制品区',
};

function getSupermarketSection(category: string): string {
  return CATEGORY_TO_SECTION[category] ?? '其他';
}

interface ShoppingState {
  items: ShoppingItem[];
  groupMode: GroupMode;
  setGroupMode: (mode: GroupMode) => void;
  addItemsFromRecipe: (
    recipeId: string,
    recipeTitle: string,
    ingredients: Array<{ name: string; amount: string; category: string }>
  ) => void;
  addItem: (name: string, amount: string) => void;
  removeItem: (id: string) => void;
  togglePurchased: (id: string) => void;
  clearPurchased: () => void;
  clearAll: () => void;
}

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set) => ({
      items: [],
      groupMode: 'category' as GroupMode,

      setGroupMode: (mode) => set({ groupMode: mode }),

      addItemsFromRecipe: (recipeId, recipeTitle, ingredients) =>
        set((state) => {
          const newItems: ShoppingItem[] = ingredients.map((ing, index) => ({
            id: `si_${recipeId}_${Date.now()}_${index}`,
            listId: `list_default`,
            name: ing.name,
            amount: ing.amount,
            category: ing.category,
            supermarketSection: getSupermarketSection(ing.category),
            purchased: false,
            recipeSource: recipeTitle,
          }));
          return { items: [...state.items, ...newItems] };
        }),

      addItem: (name, amount) =>
        set((state) => ({
          items: [
            ...state.items,
            {
              id: `si_${Date.now()}`,
              listId: 'list_default',
              name,
              amount,
              category: '其他',
              supermarketSection: '其他',
              purchased: false,
            },
          ],
        })),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((item) => item.id !== id) })),

      togglePurchased: (id) =>
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, purchased: !item.purchased } : item
          ),
        })),

      clearPurchased: () =>
        set((state) => ({
          items: state.items.filter((item) => !item.purchased),
        })),

      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'shopping-store',
    }
  )
);
