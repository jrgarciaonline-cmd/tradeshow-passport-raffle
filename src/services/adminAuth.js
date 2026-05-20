const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

async function requestSupabaseAuth(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Supabase Auth request failed: ${response.status}`)
  }

  return response.json()
}

async function requestSupabaseRest(path, accessToken, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.')
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `Supabase request failed: ${response.status}`)
  }

  if (response.status === 204) return null
  return response.json()
}

export async function signInAdminWithSupabase({ username, password }) {
  const email = username.trim().toLowerCase()

  if (!email || !password) {
    return { ok: false, message: 'Enter admin email and password.' }
  }

  try {
    const authResult = await requestSupabaseAuth('token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const accessToken = authResult.access_token
    const adminRows = await requestSupabaseRest(
      `admin_users?email=eq.${encodeURIComponent(email)}&select=email,name,role`,
      accessToken,
    )
    const adminUser = adminRows?.[0]

    if (!adminUser) {
      return {
        ok: false,
        message: 'This Supabase user is not authorized as an admin.',
      }
    }

    return {
      ok: true,
      user: {
        email: adminUser.email,
        name: adminUser.name || adminUser.email,
        role: adminUser.role || 'admin',
      },
      session: {
        accessToken,
        refreshToken: authResult.refresh_token,
        expiresAt: Date.now() + Number(authResult.expires_in || 3600) * 1000,
      },
      message: `Admin signed in as ${adminUser.name || adminUser.email}.`,
    }
  } catch (error) {
    console.warn(error)
    return {
      ok: false,
      message: 'Admin email or password is incorrect, or the user is not authorized.',
    }
  }
}

export async function refreshSupabaseSession(refreshToken) {
  if (!refreshToken) {
    throw new Error('Missing refresh token.')
  }

  const authResult = await requestSupabaseAuth('token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  return {
    accessToken: authResult.access_token,
    refreshToken: authResult.refresh_token || refreshToken,
    expiresAt: Date.now() + Number(authResult.expires_in || 3600) * 1000,
  }
}

export async function listSupabaseAdmins(accessToken) {
  return requestSupabaseRest(
    'admin_users?select=email,name,role,created_at&order=created_at.desc',
    accessToken,
  )
}

export async function inviteSupabaseAdmin(accessToken, adminUser) {
  const email = String(adminUser.email ?? '').trim().toLowerCase()
  const name = String(adminUser.name ?? '').trim()
  const role = adminUser.role === 'super_admin' ? 'super_admin' : 'admin'

  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Enter a valid admin email.' }
  }

  const response = await fetch('/api/invite-admin', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, name, role }),
  })
  const result = await response.json().catch(() => ({
    ok: false,
    message: 'Unable to invite admin.',
  }))

  if (!response.ok || !result.ok) {
    return {
      ok: false,
      message: result.message || 'Unable to invite admin.',
    }
  }

  return result
}

export async function addSupabaseAdmin(accessToken, adminUser) {
  const email = String(adminUser.email ?? '').trim().toLowerCase()
  const name = String(adminUser.name ?? '').trim()
  const role = adminUser.role === 'super_admin' ? 'super_admin' : 'admin'

  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Enter a valid admin email.' }
  }

  try {
    await requestSupabaseRest('admin_users?on_conflict=email', accessToken, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ email, name, role }),
    })
    return { ok: true, message: `${email} is authorized as ${role}.` }
  } catch (error) {
    console.warn(error)
    return {
      ok: false,
      message: 'Unable to add admin. Only a super admin can manage admins.',
    }
  }
}

export async function removeSupabaseAdmin(accessToken, email) {
  try {
    await requestSupabaseRest(
      `admin_users?email=eq.${encodeURIComponent(email)}`,
      accessToken,
      { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
    )
    return { ok: true, message: `${email} was removed from admin access.` }
  } catch (error) {
    console.warn(error)
    return {
      ok: false,
      message: 'Unable to remove admin. Only a super admin can manage admins.',
    }
  }
}
