import { Ingredient, NutritionSummary } from '@/types';
import { nutritionDB } from '@/data/nutritionDB';

function parseAmountMultiplier(amount: string): number {
  const match = amount.match(/(\d+(?:\.\d+)?)\s*g/);
  if (match) {
    return parseFloat(match[1]) / 100;
  }
  return 1;
}

export function calculateNutrition(ingredients: Ingredient[]): NutritionSummary {
  const result: NutritionSummary = { calories: 0, protein: 0, fat: 0, carbs: 0 };

  for (const ingredient of ingredients) {
    const base = nutritionDB[ingredient.name];
    if (base) {
      const multiplier = parseAmountMultiplier(ingredient.amount);
      result.calories += base.calories * multiplier;
      result.protein += base.protein * multiplier;
      result.fat += base.fat * multiplier;
      result.carbs += base.carbs * multiplier;
    } else {
      result.calories += ingredient.calories;
      result.protein += ingredient.protein;
      result.fat += ingredient.fat;
      result.carbs += ingredient.carbs;
    }
  }

  return {
    calories: Math.round(result.calories),
    protein: Math.round(result.protein * 10) / 10,
    fat: Math.round(result.fat * 10) / 10,
    carbs: Math.round(result.carbs * 10) / 10,
  };
}
