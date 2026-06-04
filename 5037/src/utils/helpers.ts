export function formatCookTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${remaining}分钟`;
}

export function getDifficultyLabel(difficulty: 1 | 2 | 3): string {
  const labels: Record<number, string> = { 1: '简单', 2: '中等', 3: '困难' };
  return labels[difficulty];
}

export function getDifficultyStars(difficulty: 1 | 2 | 3): string {
  const stars: Record<number, string> = { 1: '★☆☆', 2: '★★☆', 3: '★★★' };
  return stars[difficulty];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
