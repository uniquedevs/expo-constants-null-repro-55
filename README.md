# Constants.expoConfig null with prebuilt xcframeworks — Minimal Repro

## Bug

`Constants.expoConfig` returns `null` in production iOS builds when `expo-modules-core` is linked as a prebuilt xcframework (default in SDK 55.0.19+).

This causes `expo-linking.resolveScheme()` to throw on startup, crashing any app that uses `expo-router`.

## Steps to reproduce

1. `npm install`
2. `eas build --platform ios --profile production`
3. Install via TestFlight on a physical iOS device
4. App crashes immediately with:
   ```
   Error: expo-linking needs access to the expo-constants manifest
   ```

## Root cause

`expo-modules-core/ios/Utilities/ConstantsProvider.swift:86` uses `Bundle(for: ConstantsProvider.self)` to locate `EXConstants.bundle`. When ExpoModulesCore is a prebuilt xcframework, this returns `ExpoModulesCore.framework` bundle instead of the main app bundle. `EXConstants.bundle` lives in the main app bundle, not inside the framework — so the lookup fails and `getManifest()` returns nil.

## Workaround

Set `EXPO_USE_PRECOMPILED_MODULES=0` in eas.json to force source compilation.