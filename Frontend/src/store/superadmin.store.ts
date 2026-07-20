import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SuperAdminState {
  accessToken: string | null;
  admin: { id: string; email: string; name: string } | null;
  setAuth: (token: string, admin: SuperAdminState['admin']) => void;
  logout:  () => void;
}

export const useSuperAdminStore = create<SuperAdminState>()(
  persist(
    (set) => ({
      accessToken: null,
      admin:       null,
      setAuth: (accessToken, admin) => {
        // TEMP DEBUG
        console.log('[store.setAuth] called — token:', accessToken?.slice(0, 20) ?? null, '| admin:', admin);
        set({ accessToken, admin });
        // TEMP DEBUG — confirm state after set()
        console.log('[store.setAuth] state after set:', useSuperAdminStore.getState().accessToken?.slice(0, 20) ?? null);
      },
      logout: () => {
        // TEMP DEBUG — capture full call stack to find who called logout
        console.log('[store.logout] called — stack:', new Error().stack);
        set({ accessToken: null, admin: null });
      },
    }),
    {
      name: 'insumitra-superadmin',
      // TEMP DEBUG — trace rehydration lifecycle
      onRehydrateStorage: () => {
        console.log('[persist] onRehydrateStorage: starting rehydration from localStorage');
        return (state, error) => {
          if (error) {
            console.log('[persist] rehydration ERROR:', error);
          } else {
            console.log('[persist] rehydration COMPLETE — accessToken:', state?.accessToken?.slice(0, 20) ?? null);
          }
        };
      },
    },
  ),
);
