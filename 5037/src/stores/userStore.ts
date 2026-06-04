import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Follow } from '@/types';
import { mockUsers } from '@/data/mockUsers';

interface UserState {
  currentUser: User;
  users: User[];
  follows: Follow[];
  toggleFollow: (targetUserId: string) => void;
  isFollowing: (targetUserId: string) => boolean;
  getUserById: (id: string) => User | undefined;
  getExpertUsers: () => User[];
}

const firstExpert = mockUsers.find((u) => u.isExpert)!;

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      currentUser: firstExpert,
      users: mockUsers,
      follows: [],

      toggleFollow: (targetUserId) =>
        set((state) => {
          const existing = state.follows.find(
            (f) =>
              f.followerId === state.currentUser.id &&
              f.followingId === targetUserId
          );
          if (existing) {
            return {
              follows: state.follows.filter((f) => f.id !== existing.id),
              users: state.users.map((u) => {
                if (u.id === targetUserId) {
                  return { ...u, followerCount: Math.max(0, u.followerCount - 1) };
                }
                if (u.id === state.currentUser.id) {
                  return { ...u, followingCount: Math.max(0, u.followingCount - 1) };
                }
                return u;
              }),
              currentUser: {
                ...state.currentUser,
                followingCount: Math.max(0, state.currentUser.followingCount - 1),
              },
            };
          }
          return {
            follows: [
              ...state.follows,
              {
                id: `follow_${Date.now()}`,
                followerId: state.currentUser.id,
                followingId: targetUserId,
                createdAt: new Date().toISOString(),
              },
            ],
            users: state.users.map((u) => {
              if (u.id === targetUserId) {
                return { ...u, followerCount: u.followerCount + 1 };
              }
              if (u.id === state.currentUser.id) {
                return { ...u, followingCount: u.followingCount + 1 };
              }
              return u;
            }),
            currentUser: {
              ...state.currentUser,
              followingCount: state.currentUser.followingCount + 1,
            },
          };
        }),

      isFollowing: (targetUserId) =>
        get().follows.some(
          (f) =>
            f.followerId === get().currentUser.id &&
            f.followingId === targetUserId
        ),

      getUserById: (id) => get().users.find((u) => u.id === id),

      getExpertUsers: () => get().users.filter((u) => u.isExpert),
    }),
    {
      name: 'user-store',
    }
  )
);
