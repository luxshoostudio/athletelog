# Building the iOS app

The web app and the native app are **one codebase**. `index.html` is served
straight from this repo on GitHub Pages, and the same file is bundled into an
iOS shell by Capacitor. Nothing is forked — a feature written once runs in
both, and the native build simply has more available to it.

## What the native build gets

| | PWA | Native |
|---|---|---|
| Active calories | Gist relay (`alog-garmin`, needs the Mac awake, uses Garmin's undocumented endpoint) | **Apple Health, direct** |
| Steps | not available | **Apple Health, direct** |
| Storage | localStorage, which iOS may evict | app storage, not evicted |
| Eating protocol | `alog-plan` → Gist | unchanged, same path |

Sleep is **not** included. `capacitor-health` does not expose it; adding it
means a small custom plugin, which is a separate job.

## First time

1. **Install Xcode** from the App Store (~10 GB). Then:

   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   sudo xcodebuild -license accept
   ```

2. **Build the web assets and open the project:**

   ```bash
   npm install
   npm run sync      # builds www/ and copies it into ios/
   npm run open      # opens Xcode
   ```

3. **In Xcode, once:**
   - Select the `App` target → **Signing & Capabilities**
   - Team: your Apple ID (add it under Xcode → Settings → Accounts)
   - Confirm **HealthKit** is listed. `App.entitlements` already requests it,
     but the capability has to exist on the provisioning profile.
   - Plug the iPhone in, pick it as the run destination, press ▶

4. **On the phone**, the first time the Garmin sheet is opened, iOS asks for
   Health access. Grant active energy, steps and workouts.

## Free Apple ID vs the $99 programme

A free Apple ID signs the app for **7 days**, after which it will not launch
until rebuilt from Xcode. Fine for deciding whether the native build is worth
it; not usable long term. The Apple Developer Programme ($99/year) extends
that to a year. Neither requires the App Store — this is a personal app and
never has to be submitted.

## After a code change

```bash
npm run sync      # picks up index.html and vendor/
npm run open      # ▶ in Xcode
```

The PWA updates on `git push` as before, so day-to-day changes can be checked
there and only batched into a rebuild when worth it.

## Notes

- `www/` is generated; it is gitignored. `scripts/build-www.mjs` assembles it
  and strips the service-worker registration, which buys nothing inside a
  native web view and would serve a stale build after an update.
- `npm audit` reports moderate advisories in `@capacitor/cli`'s dependency
  `xcode` → `uuid`. Build-time only; nothing from it ships in the app.
