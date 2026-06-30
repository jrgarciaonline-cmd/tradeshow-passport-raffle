# App icon assets

## Source of truth

- **`appstore.png`** — 1024×1024 master icon (App Store + generation input)
- **`playstore.png`** — 512×512 Play Store listing image

## Generating native + PWA icons

Icons in `Assets.xcassets/` and `android/` under this folder are **not** used by iOS or Android builds. Native projects live in `ios/` and `android/` at the repo root.

After updating `appstore.png`, run:

```bash
npm run assets:generate
npm run build:mobile
```

That copies `appstore.png` → `resources/icon.png` and runs `@capacitor/assets`, which writes:

- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
- Android: `android/app/src/main/res/mipmap-*/`
- PWA: `public/assets/icons/` (referenced from `manifest.webmanifest`)
