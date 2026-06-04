export interface Attraction {
  id: string;
  name: string;
  city: string;
  category: "nature" | "culture" | "food" | "shopping";
  images: string[];
  description: string;
  rating: number;
  reviewCount: number;
  ticketPrice: number;
  openHours: string;
  suggestedDuration: number;
  bestSeason: string[];
  latitude: number;
  longitude: number;
  address: string;
}

export interface Favorite {
  id: string;
  attractionId: string;
  note: string;
  group: string;
  createdAt: string;
}

export interface Review {
  id: string;
  attractionId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface TripAttraction {
  id: string;
  attractionId: string;
  order: number;
  duration: number;
  transportToNext?: string;
  transportDuration?: number;
}

export interface TripDay {
  id: string;
  date: string;
  order: number;
  attractions: TripAttraction[];
}

export interface Trip {
  id: string;
  title: string;
  coverImage: string;
  days: TripDay[];
  createdAt: string;
  updatedAt: string;
  shareId?: string;
}

export interface RouteSegment {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  distance: number;
  duration: number;
}

export type CategoryType = "nature" | "culture" | "food" | "shopping";

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  nature: "自然风光",
  culture: "人文古迹",
  food: "美食探店",
  shopping: "购物休闲",
};

export const SEASON_LABELS: Record<string, string> = {
  spring: "春季",
  summer: "夏季",
  autumn: "秋季",
  winter: "冬季",
};
