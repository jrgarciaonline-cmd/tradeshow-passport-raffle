import { useEffect, useRef, useState } from 'react'
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

function getAdminAttendee() {
  return {
    id: 'admin-user',
    name: 'Land F/X Admin',
    email: 'admin@landfx.local',
    phone: '0000000000',
    role: 'Admin',
    createdAt: new Date().toISOString(),
  }
}

function normalizeEntryChances(value) {
  return Math.max(1, Math.min(99, Number(value) || 1))
}

export function usePassportStore() {
  const [state, setState] = useState(() => passportRepository.load())
  const sharedSavePending = useRef(false)
  const preserveLocalUntil = useRef({})

  const updateState = (updater, options = {}) => {
    setState((current) => {
      const next = updater(current)
      passportRepository.save(next)
      if (options.sharedPatch) {
        const patch =
          typeof options.sharedPatch === 'function'
            ? options.sharedPatch(next, current)
            : options.sharedPatch
        if (!patch) return next
        sharedSavePending.current = true
        passportRepository.saveSharedPatch(patch).finally(() => {
          sharedSavePending.current = false
        })
      }
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
        if (sharedSavePending.current) return current

        if (!sharedState) return current

        const now = Date.now()
        const next = passportRepository.mergeShared(current, sharedState, {
          preserveLocalSections: {
            booths: (preserveLocalUntil.current.booths ?? 0) > now,
            settings: (preserveLocalUntil.current.settings ?? 0) > now,
          },
        })
        passportRepository.save(next)
        return next
      })
    }

    syncSharedState()
    const intervalId = window.setInterval(syncSharedState, 5000)
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncSharedState()
    }

    window.addEventListener('focus', syncSharedState)
    window.addEventListener('online', syncSharedState)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', syncSharedState)
      window.removeEventListener('online', syncSharedState)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [])

  const requiredScanCount = state.settings?.requiredScanCount ?? 4
  const passportComplete = state.completedIds.length >= requiredScanCount
  const currentAttendee =
    state.session?.type === 'attendee'
      ? state.attendees.find((attendee) => attendee.id === state.session.attendeeId)
      : null
  const currentAttendeeEntry = currentAttendee
    ? state.entries.find((entry) => entry.attendeeId === currentAttendee.id)
    : null
  const currentLocationBoothId =
    currentAttendee && state.attendeeLocation
      ? state.attendeeLocation[currentAttendee.id]
      : ''

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
      completedIds: current.attendeeProgress[attendee.id] ?? [],
    }), { sharedPatch: { attendees: [attendee] } })

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
      completedIds: current.attendeeProgress[attendee.id] ?? [],
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

    updateState((current) => {
      const attendeeId = current.session?.attendeeId ?? 'admin-user'

      return {
        ...current,
        attendees: current.attendees.some((attendee) => attendee.id === 'admin-user')
          ? current.attendees
          : [...current.attendees, getAdminAttendee()],
        session: current.session ?? { type: 'attendee', attendeeId },
        completedIds: current.attendeeProgress[attendeeId] ?? current.completedIds,
        adminAuthenticated: true,
      }
    })

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
    updateState((current) => {
      const completedIds = current.completedIds.includes(boothId)
        ? current.completedIds
        : [...current.completedIds, boothId]
      const attendeeId = current.session?.attendeeId

      return {
        ...current,
        completedIds,
        attendeeLocation:
          current.session?.type === 'attendee'
            ? {
                ...current.attendeeLocation,
                [attendeeId]: boothId,
              }
            : current.attendeeLocation,
        attendeeProgress:
          current.session?.type === 'attendee'
            ? {
                ...current.attendeeProgress,
                [attendeeId]: completedIds,
              }
            : current.attendeeProgress,
      }
    }, {
      sharedPatch: (next) =>
        next.session?.type === 'attendee'
          ? {
              attendeeProgress: {
                [next.session.attendeeId]: next.completedIds,
              },
              attendeeLocation: {
                [next.session.attendeeId]: boothId,
              },
            }
          : null,
    })
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
    updateState((current) => {
      const completedIds = current.completedIds.filter((id) => id !== boothId)
      const attendeeId = current.session?.attendeeId

      return {
        ...current,
        completedIds,
        attendeeProgress:
          current.session?.type === 'attendee'
            ? {
                ...current.attendeeProgress,
                [attendeeId]: completedIds,
              }
            : current.attendeeProgress,
      }
    }, {
      sharedPatch: (next) =>
        next.session?.type === 'attendee'
          ? {
              attendeeProgress: {
                [next.session.attendeeId]: next.completedIds,
              },
            }
          : null,
    })
  }

  const submitEntry = () => {
    if (!currentAttendee) {
      return { ok: false, message: 'No signed-in attendee found.' }
    }

    if (currentAttendeeEntry) {
      return { ok: false, message: 'This attendee is already entered.' }
    }

    updateState((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          attendeeId: currentAttendee.id,
          name: currentAttendee.name,
          email: currentAttendee.email,
          phone: currentAttendee.phone,
          role: currentAttendee.role,
          chances: 1,
          id: crypto.randomUUID(),
          submittedAt: new Date().toISOString(),
        },
      ],
    }), {
      sharedPatch: (next) => ({
        entries: [next.entries.at(-1)],
      }),
    })
    return { ok: true, message: 'Raffle entry received.' }
  }

  const addRaffleEntry = (profile) => {
    const attendee = profile.attendeeId
      ? state.attendees.find((item) => item.id === profile.attendeeId)
      : null
    const email = normalizeEmail(attendee?.email ?? profile.email ?? '')
    const name = (attendee?.name ?? profile.name ?? '').trim()
    const phone = (attendee?.phone ?? profile.phone ?? '').trim()
    const role = (attendee?.role ?? profile.role ?? 'Manual Entry').trim()
    const chances = normalizeEntryChances(profile.chances)

    if (!name || !email || !phone || !role) {
      return { ok: false, message: 'Please complete name, email, phone, and role.' }
    }

    const existingEntry = state.entries.find(
      (entry) =>
        (attendee?.id && entry.attendeeId === attendee.id) ||
        entry.email === email,
    )

    if (existingEntry) {
      updateEntryChances(existingEntry.id, chances)
      return { ok: true, message: `${existingEntry.name} already existed. Chances updated.` }
    }

    updateState((current) => ({
      ...current,
      entries: [
        ...current.entries,
        {
          attendeeId: attendee?.id ?? '',
          name,
          email,
          phone,
          role,
          chances,
          id: crypto.randomUUID(),
          submittedAt: new Date().toISOString(),
          manual: !attendee,
        },
      ],
    }), {
      sharedPatch: (next) => ({
        entries: [next.entries.at(-1)],
      }),
    })

    return { ok: true, message: `${name} added to the raffle.` }
  }

  const updateEntryChances = (entryId, chances) => {
    updateState((current) => ({
      ...current,
      entries: current.entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, chances: normalizeEntryChances(chances) }
          : entry,
      ),
    }), {
      sharedPatch: (next) => ({
        entries: next.entries,
      }),
    })
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
    }, {
      sharedPatch: (next) => ({
        booths: next.booths,
      }),
    })
    preserveLocalUntil.current.booths = Date.now() + 15000
  }

  const deleteBooth = (boothId) => {
    updateState((current) => ({
      ...current,
      booths: current.booths.filter((booth) => booth.id !== boothId),
      completedIds: current.completedIds.filter((id) => id !== boothId),
    }), {
      sharedPatch: (next) => ({
        booths: next.booths,
      }),
    })
    preserveLocalUntil.current.booths = Date.now() + 15000
  }

  const placeBoothOnMap = (boothId, map) => {
    updateState((current) => ({
      ...current,
      booths: current.booths.map((booth) =>
        booth.id === boothId ? { ...booth, map } : booth,
      ),
    }), {
      sharedPatch: (next) => ({
        booths: next.booths,
      }),
    })
    preserveLocalUntil.current.booths = Date.now() + 15000
  }

  const saveSettings = (settings) => {
    updateState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        ...settings,
        requiredScanCount: Math.max(1, Number(settings.requiredScanCount) || 1),
      },
    }), {
      sharedPatch: (next) => ({
        settings: next.settings,
      }),
    })
    preserveLocalUntil.current.settings = Date.now() + 15000
  }

  const exportEntriesCsv = () => {
    const header = ['Name', 'Email', 'Phone', 'Role', 'Wheel Chances', 'Submitted At']
    const body = state.entries.map((entry) =>
      [
        entry.name,
        entry.email,
        entry.phone,
        entry.role,
        entry.chances ?? 1,
        entry.submittedAt,
      ]
        .map(toCsvValue)
        .join(','),
    )

    downloadCsv('raffle-entries.csv', [header.join(','), ...body].join('\n'))
  }

  const exportAttendeesCsv = () => {
    const header = ['Name', 'Email', 'Phone', 'Role', 'Scans Completed', 'Signed Up At']
    const body = state.attendees.map((attendee) =>
      [
        attendee.name,
        attendee.email,
        attendee.phone,
        attendee.role,
        state.attendeeProgress[attendee.id]?.length ?? 0,
        attendee.createdAt,
      ]
        .map(toCsvValue)
        .join(','),
    )

    downloadCsv('app-signups.csv', [header.join(','), ...body].join('\n'))
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
    currentAttendeeEntry,
    currentLocationBoothId,
    registerAttendee,
    signInAttendee,
    signInAdmin,
    signOut,
    signOutAdmin,
    checkInBooth,
    checkInByCode,
    undoCheckIn,
    submitEntry,
    addRaffleEntry,
    updateEntryChances,
    saveBooth,
    deleteBooth,
    placeBoothOnMap,
    saveSettings,
    exportEntriesCsv,
    exportAttendeesCsv,
    resetDemo,
  }
}
