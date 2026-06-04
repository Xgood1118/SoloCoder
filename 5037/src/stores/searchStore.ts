import { create } from 'zustand';
import { SearchFilters } from '@/types';

const defaultFilters: SearchFilters = {
  keyword: '',
  categoryId: '',
  difficulty: null,
  maxCookTime: null,
};

interface SearchState {
  filters: SearchFilters;
  setKeyword: (keyword: string) => void;
  setCategory: (categoryId: string) => void;
  setDifficulty: (difficulty: number | null) => void;
  setMaxCookTime: (time: number | null) => void;
  resetFilters: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  filters: { ...defaultFilters },

  setKeyword: (keyword) =>
    set((state) => ({ filters: { ...state.filters, keyword } })),

  setCategory: (categoryId) =>
    set((state) => ({ filters: { ...state.filters, categoryId } })),

  setDifficulty: (difficulty) =>
    set((state) => ({ filters: { ...state.filters, difficulty } })),

  setMaxCookTime: (maxCookTime) =>
    set((state) => ({ filters: { ...state.filters, maxCookTime } })),

  resetFilters: () => set({ filters: { ...defaultFilters } }),
}));
