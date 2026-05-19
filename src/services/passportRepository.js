import { defaultBooths, defaultInstructions } from '../data/mockData'

const STORAGE_KEY = 'tradeshow-passport-raffle-v2'

const initialState = {
  booths: defaultBooths,
  completedIds: [],
  entries: [],
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

export const passportRepository = {
  load() {
    return readState()
  },
  save(state) {
    writeState(state)
  },
  reset() {
    writeState(initialState)
    return initialState
  },
}
