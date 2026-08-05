# FreeCal Native iOS App

The `native/` folder contains a thin **Expo wrapper app** around the existing
FreeCal web app (PWA). It loads `https://freecal.vercel.app` in a WebView and
adds a native calendar bridge (expo-calendar) so events can be read **from**
the iOS Calendar directly and written **to** it without share-sheet hacks.

The web app itself is unchanged for normal browsers — the native features only
appear when the bridge is detected (`isNativeApp()` in
`src/lib/nativeBridge.ts`).

## What the bridge provides

| Capability | Web UI |
|---|---|
| List iOS calendars, read events (incl. recurrence, alarms, tentative status) | Create Event → Import → **iOS Calendar** (third option in `ImportMethodDialog`) |
| Write a FreeCal event into an iOS calendar (native calendar picker + pre-filled confirm dialog) | Event detail dialog → **Add to iOS Calendar** |

## Wire protocol

Messages are JSON via `window.ReactNativeWebView.postMessage` (web → native)
and an injected `window.__freeCalNativeResponse({ id, ok, data?, error? })`
callback (native → web).

Types are defined **twice** — keep them in sync:

- `native/src/bridgeTypes.ts` (native side)
- `src/lib/nativeBridge.ts` (web side, mirror)

Event field mapping: `src/utils/nativeEventMapper.ts` converts expo-calendar
events (UTC ISO dates, `EKWeekday` 1=Sunday..7=Saturday, RecurrenceRule
object) into the `ParsedEvent` shape used by the ICS import flow. The inverse
(RRULE string → expo RecurrenceRule) lives in `native/src/rrule.ts`.

## Development

```bash
cd native
npm install
npx tsc --noEmit        # type check
```

> Note: since Expo SDK 57, `expo-calendar` is **not available in Expo Go** —
> you need a development build (`eas build -p ios --profile development`) or a
> preview build to test the bridge.

## Building & TestFlight

Prerequisites: an **Apple Developer Program** membership (99 €/year, personal
account is enough — no D-U-N-S needed).

```bash
cd native
npx eas login                      # with the Apple ID of your dev account
npx eas build -p ios --profile preview     # internal .ipa (TestFlight)
npx eas submit -p ios              # upload to App Store Connect
```

Then in App Store Connect → TestFlight: add testers (up to 100 internal) or
enable a public link (external testing requires a short beta review). Builds
expire after 90 days. `eas.json` contains `development`, `preview` and
`production` profiles.

## Known limitations

- **Web push does not work inside the WebView** (WKWebView does not support
  the Web Push API reliably). The PWA keeps its push notifications; a native
  push integration would be a separate step.
- iOS 17+ calendar permission dialogs distinguish full vs. limited access.
  The bridge requests full access; if the user grants only selected
  calendars, only those are readable.
- All-day write: FreeCal end dates are inclusive; the native side converts to
  EventKit's exclusive end date (+1 day).
