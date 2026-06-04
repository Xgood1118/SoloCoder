import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecipeStore } from '@/stores/recipeStore';
import { useUserStore } from '@/stores/userStore';
import { categories } from '@/data/categories';
import StarRating from '@/components/ui/StarRating';
import { generateId } from '@/utils/helpers';
import { ArrowLeft, Plus, Trash2, Image, ChefHat, Clock, ListOrdered } from 'lucide-react';
import type { Recipe, Ingredient, Step } from '@/types';

export default function Publish() {
  const navigate = useNavigate();
  const addRecipe = useRecipeStore((s) => s.addRecipe);
  const currentUser = useUserStore((s) => s.currentUser);

  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3>(2);
  const [cookTime, setCookTime] = useState<number | ''>('');
  const [ingredients, setIngredients] = useState<Array<{ name: string; amount: string; category: string }>>([
    { name: '', amount: '', category: '其他' },
  ]);
  const [steps, setSteps] = useState<Array<{ order: number; description: string; image: string }>>([
    { order: 1, description: '', image: '' },
  ]);

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', category: '其他' }]);
  };

  const removeIngredient = (index: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
  };

  const addStep = () => {
    setSteps([...steps, { order: steps.length + 1, description: '', image: '' }]);
  };

  const removeStep = (index: number) => {
    const newSteps = [...steps];
    newSteps.splice(index, 1);
    const reordered = newSteps.map((step, i) => ({ ...step, order: i + 1 }));
    setSteps(reordered);
  };

  const handlePublish = () => {
    if (!title.trim()) return;

    const recipeId = generateId();
    const recipeIngredients: Ingredient[] = ingredients
      .filter((ing) => ing.name.trim())
      .map((ing) => ({
        id: generateId(),
        recipeId,
        name: ing.name,
        amount: ing.amount,
        category: ing.category,
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      }));

    const recipeSteps: Step[] = steps
      .filter((step) => step.description.trim())
      .map((step) => ({
        id: generateId(),
        recipeId,
        order: step.order,
        description: step.description,
        image: step.image,
      }));

    const newRecipe: Recipe = {
      id: recipeId,
      authorId: currentUser.id,
      title: title.trim(),
      coverImage: '',
      categoryId,
      difficulty,
      cookTime: typeof cookTime === 'number' ? cookTime : 0,
      description: '',
      favoriteCount: 0,
      likeCount: 0,
      createdAt: new Date().toISOString(),
      ingredients: recipeIngredients,
      steps: recipeSteps,
    };

    addRecipe(newRecipe);
    navigate('/');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-cream-100 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-warm-brown" />
          </button>
          <h1 className="font-serif text-xl font-bold text-warm-brown">发布菜谱</h1>
        </div>
        <button
          type="button"
          onClick={handlePublish}
          disabled={!title.trim()}
          className="px-5 py-2 rounded-full bg-brand-500 text-white font-medium hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          发布
        </button>
      </header>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ChefHat className="h-5 w-5 text-brand-500" />
          <h2 className="font-serif text-lg font-bold text-warm-brown">基本信息</h2>
        </div>
        <div className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="菜谱名称"
            className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-warm-brown placeholder-warm-muted"
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-warm-brown mb-2">分类</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-warm-brown"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-warm-brown mb-2">难度</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDifficulty(level as 1 | 2 | 3)}
                    className={`flex-1 px-3 py-3 rounded-xl border transition-all ${
                      difficulty === level
                        ? 'border-brand-500 bg-brand-50 text-brand-500'
                        : 'border-warm-200 bg-cream-50 text-warm-brown hover:border-brand-300'
                    }`}
                  >
                    <StarRating rating={level as 1 | 2 | 3} size="sm" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-warm-brown mb-2">烹饪时间</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value ? Number(e.target.value) : '')}
                placeholder="烹饪时间"
                className="flex-1 px-4 py-3 rounded-xl border border-warm-200 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-warm-brown placeholder-warm-muted"
              />
              <span className="text-warm-brown font-medium">分钟</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <ListOrdered className="h-5 w-5 text-brand-500" />
          <h2 className="font-serif text-lg font-bold text-warm-brown">食材清单</h2>
        </div>
        <div className="space-y-3">
          {ingredients.map((ing, index) => (
            <div key={index} className="flex items-center gap-3">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => {
                  const newIngredients = [...ingredients];
                  newIngredients[index].name = e.target.value;
                  setIngredients(newIngredients);
                }}
                placeholder="食材名称"
                className="flex-1 px-4 py-3 rounded-xl border border-warm-200 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-warm-brown placeholder-warm-muted"
              />
              <input
                type="text"
                value={ing.amount}
                onChange={(e) => {
                  const newIngredients = [...ingredients];
                  newIngredients[index].amount = e.target.value;
                  setIngredients(newIngredients);
                }}
                placeholder="用量"
                className="w-24 px-4 py-3 rounded-xl border border-warm-200 bg-cream-50 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-warm-brown placeholder-warm-muted"
              />
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                className="p-3 rounded-xl border border-warm-200 text-warm-muted hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addIngredient}
          className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-warm-200 text-warm-brown hover:border-brand-500 hover:text-brand-500 transition-colors w-full justify-center"
        >
          <Plus className="h-5 w-5" />
          <span>添加食材</span>
        </button>
      </section>

      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-brand-500" />
          <h2 className="font-serif text-lg font-bold text-warm-brown">烹饪步骤</h2>
        </div>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="bg-cream-50 rounded-xl p-4 border border-warm-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm">
                  {step.order}
                </div>
                <div className="flex-1 space-y-3">
                  <textarea
                    value={step.description}
                    onChange={(e) => {
                      const newSteps = [...steps];
                      newSteps[index].description = e.target.value;
                      setSteps(newSteps);
                    }}
                    placeholder="请输入步骤说明"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-warm-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-warm-brown placeholder-warm-muted resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-warm-200 bg-white text-warm-brown hover:border-brand-500 hover:text-brand-500 transition-colors"
                    >
                      <Image className="h-4 w-4" />
                      <span className="text-sm">添加图片</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStep(index)}
                      className="p-2 rounded-lg text-warm-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addStep}
          className="mt-4 flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-warm-200 text-warm-brown hover:border-brand-500 hover:text-brand-500 transition-colors w-full justify-center"
        >
          <Plus className="h-5 w-5" />
          <span>添加步骤</span>
        </button>
      </section>
    </div>
  );
}
