function readAdminUsers() {
  const usersJson = import.meta.env.VITE_ADMIN_USERS_JSON
  const singleUsername = import.meta.env.VITE_ADMIN_USERNAME
  const singlePasswordHash = import.meta.env.VITE_ADMIN_PASSWORD_HASH

  if (usersJson) {
    try {
      const users = JSON.parse(usersJson)
      if (Array.isArray(users)) {
        return users
          .map((user) => ({
            username: String(user.username ?? '').trim().toLowerCase(),
            name: String(user.name ?? user.username ?? '').trim(),
            passwordHash: String(user.passwordHash ?? '').trim().toLowerCase(),
          }))
          .filter((user) => user.username && user.passwordHash)
      }
    } catch {
      return []
    }
  }

  if (singleUsername && singlePasswordHash) {
    return [
      {
        username: singleUsername.trim().toLowerCase(),
        name: singleUsername.trim(),
        passwordHash: singlePasswordHash.trim().toLowerCase(),
      },
    ]
  }

  return []
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function hasConfiguredAdmins() {
  return readAdminUsers().length > 0
}

export async function verifyAdminCredentials({ username, password }) {
  const normalizedUsername = username.trim().toLowerCase()
  const users = readAdminUsers()
  const adminUser = users.find((user) => user.username === normalizedUsername)

  if (!users.length) {
    return {
      ok: false,
      message: 'Admin login is not configured yet.',
    }
  }

  if (!adminUser) {
    return {
      ok: false,
      message: 'Admin username or password is incorrect.',
    }
  }

  const passwordHash = await sha256Hex(password)

  if (passwordHash !== adminUser.passwordHash) {
    return {
      ok: false,
      message: 'Admin username or password is incorrect.',
    }
  }

  return {
    ok: true,
    user: adminUser,
    message: `Admin signed in as ${adminUser.name || adminUser.username}.`,
  }
}
