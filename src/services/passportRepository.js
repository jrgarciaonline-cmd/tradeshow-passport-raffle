import { defaultBooths } from '../data/mockData'

const STORAGE_KEY = 'tradeshow-passport-raffle-v2'

const initialState = {
  booths: defaultBooths,
  completedIds: [],
  entries: [],
  settings: {
    requiredScanCount: 4,
    instructions: [
      'The Passport Raffle is one challenge: visit each participating manufacturer booth.',
      'At each booth, scan the passport QR code or enter the code manually if the camera is not available.',
      'Each manufacturer booth you visit is marked complete on your passport.',
      'Scan the required number of unique manufacturer booths to unlock the raffle entry form.',
    ],
  },
}

function readState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? { ...initialState, ...JSON.parse(stored) } : initialState
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
