import { create } from 'zustand';
import type { AuthUser, Credentials } from '@/types';
import { services } from '@/services';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  /** App 啟動時還原既有 session。 */
  bootstrap: () => Promise<void>;
  login: (credentials: Credentials) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** 資料異動（例如被改了工班）後同步 session。 */
  refresh: () => Promise<void>;
}

/**
 * 登入狀態與 session 用 Zustand 管理；非同步資料一律交給 TanStack Query，
 * 兩者不重疊。真正的驗證都在 services.auth，這裡只保存結果。
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',

  bootstrap: async () => {
    try {
      const user = await services.auth.getCurrentUser();
      set({ user, status: user ? 'authenticated' : 'anonymous' });
    } catch {
      set({ user: null, status: 'anonymous' });
    }
  },

  login: async (credentials) => {
    const user = await services.auth.login(credentials);
    set({ user, status: 'authenticated' });
    return user;
  },

  logout: async () => {
    await services.auth.logout();
    set({ user: null, status: 'anonymous' });
  },

  refresh: async () => {
    const user = await services.auth.getCurrentUser();
    set({ user, status: user ? 'authenticated' : 'anonymous' });
  },
}));

export const selectUser = (state: AuthState) => state.user;
export const selectStatus = (state: AuthState) => state.status;
