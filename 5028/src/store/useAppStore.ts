import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Favorite, Review, Trip, TripDay, TripAttraction } from "@/types";
import { mockReviews } from "@/data/mockData";

interface AppState {
  favorites: Favorite[];
  reviews: Review[];
  trips: Trip[];
  currentTripId: string | null;

  addFavorite: (attractionId: string, note: string, group: string) => void;
  removeFavorite: (id: string) => void;
  updateFavorite: (id: string, note: string, group: string) => void;
  getFavoritesByGroup: (group: string) => Favorite[];
  getFavoriteByAttraction: (attractionId: string) => Favorite | undefined;
  getGroups: () => string[];

  addReview: (attractionId: string, rating: number, content: string) => void;
  getReviewsByAttraction: (attractionId: string) => Review[];

  createTrip: (title: string, startDate: string, days: number) => string;
  updateTrip: (id: string, data: Partial<Trip>) => void;
  deleteTrip: (id: string) => void;
  setCurrentTripId: (id: string | null) => void;

  addAttractionToDay: (tripId: string, dayId: string, attractionId: string, duration: number) => void;
  removeAttractionFromDay: (tripId: string, dayId: string, attractionId: string) => void;
  reorderAttractionsInDay: (tripId: string, dayId: string, attractionIds: string[]) => void;
  updateAttractionDuration: (tripId: string, dayId: string, attractionId: string, duration: number) => void;
  reorderDays: (tripId: string, dayIds: string[]) => void;

  generateShareId: (tripId: string) => string;
  getTripByShareId: (shareId: string) => Trip | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 10);

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      favorites: [],
      reviews: [...mockReviews],
      trips: [],
      currentTripId: null,

      addFavorite: (attractionId, note, group) => {
        const fav: Favorite = {
          id: generateId(),
          attractionId,
          note,
          group,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ favorites: [...s.favorites, fav] }));
      },

      removeFavorite: (id) => {
        set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
      },

      updateFavorite: (id, note, group) => {
        set((s) => ({
          favorites: s.favorites.map((f) =>
            f.id === id ? { ...f, note, group } : f
          ),
        }));
      },

      getFavoritesByGroup: (group) => {
        return get().favorites.filter((f) => f.group === group);
      },

      getFavoriteByAttraction: (attractionId) => {
        return get().favorites.find((f) => f.attractionId === attractionId);
      },

      getGroups: () => {
        const groups = new Set(get().favorites.map((f) => f.group));
        return Array.from(groups);
      },

      addReview: (attractionId, rating, content) => {
        const review: Review = {
          id: generateId(),
          attractionId,
          userId: "current",
          userName: "我",
          userAvatar: "😊",
          rating,
          content,
          createdAt: new Date().toISOString().split("T")[0],
        };
        set((s) => ({ reviews: [review, ...s.reviews] }));
      },

      getReviewsByAttraction: (attractionId) => {
        return get().reviews.filter((r) => r.attractionId === attractionId);
      },

      createTrip: (title, startDate, days) => {
        const tripId = generateId();
        const tripDays: TripDay[] = Array.from({ length: days }, (_, i) => {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);
          return {
            id: generateId(),
            date: date.toISOString().split("T")[0],
            order: i,
            attractions: [],
          };
        });
        const trip: Trip = {
          id: tripId,
          title,
          coverImage: "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=travel itinerary planner map compass adventure&image_size=landscape_16_9",
          days: tripDays,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ trips: [...s.trips, trip], currentTripId: tripId }));
        return tripId;
      },

      updateTrip: (id, data) => {
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id === id ? { ...t, ...data, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      deleteTrip: (id) => {
        set((s) => ({ trips: s.trips.filter((t) => t.id !== id) }));
      },

      setCurrentTripId: (id) => {
        set({ currentTripId: id });
      },

      addAttractionToDay: (tripId, dayId, attractionId, duration) => {
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            return {
              ...t,
              days: t.days.map((d) => {
                if (d.id !== dayId) return d;
                const maxOrder = d.attractions.reduce(
                  (max, a) => Math.max(max, a.order),
                  -1
                );
                const ta: TripAttraction = {
                  id: generateId(),
                  attractionId,
                  order: maxOrder + 1,
                  duration,
                };
                return { ...d, attractions: [...d.attractions, ta] };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      removeAttractionFromDay: (tripId, dayId, attractionId) => {
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            return {
              ...t,
              days: t.days.map((d) => {
                if (d.id !== dayId) return d;
                return {
                  ...d,
                  attractions: d.attractions
                    .filter((a) => a.attractionId !== attractionId)
                    .map((a, i) => ({ ...a, order: i })),
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      reorderAttractionsInDay: (tripId, dayId, attractionIds) => {
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            return {
              ...t,
              days: t.days.map((d) => {
                if (d.id !== dayId) return d;
                const reordered = attractionIds
                  .map((aId, i) => {
                    const found = d.attractions.find((a) => a.attractionId === aId);
                    return found ? { ...found, order: i } : null;
                  })
                  .filter(Boolean) as TripAttraction[];
                return { ...d, attractions: reordered };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      updateAttractionDuration: (tripId, dayId, attractionId, duration) => {
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            return {
              ...t,
              days: t.days.map((d) => {
                if (d.id !== dayId) return d;
                return {
                  ...d,
                  attractions: d.attractions.map((a) =>
                    a.attractionId === attractionId ? { ...a, duration } : a
                  ),
                };
              }),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      reorderDays: (tripId, dayIds) => {
        set((s) => ({
          trips: s.trips.map((t) => {
            if (t.id !== tripId) return t;
            const reordered = dayIds
              .map((dId, i) => {
                const found = t.days.find((d) => d.id === dId);
                return found ? { ...found, order: i } : null;
              })
              .filter(Boolean) as TripDay[];
            return { ...t, days: reordered, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      generateShareId: (tripId) => {
        const shareId = generateId();
        set((s) => ({
          trips: s.trips.map((t) =>
            t.id === tripId ? { ...t, shareId } : t
          ),
        }));
        return shareId;
      },

      getTripByShareId: (shareId) => {
        return get().trips.find((t) => t.shareId === shareId);
      },
    }),
    {
      name: "triptrail-storage",
    }
  )
);
