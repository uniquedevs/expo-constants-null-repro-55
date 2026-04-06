# Constants.expoConfig null with prebuilt xcframeworks — Minimal Repro

## Summary

`Constants.expoConfig` returns `null` in production iOS builds when `expo-modules-core` is linked as a prebuilt xcframework (default in SDK 55.0.19+). This causes `expo-linking.resolveScheme()` to throw on startup, crashing any app that uses `expo-router`.

```
Error: expo-linking needs access to the expo-constants manifest
(app.json or app.config.js) to determine what URI scheme to use.
```

## Environment

- Expo SDK 55
- `expo-modules-core@55.0.20`
- `expo-constants@17.x` (shipped with SDK 55)
- iOS 26.3.1, iPhone 13 mini (physical device, TestFlight distribution)
- Xcode 26.2, EAS Build

## Root cause

File: `node_modules/expo-modules-core/ios/Utilities/ConstantsProvider.swift:85-101`

```swift
private func getManifest() -> [String: Any]? {
  let frameworkBundle = Bundle(for: ConstantsProvider.self)
  guard let bundleUrl = frameworkBundle.resourceURL?.appendingPathComponent("EXConstants.bundle"),
        let bundle = Bundle(url: bundleUrl),
        let url = bundle.url(forResource: "app", withExtension: "config") else {
    log.error("Unable to find the embedded app config")
    return nil
  }
  ...
}
```

`Bundle(for: ConstantsProvider.self)` returns the bundle that physically contains the `ConstantsProvider` class.

- **Before 55.0.19** — `expo-modules-core` was source-compiled into the main app binary, so `Bundle(for:)` returned `Bundle.main` → `EXConstants.bundle` was found at `MyApp.app/EXConstants.bundle` ✓
- **In 55.0.19+** — `expo-modules-core` ships as `ExpoModulesCore.xcframework`, so `Bundle(for:)` returns `MyApp.app/Frameworks/ExpoModulesCore.framework`. `EXConstants.bundle` is **not** copied inside that framework — it is still placed at `MyApp.app/EXConstants.bundle` by `expo-constants`'s own `'Generate app.config for prebuilt Constants.manifest'` build phase (see `expo-constants/ios/EXConstants.podspec:39`). The lookup fails, `getManifest()` returns `nil`, the `manifest` key in the constants dict is `nil`, and JS sees `Constants.expoConfig === null`.

## Reproduction

1. Clone this repo and `npm install`
2. `eas build --platform ios --profile production` (with default settings — precompiled modules enabled)
3. Install via TestFlight on a physical iOS device
4. App crashes immediately on launch with the `expo-linking` error above

## Direct verification in the .ipa

```
MyApp.app/EXConstants.bundle/app.config        ← file exists, contains correct "scheme"
MyApp.app/Frameworks/ExpoModulesCore.framework/  ← only binary + Info.plist, NO EXConstants.bundle
```

Scheme is correctly serialized into `app.config`; the file simply isn't found by `ConstantsProvider` at runtime.

## Workaround

Set `EXPO_USE_PRECOMPILED_MODULES=0` in `eas.json` to force source compilation:

```json
{
  "build": {
    "production": {
      "env": { "EXPO_USE_PRECOMPILED_MODULES": "0" }
    }
  }
}
```

## Suggested fix

Fall back to `Bundle.main` in `ConstantsProvider.swift` when the framework bundle doesn't contain `EXConstants.bundle`:

```swift
let candidates = [
  Bundle(for: ConstantsProvider.self).resourceURL,
  Bundle.main.resourceURL
].compactMap { $0?.appendingPathComponent("EXConstants.bundle") }
guard let bundleUrl = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }),
      let bundle = Bundle(url: bundleUrl),
      ...
```

## Related

- PR #44433 — introduced the xcframework switch
- Issue #44091 — likely same root cause, different symptom