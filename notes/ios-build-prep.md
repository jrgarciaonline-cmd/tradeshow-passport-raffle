# iOS build prep — Land F/X Passport

## One-time setup

### 1. Apple accounts
- [ ] **Apple Developer Program** enrolled ($99/yr)
- [ ] **App Store Connect** app created with bundle ID `com.landfx.passport`
- [ ] Your Apple ID added under App Store Connect → **Users and Access**

### 2. Local env (native builds bake these in at compile time)
```bash
cp .env.example .env.production   # if you haven't already
# Fill in at minimum:
#   VITE_SUPABASE_URL
#   VITE_SUPABASE_ANON_KEY
#   (any other VITE_* your app needs)
```

### 3. Xcode
- [ ] **Xcode 26** installed (required for App Store submissions)
- [ ] Open Xcode once and accept license / install components
- [ ] Signing: open project → **App** target → **Signing & Capabilities** → Team `95Y3H25Z96`, **Automatically manage signing** on

### 4. App naming (already set in repo)
- **Display name** (home screen): `Land F/X Passport Raffle` via `CFBundleDisplayName`
- **Product name** (`.app` bundle / IPA): `Land F-X Passport` — **no `/` in `PRODUCT_NAME`** (slashes break archive export)
- **Bundle ID**: `com.landfx.passport`

### 5. Infra
- [ ] CORS fix for Capacitor origins deployed to Vercel (native app hits production API)

---

## Every build (repeatable workflow)

### Step 0 — Pre-flight (2 min)

```bash
# Confirm toolchain
xcodebuild -version          # should show Xcode 26.x

# Confirm usbmuxd is running (NOT paused)
ps aux | grep usbmuxd | grep -v grep
# Should show state "Ss" — if you ever ran killall -STOP usbmuxd:
#   sudo killall -CONT usbmuxd

# Close Xcode GUI — don't run GUI + CLI xcodebuild at the same time
pgrep Xcode || echo "Xcode closed ✓"
```

### Step 1 — Bump build number

**Required before every TestFlight upload.** Apple rejects duplicate build numbers.

In Xcode (`npm run open:ios`) → **App** target → **General** → **Identity**:
- **Version** (`MARKETING_VERSION`): `1.0` — only change for user-facing releases (`1.1`, etc.)
- **Build** (`CURRENT_PROJECT_VERSION`): increment `2` → `3` → `4` …

Or edit both Debug + Release in `ios/App/App.xcodeproj/project.pbxproj`:
```
CURRENT_PROJECT_VERSION = 3;
MARKETING_VERSION = 1.0;
```

### Step 2 — Build web + sync to iOS

If you changed `public/appstore.png`, regenerate native icons first:

```bash
npm run assets:generate
```

```bash
cd /Users/forrestt/Sites/tradeshow-passport-raffle
npm run build:mobile
```

Should finish in **< 1 second** after Vite build. If it errors, fix `.env.production` first.

### Step 3 — Archive

**Prefer Xcode GUI** on Xcode 26.6+ (CLI `xcodebuild archive` can deadlock at `ExecuteExternalTool clang` — see Troubleshooting).

After `npm run open:ios`: **Product → Archive** → **Distribute App → App Store Connect → Upload**.

<details>
<summary>CLI archive (optional — may hang on Xcode 26.6)</summary>

```bash
xcodebuild -project ios/App/App.xcodeproj \
  -scheme "Land F-X Passport" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/LandFXPassport.xcarchive \
  archive > /tmp/xcode-archive.log 2>&1
```

**Terminal will go silent** — that's normal (output goes to the log). If the log stops at `ExecuteExternalTool … clang` for more than ~2 min, Ctrl+C and use GUI Archive instead.

</details>

### Step 4 — Watch progress (Terminal 2)

```bash
tail -f /tmp/xcode-archive.log
```

Wait for `** ARCHIVE SUCCEEDED **` (usually **1–3 min**; allow up to **10 min** on a cold cache).

| Log line | Meaning |
|----------|---------|
| `ExecuteExternalTool ... clang` | Normal — probing toolchain |
| `CompileSwift` / `Ld` | Actually building |
| `** ARCHIVE SUCCEEDED **` | Done |
| `** ARCHIVE FAILED **` | Check log for signing/errors |
| Same line, no change for **15+ min** | Hung — Ctrl+C, close Xcode, retry |

**Do not** pipe through `| tee` — it can deadlock on Xcode 26.

### Step 5 — Upload to TestFlight

**Option A — Xcode Organizer (easiest for signing)**

```bash
open /tmp/LandFXPassport.xcarchive
```

→ **Distribute App** → **App Store Connect** → **Upload**

**Option B — CLI export + Transporter**

```bash
xcodebuild -exportArchive \
  -archivePath /tmp/LandFXPassport.xcarchive \
  -exportPath /tmp/LandFXPassport-export \
  -exportOptionsPlist ios/ExportOptions.plist
```

Upload the `.ipa` from `/tmp/LandFXPassport-export/` via **Transporter** app.

### Step 6 — TestFlight

1. App Store Connect → **TestFlight** → wait for build processing (~5–30 min)
2. If build shows **Missing Compliance** (current uploads only — see below):
   - Click the build → **Manage** (or **Provide Export Compliance Information**)
   - **Does your app use encryption?** → **Yes** (HTTPS counts)
   - **Is it exempt?** / **non-exempt encryption** → **No** (standard HTTPS/TLS only — no custom crypto)
   - Build becomes available for testing within a few minutes
3. **Internal Testing** → add testers → install via **TestFlight** app on iPhone

Future builds include `ITSAppUsesNonExemptEncryption = false` in `Info.plist`, so Apple should skip the manual step after you upload a new build.

---

## Quick copy-paste (full run)

```bash
# Terminal 1
cd /Users/forrestt/Sites/tradeshow-passport-raffle
npm run build:mobile && xcodebuild -project ios/App/App.xcodeproj \
  -scheme "Land F-X Passport" -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/LandFXPassport.xcarchive \
  archive > /tmp/xcode-archive.log 2>&1

# Terminal 2 (run while archive is going)
tail -f /tmp/xcode-archive.log

# After ARCHIVE SUCCEEDED
open /tmp/LandFXPassport.xcarchive
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Terminal silent after `cap sync` | Normal — watch `/tmp/xcode-archive.log` |
| Hangs at `ExecuteExternalTool … clang -v` | **Xcode 26 `SWBBuildService` pipe deadlock** — not a slow compile. See below |
| Hangs at `clang -v` for hours | Same deadlock. Use **Xcode GUI Archive** instead of CLI `xcodebuild` |

### Stuck at `ExecuteExternalTool … clang -v` (Xcode 26)

This line looks like a hung compiler, but `clang` is usually **blocked writing to a pipe** while `SWBBuildService` waits on IPC. Confirmed on Xcode 26.6 / macOS 26.5: CLI `xcodebuild` can sit at this line forever; running the same `clang …` command by hand finishes instantly.

**Unstick now:**

```bash
# Ctrl+C the stuck terminal first, then:
killall xcodebuild SWBBuildService clang ibtoold 2>/dev/null
pgrep -x Xcode || echo "Xcode GUI closed ✓"
```

**Reliable workaround — archive from Xcode GUI (skip CLI `xcodebuild`):**

```bash
npm run build:mobile
npm run open:ios
```

In Xcode: select **Any iOS Device (arm64)** → **Product → Archive** → **Distribute App → App Store Connect → Upload**.

To watch progress, use **Report navigator** (⌘9) in Xcode — not `tail -f` on a CLI log.

**If GUI also hangs:** quit Xcode, `rm -rf ~/Library/Developer/Xcode/DerivedData/*`, reboot, retry GUI archive only (no terminal `xcodebuild`).

**Do not use** `| tee`, `| tail`, or any pipe on `xcodebuild` stdout on Xcode 26 — it can worsen pipe deadlocks.
| `ARCHIVE INTERRUPTED` | You Ctrl+C'd — run again, don't cancel early |
| Organizer shows old name "App" | Archive with scheme `Land F-X Passport` (Organizer uses scheme name, not target name) |
| Missing Compliance in TestFlight | App Store Connect → build → **Manage** → encryption **Yes**, non-exempt **No** (HTTPS only) |
| IPA error 90017 (invalid Payload) | `PRODUCT_NAME` must not contain `/` — use `Land F-X Passport` for bundle, display name can keep `Land F/X` |
| Export signing errors | Use Organizer upload instead of CLI export |
| App can't reach API | Rebuild with correct `.env.production`, redeploy CORS on Vercel |

---

## What not to do

- Don't run `xcodebuild` while Xcode GUI is building/indexing
- Don't use `| tee` with `xcodebuild`
- Don't `sudo killall -STOP usbmuxd` (pauses iOS device services)
- Don't skip bumping the build number between uploads
- Don't assume Vercel env vars apply — native builds use local `.env.production` only

---

Want this saved as `notes/TODOS/ios-build-checklist.md` in the repo for easy reference?