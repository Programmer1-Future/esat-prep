import { createContext, useContext } from 'react'

// Populated by AuthGate once auth + role are resolved. role is one of
// 'admin' | 'contributor' | 'user' (or null before it resolves).
export const SessionContext = createContext({ user: null, role: null })

export function useSession() {
  return useContext(SessionContext)
}

export const canManageContent = (role) => role === 'admin' || role === 'contributor'
export const canManageUsers = (role) => role === 'admin'
