import { defaultBooths, defaultInstructions } from '../data/mockData'

const STORAGE_KEY = 'tradeshow-passport-raffle-v2'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const SUPABASE_TABLE = 'passport_state'
const SHARED_ROW_ID = 'shared'

const initialState = {
  booths: defaultBooths,
  completedIds: [],
  entries: [],
  attendees: [],
  session: null,
  adminAuthenticated: false,
  settings: {
    requiredScanCount: 4,
    instructions: defaultInstructions,
  },
}

function readState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialState

    const parsed = JSON.parse(stored)
    return {
      ...initialState,
      ...parsed,
      settings: {
        ...initialState.settings,
        ...parsed.settings,
        instructions: parsed.settings?.instructions?.length
          ? parsed.settings.instructions
          : initialState.settings.instructions,
      },
    }
  } catch {
    return initialState
  }
}

function writeState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

function getSharedState(state) {
  return {
    booths: state.booths,
    entries: state.entries,
    attendees: state.attendees,
    settings: state.settings,
  }
}

function mergeSharedState(state, sharedState) {
  if (!sharedState) return state

  return {
    ...state,
    booths: sharedState.booths?.length ? sharedState.booths : state.booths,
    entries: Array.isArray(sharedState.entries) ? sharedState.entries : state.entries,
    attendees: Array.isArray(sharedState.attendees)
      ? sharedState.attendees
      : state.attendees,
    settings: {
      ...state.settings,
      ...sharedState.settings,
      instructions: sharedState.settings?.instructions?.length
        ? sharedState.settings.instructions
        : state.settings.instructions,
    },
  }
}

async function requestSupabase(path, options = {}) {
  if (!isSupabaseConfigured()) return null

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Supabase request failed: ${response.status} ${detail}`)
  }

  if (response.status === 204) return null
  return response.json()
}

export const passportRepository = {
  load() {
    return readState()
  },
  save(state) {
    writeState(state)
  },
  mergeShared(state, sharedState) {
    return mergeSharedState(state, sharedState)
  },
  async loadShared() {
    try {
      const rows = await requestSupabase(
        `${SUPABASE_TABLE}?id=eq.${SHARED_ROW_ID}&select=data&limit=1`,
      )
      return rows?.[0]?.data ?? null
    } catch (error) {
      console.warn(error)
      return null
    }
  },
  async saveShared(state) {
    try {
      await requestSupabase(`${SUPABASE_TABLE}?on_conflict=id`, {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          id: SHARED_ROW_ID,
          data: getSharedState(state),
          updated_at: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.warn(error)
    }
  },
  isRemoteEnabled() {
    return isSupabaseConfigured()
  },
  reset() {
    writeState(initialState)
    return initialState
  },
}
