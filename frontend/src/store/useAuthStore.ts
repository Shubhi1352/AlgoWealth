/**
 * useAuthStore
 *
 * Global auth state via Zustand.
 * Persists JWT token to localStorage so sessions survive refresh.
 *
 * Design pattern: "Slice" pattern — all auth state in one store.
 * Why Zustand over Context: no re-render on every state change,
 * no Provider wrapping needed, works outside React tree.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ── Types ─────────────────────────────────────────────────────────────────────
interface User {
  id: string
  email: string
  virtual_balance: number
  created_at: string
}

interface AuthState {
  token:   string | null
  user:    User   | null
  isReady: boolean          // true after hydration from localStorage

  // Actions
  setAuth:  (token: string, user: User) => void
  setUser:  (user: User) => void
  logout:   () => void
  setReady: () => void
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:   null,
      user:    null,
      isReady: false,

      setAuth: (token, user) => set({ token, user }),

      setUser: (user) => set({ user }),

      logout: () => set({ token: null, user: null }),

      // Called after Zustand has rehydrated from localStorage
      setReady: () => set({ isReady: true }),
    }),
    {
      name:    'algowealth-auth',     // localStorage key
      partialize: (state) => ({       // only persist token + user, not isReady
        token: state.token,
        user:  state.user,
      }),
      onRehydrateStorage: () => (state) => {
        // Mark store as ready after hydration so components know
        // the localStorage state has been loaded
        state?.setReady()
      },
    }
  )
)

// ── Selector hooks (convenience) ──────────────────────────────────────────────
export const useToken    = () => useAuthStore((s) => s.token)
export const useUser     = () => useAuthStore((s) => s.user)
export const useIsAuthed = () => useAuthStore((s) => Boolean(s.token))
export const useIsReady  = () => useAuthStore((s) => s.isReady)