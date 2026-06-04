import { ShoppingCart } from 'lucide-react';
import type { Ingredient } from '@/types';

interface IngredientListProps {
  ingredients: Ingredient[];
  onAddToShoppingList?: () => void;
}

export default function IngredientList({ ingredients, onAddToShoppingList }: IngredientListProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ingredients.map(item => (
        <div
          key={item.id}
          className="flex-shrink-0 rounded-card bg-warm-gray px-4 py-3"
        >
          <p className="text-sm font-medium text-warm-brown">{item.name}</p>
          <p className="text-xs text-warm-muted">{item.amount}</p>
        </div>
      ))}
      {onAddToShoppingList && (
        <button
          onClick={onAddToShoppingList}
          className="flex flex-shrink-0 items-center gap-2 rounded-card bg-brand-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          <ShoppingCart className="h-4 w-4" />
          一键加入购物清单
        </button>
      )}
    </div>
  );
}
