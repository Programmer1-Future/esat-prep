import { supabase } from './supabase'
import { readStoredValue, updateStoredValue, subscribeAllKeys } from '../hooks/useLocalStorage'

// Everything that defines the student's learning record. The whole set syncs
// as one document per user (esat_user_state.data, protected by RLS so a user
// can only ever read/write their own row). Ported from TMUA's cloudSync.
// esat_theme is deliberately excluded — it's a device-level preference, not
// part of the portable learning record.
export const SYNC_KEYS = [
  'esat_events',
  'esat_modules',
  'esat_exam_date',
  'esat_habits',
  'esat_topic_stats',
  'esat_review_queue',
  'esat_achievements',
  'esat_mock_sittings',
]

const PUSH_DEBOUNCE_MS = 2000

let pushTimer = null
let unsubscribe = null
let applyingRemote = false

function snapshotLocal() {
  const data = {}
  for (const key of SYNC_KEYS) {
    const value = readStoredValue(key, null)
    if (value !== null) data[key] = value
  }
  return data
}

export async function pushState(user) {
  const { error } = await supabase
    .from('esat_user_state')
    .upsert({
      user_id: user.id,
      email: user.email,
      data: snapshotLocal(),
      updated_at: new Date().toISOString(),
    })
  return error
}

function schedulePush(user, onError) {
  clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    const error = await pushState(user)
    if (error && onError) onError(error)
  }, PUSH_DEBOUNCE_MS)
}

// Pull the cloud document. Cloud wins on login; an empty cloud doc means this
// is the first device, so local state is claimed into the row instead.
// Unlike TMUA there is no invite allowlist: every authenticated user owns their
// row, so an RLS rejection here is a real error, not an expected "not invited".
export async function pullState(user) {
  const { data, error } = await supabase
    .from('esat_user_state')
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return { ok: false, error }

  if (data && data.data && Object.keys(data.data).length > 0) {
    applyingRemote = true
    try {
      for (const [key, value] of Object.entries(data.data)) {
        if (SYNC_KEYS.includes(key) && value !== null) updateStoredValue(key, () => value, null)
      }
    } finally {
      applyingRemote = false
    }
    return { ok: true }
  }

  // No row yet — claim it with whatever is already in local storage.
  const pushError = await pushState(user)
  if (pushError) return { ok: false, error: pushError }
  return { ok: true }
}

// Begin live sync: every local change to a synced key schedules a debounced push.
export function startSync(user, onError) {
  stopSync()
  unsubscribe = subscribeAllKeys(key => {
    if (applyingRemote) return
    if (SYNC_KEYS.includes(key)) schedulePush(user, onError)
  })
}

export function stopSync() {
  clearTimeout(pushTimer)
  pushTimer = null
  if (unsubscribe) { unsubscribe(); unsubscribe = null }
}
