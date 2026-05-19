import { useEffect, useState } from 'react'
import { adminCredentials, defaultBooths } from '../data/mockData'
import { passportRepository } from './passportRepository'

function buildBoothId(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function downloadCsv(filename, rows) {
  const blob = new Blob([rows], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function toCsvValue(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
}

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export function usePassportStore() {
  const [state, setState] = useState(() => passportRepository.load())

  const updateState = (updater) => {
    setState((current) => {
      const next = updater(current)
      passportRepository.save(next)
      passportRepository.saveShared(next)
      return next
    })
  }

  useEffect(() => {
    if (!passportRepository.isRemoteEnabled()) return undefined

    let cancelled = false

    const syncSharedState = async () => {
      const sharedState = await passportRepository.loadShared()

      setState((current) => {
        if (cancelled) return current

        if (!sharedState) {
          passportRepository.saveShared(current)
          return current
        }

        const next = passportRepository.mergeShared(current, sharedState)
        passportRepository.save(next)
        return next
      })
    }

    syncSharedState()
    const intervalId = window.setInterval(syncSharedState, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [])

  const requiredScanCount = state.settings?.requiredScanCount ?? 4
  const passportComplete = state.completedIds.length >= requiredScanCount
  const currentAttendee =
    state.session?.type === 'attendee'
      ? state.attendees.find((attendee) => attendee.id === state.session.attendeeId)
      : null

  const registerAttendee = (profile) => {
    const email = normalizeEmail(profile.email)
    const role =
      profile.role === 'Other' ? profile.otherRole.trim() : profile.role.trim()

    if (!profile.name.trim() || !email || !profile.phone.trim() || !role) {
      return { ok: false, message: 'Please complete every required field.' }
    }

    const attendee = {
      id: crypto.randomUUID(),
      name: profile.name.trim(),
      email,
      phone: profile.phone.trim(),
      role,
      createdAt: new Date().toISOString(),
    }

    updateState((current) => ({
      ...current,
      attendees: [
        ...current.attendees.filter((item) => item.email !== email),
        attendee,
      ],
      session: { type: 'attendee', attendeeId: attendee.id },
    }))

    return { ok: true, message: `Welcome, ${attendee.name}.` }
  }

  const signInAttendee = ({ email, phone }) => {
    const normalizedEmail = normalizeEmail(email)
    const attendee = state.attendees.find(
      (item) =>
        item.email === normalizedEmail &&
        item.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''),
    )

    if (!attendee) {
      return {
        ok: false,
        message: 'No attendee found with that email and phone number.',
      }
    }

    updateState((current) => ({
      ...current,
      session: { type: 'attendee', attendeeId: attendee.id },
    }))

    return { ok: true, message: `Welcome back, ${attendee.name}.` }
  }

  const signInAdmin = ({ username, password }) => {
    const usernameMatches =
      username.trim().toLowerCase() === adminCredentials.username.toLowerCase()
    const passwordMatches = password === adminCredentials.password

    if (!usernameMatches || !passwordMatches) {
      return { ok: false, message: 'Admin username or password is incorrect.' }
    }

    updateState((current) => ({
      ...current,
      adminAuthenticated: true,
    }))

    return { ok: true, message: 'Admin signed in.' }
  }

  const signOut = () => {
    updateState((current) => ({
      ...current,
      session: null,
      adminAuthenticated: false,
    }))
  }

  const signOutAdmin = () => {
    updateState((current) => ({ ...current, adminAuthenticated: false }))
  }

  const checkInBooth = (boothId) => {
    updateState((current) => ({
      ...current,
      completedIds: current.completedIds.includes(boothId)
        ? current.completedIds
        : [...current.completedIds, boothId],
    }))
  }

  const checkInByCode = (code) => {
    const match = state.booths.find(
      (booth) => booth.qrCode.toLowerCase() === code.trim().toLowerCase(),
    )

    if (!match) {
      return { ok: false, message: 'No booth matches that QR code.' }
    }

    checkInBooth(match.id)
    return {
      ok: true,
      message: `${match.name} checked in.`,
      id: match.id,
    }
  }

  const undoCheckIn = (boothId) => {
    updateState((current) => ({
      ...current,
      completedIds: current.completedIds.filter((id) => id !== boothId),
    }))
  }

  const submitEntry = (entry) => {
    updateState((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          ...entry,
          id: crypto.randomUUID(),
          submittedAt: new Date().toISOString(),
        },
      ],
    }))
  }

  const saveBooth = (booth) => {
    updateState((current) => {
      const id = booth.id || buildBoothId(booth.name) || crypto.randomUUID()
      const nextBooth = {
        ...booth,
        id,
        map: booth.map || { x: 50, y: 50 },
        color: booth.color || '#007b70',
        logoDataUrl: booth.logoDataUrl || '',
      }
      const exists = current.booths.some((item) => item.id === id)

      return {
        ...current,
        booths: exists
          ? current.booths.map((item) => (item.id === id ? nextBooth : item))
          : [...current.booths, nextBooth],
      }
    })
  }

  const deleteBooth = (boothId) => {
    updateState((current) => ({
      ...current,
      booths: current.booths.filter((booth) => booth.id !== boothId),
      completedIds: current.completedIds.filter((id) => id !== boothId),
    }))
  }

  const placeBoothOnMap = (boothId, map) => {
    updateState((current) => ({
      ...current,
      booths: current.booths.map((booth) =>
        booth.id === boothId ? { ...booth, map } : booth,
      ),
    }))
  }

  const saveSettings = (settings) => {
    updateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...settings,
        requiredScanCount: Math.max(1, Number(settings.requiredScanCount) || 1),
      },
    }))
  }

  const exportEntriesCsv = () => {
    const header = ['Name', 'Email', 'Phone', 'Company', 'Submitted At']
    const body = state.entries.map((entry) =>
      [entry.name, entry.email, entry.phone, entry.company, entry.submittedAt]
        .map(toCsvValue)
        .join(','),
    )

    downloadCsv('raffle-entries.csv', [header.join(','), ...body].join('\n'))
  }

  const resetDemo = () => {
    const resetState = passportRepository.reset()
    const nextState = {
      ...resetState,
      booths: defaultBooths,
    }
    setState(nextState)
    passportRepository.saveShared(nextState)
  }

  return {
    ...state,
    requiredScanCount,
    passportComplete,
    currentAttendee,
    registerAttendee,
    signInAttendee,
    signInAdmin,
    signOut,
    signOutAdmin,
    checkInBooth,
    checkInByCode,
    undoCheckIn,
    submitEntry,
    saveBooth,
    deleteBooth,
    placeBoothOnMap,
    saveSettings,
    exportEntriesCsv,
    resetDemo,
  }
}
