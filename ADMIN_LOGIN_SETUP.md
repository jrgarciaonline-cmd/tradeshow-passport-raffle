# Admin Login Setup

Admin accounts are configured with Vercel environment variables.

## 1. Hash each admin password

Run this locally:

```bash
node scripts/hash-admin-password.mjs "your-admin-password"
```

Copy the hash that prints in the terminal.

## 2. Add admins in Vercel

Create this environment variable:

```text
VITE_ADMIN_USERS_JSON
```

Use this JSON format:

```json
[
  {
    "username": "jr",
    "name": "JR Garcia",
    "passwordHash": "paste_hash_here"
  },
  {
    "username": "boss",
    "name": "Boss Name",
    "passwordHash": "paste_second_hash_here"
  }
]
```

Redeploy after saving the environment variable.

## Note

This removes the demo login from the app bundle. For a production system with
real data, the next security step should be Supabase Auth with locked row-level
security policies.
