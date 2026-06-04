import { useState } from 'react';
import { ShoppingCart, Plus, Trash2, Check, Cloud, CloudOff, Package } from 'lucide-react';
import { useShoppingStore } from '@/stores/shoppingStore';
import { groupItems, getSortedGroups } from '@/utils/shoppingGroup';
import EmptyState from '@/components/ui/EmptyState';
import { GroupMode } from '@/types';

export default function ShoppingList() {
  const { items, groupMode, setGroupMode, addItem, removeItem, togglePurchased, clearPurchased } = useShoppingStore();
  const [inputName, setInputName] = useState('');
  const [inputAmount, setInputAmount] = useState('');

  const purchasedCount = items.filter(i => i.purchased).length;
  const hasPurchased = purchasedCount > 0;
  const isEmpty = items.length === 0;

  const groups = getSortedGroups(groupItems(items, groupMode), groupMode);

  const handleAdd = () => {
    const name = inputName.trim();
    if (!name) return;
    addItem(name, inputAmount.trim());
    setInputName('');
    setInputAmount('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pb-32">
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-warm-brown">购物清单</h1>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-brand-500 text-white text-xs font-medium">
            {items.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-mint">
            <Cloud size={16} />
            <span className="text-xs font-medium">已同步</span>
          </div>
          {hasPurchased && (
            <button
              onClick={clearPurchased}
              className="text-xs text-warm-muted hover:text-brand-500 transition-colors"
            >
              清除已购
            </button>
          )}
        </div>
      </div>

      {!isEmpty && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setGroupMode('category')}
            className={`px-4 py-1.5 rounded-pill text-sm font-medium transition-colors ${
              groupMode === 'category'
                ? 'bg-brand-500 text-white'
                : 'bg-warm-gray text-warm-brown'
            }`}
          >
            按食材类别
          </button>
          <button
            onClick={() => setGroupMode('supermarket')}
            className={`px-4 py-1.5 rounded-pill text-sm font-medium transition-colors ${
              groupMode === 'supermarket'
                ? 'bg-brand-500 text-white'
                : 'bg-warm-gray text-warm-brown'
            }`}
          >
            按商超分区
          </button>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<Package size={48} />}
          title="购物清单为空"
          description="从菜谱详情页添加食材到购物清单"
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.name}>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-semibold text-warm-brown">{group.name}</h2>
                <span className="text-xs text-warm-muted">{group.items.length}项</span>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center gap-3 px-3 py-2.5 rounded-card bg-white/60 transition-all"
                  >
                    <button
                      onClick={() => togglePurchased(item.id)}
                      className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        item.purchased
                          ? 'bg-mint border-mint'
                          : 'border-warm-muted/40 hover:border-mint'
                      }`}
                    >
                      {item.purchased && <Check size={14} className="text-white" />}
                    </button>
                    <div className={`flex-1 min-w-0 transition-all ${item.purchased ? 'opacity-60' : ''}`}>
                      <span className={`text-sm ${item.purchased ? 'line-through text-warm-muted' : 'text-warm-brown'}`}>
                        {item.name}
                      </span>
                      {item.amount && (
                        <span className={`text-xs ml-2 ${item.purchased ? 'text-warm-muted/60' : 'text-warm-muted'}`}>
                          {item.amount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-warm-muted hover:text-red-400 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="fixed bottom-16 left-0 right-0 bg-cream shadow-[0_-2px_8px_rgba(0,0,0,0.06)] z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="添加商品..."
            className="flex-1 h-10 px-3 rounded-lg bg-white border border-warm-gray text-sm text-warm-brown placeholder:text-warm-muted/60 focus:outline-none focus:border-brand-400 transition-colors"
          />
          <input
            type="text"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="用量"
            className="w-20 h-10 px-3 rounded-lg bg-white border border-warm-gray text-sm text-warm-brown placeholder:text-warm-muted/60 focus:outline-none focus:border-brand-400 transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!inputName.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-lg bg-brand-500 text-white flex items-center justify-center hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
