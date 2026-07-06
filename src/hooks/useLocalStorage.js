import { useCallback, useSyncExternalStore } from 'react'

// Module-level cache + subscriber registry so every hook instance on the same
// key (and non-hook code via readStoredValue/updateStoredValue) stays in sync.
// Ported unchanged from De-TMUA-guide — the pub/sub contract is exam-agnostic;
// only the storage keys passed in carry the esat_* prefix.
const cache = new Map()
const listeners = new Map()
const globalListeners = new Set()

// Fires on every write with the key that changed — used by cloud sync (Phase 7).
export function subscribeAllKeys(callback) {
  globalListeners.add(callback)
  return () => globalListeners.delete(callback)
}

function readKey(key, initialValue) {
  if (cache.has(key)) {
    const cached = cache.get(key)
    if (cached !== null && cached !== undefined) return cached
    // null/undefined in cache means a bad write slipped through — fall through
    // to re-read from localStorage so the initialValue default can apply
  }
  let value = initialValue
  try {
    const item = localStorage.getItem(key)
    if (item !== null) {
      const parsed = JSON.parse(item)
      if (parsed !== null) value = parsed
    }
  } catch {
    value = initialValue
  }
  cache.set(key, value)
  return value
}

function writeKey(key, value) {
  cache.set(key, value)
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('useLocalStorage write error:', error)
  }
  const subs = listeners.get(key)
  if (subs) subs.forEach(fn => fn())
  globalListeners.forEach(fn => fn(key))
}

function subscribeKey(key, callback) {
  let subs = listeners.get(key)
  if (!subs) {
    subs = new Set()
    listeners.set(key, subs)
  }
  subs.add(callback)
  return () => subs.delete(callback)
}

// Read the current value outside React (always consistent with hook state).
export function readStoredValue(key, initialValue) {
  return readKey(key, initialValue)
}

// Update a key outside React; every mounted hook on that key re-renders.
export function updateStoredValue(key, updater, initialValue) {
  const next = updater(readKey(key, initialValue))
  writeKey(key, next)
  return next
}

export function useLocalStorage(key, initialValue) {
  const subscribe = useCallback(cb => subscribeKey(key, cb), [key])
  // cache makes the snapshot referentially stable between writes
  const getSnapshot = useCallback(() => readKey(key, initialValue), [key, initialValue])
  const value = useSyncExternalStore(subscribe, getSnapshot)

  const setItem = useCallback((newValue) => {
    const current = readKey(key)
    writeKey(key, newValue instanceof Function ? newValue(current) : newValue)
  }, [key])

  return [value, setItem]
}
