import { ShoppingItem, GroupMode } from '@/types';

export function groupItems(items: ShoppingItem[], mode: GroupMode): Record<string, ShoppingItem[]> {
  const groups: Record<string, ShoppingItem[]> = {};

  for (const item of items) {
    const key = mode === 'category' ? item.category : item.supermarketSection;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return groups;
}

export const categoryOrder = ['肉类', '海鲜', '蔬菜', '蛋奶', '豆制品', '主食', '调味料', '其他'];
export const supermarketOrder = ['生鲜区', '蔬果区', '乳品区', '豆制品区', '粮油区', '调味品区', '其他'];

export function getSortedGroups(
  groups: Record<string, ShoppingItem[]>,
  mode: GroupMode
): Array<{ name: string; items: ShoppingItem[] }> {
  const order = mode === 'category' ? categoryOrder : supermarketOrder;

  const sorted: Array<{ name: string; items: ShoppingItem[] }> = [];

  for (const name of order) {
    if (groups[name]) {
      sorted.push({ name, items: groups[name] });
    }
  }

  for (const name of Object.keys(groups)) {
    if (!order.includes(name)) {
      sorted.push({ name, items: groups[name] });
    }
  }

  return sorted;
}
