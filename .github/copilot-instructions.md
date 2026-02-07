# AI Coding Agent Instructions for Swift Messenger

Use these project-specific guidelines to be productive immediately. Focus on the established architecture, service boundaries, and patterns used across the app.

## Architecture & State
- **Routing:** Expo Router drives navigation. Root providers are composed in [app/_layout.tsx](../app/_layout.tsx) (Auth, Security, Theme, Feature Flags, Toast, Call, SafeArea).
- **Auth:** Supabase auth and user profile management live in [contexts/auth-context.tsx](../contexts/auth-context.tsx). Always access session/user via `useAuth()`; don’t call Supabase directly in screens.
- **Security:** Login location trust and lockouts in [contexts/security-context.tsx](../contexts/security-context.tsx). It calls the Supabase Edge Function `verify-login-location` and manages block/lock state. Use `useSecurity()` to check `isBlocked` or update settings.
- **Feature Flags:** Centralized flag retrieval/overrides in [services/feature-flag-service.ts](../services/feature-flag-service.ts) exposed via [contexts/feature-flag-context.tsx](../contexts/feature-flag-context.tsx). Gate new features with `isEnabled('FLAG_KEY')`.
- **Theme:** System/light/dark with Material 3 mapping in [contexts/theme-context.tsx](../contexts/theme-context.tsx). Read `theme` and `isDarkMode` via `useTheme()`.

## Services & Data Flow
- **Supabase Client:** Initialized in [services/supabase.ts](../services/supabase.ts) with `AsyncStorage` session persistence. Read URL/key from `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Realtime Signaling:** WebRTC signaling uses a shared Supabase Realtime broadcast channel `global-signaling` in [services/signaling-service.ts](../services/signaling-service.ts). Subscribe per-user and filter messages by `receiverId`. Send signals via `signalingService.sendSignal()`.
- **Call Handling:** Device media and peer connection logic is in [services/call-service.ts](../services/call-service.ts). The `CallProvider` in [contexts/call-context.tsx](../contexts/call-context.tsx) wires signaling → navigation. Use `callService.isSupported()` and `setCallbacks()` when integrating UI.
- **Notifications:** Native push setup and action categories in [hooks/use-native-push.ts](../hooks/use-native-push.ts). Incoming call notifications emit events consumed by the `CallModal` in [app/_layout.tsx](../app/_layout.tsx).
- **AI Chat:** Local chat settings, message persistence, and model listing in [services/ai-service.ts](../services/ai-service.ts). Models can be fetched via Supabase Functions; title generation is local. Respect the usage limits via `checkAndIncrementUsage()`.
- **Python Exec & Visualizations:** Backend at `DEFAULT_URL` in [services/python-execution-service.ts](../services/python-execution-service.ts). Parse special content tags using `PythonExecutionService.parseContentBlocks()`:
  - `<PYTHON_EXEC>{"code":"..."}</PYTHON_EXEC>` executes code
  - `<IMAGE_GEN>{"prompt":"...","model":"..."}</IMAGE_GEN>` describes image generation
  - `<VISUALIZATION_EMBED>...</VISUALIZATION_EMBED>` and `<VISUALIZATION_FULL>...</VISUALIZATION_FULL>` are HTML/JS snippets; CDNs listed in `VISUALIZATION_LIBRARIES` of [services/ai-service.ts](../services/ai-service.ts).

## Conventions & Patterns
- **Path Aliases:** Use `@/components/*`, `@/hooks/*`, `@/services/*`, `@/contexts/*`, `@/constants/*` as defined in [tsconfig.json](../tsconfig.json). Prefer importing via aliases over relative paths.
- **Platform-Specific Files:** When creating screens or components with UI, create three versions:
  - `.tsx` - shared logic/fallback
  - `.ios.tsx` - iOS version using Cupertino components (from `@react-navigation/native` or native iOS patterns)
  - `.android.tsx` - Android version using React Native Paper components
  See examples in [app/settings.tsx](../app/settings.tsx), [app/settings.ios.tsx](../app/settings.ios.tsx), [app/settings.android.tsx](../app/settings.android.tsx).
- **Screens:** Keep screens thin. Fetch data and side effects in services/contexts; pass primitives to component props. Avoid calling Supabase directly from UI.
- **Lists & Performance:** Follow React Native list best practices (no inline objects/styles in `renderItem`, pass primitives). See local AGENTS docs in [.agents/skills/vercel-react-native-skills/AGENTS.md](../.agents/skills/vercel-react-native-skills/AGENTS.md).
- **Feature Gating:** Use `useFeatureFlags().isEnabled('FLAG')` to enable features such as calling (`ENABLE_CALLING`).
- **Security Overlays:** Respect `isBlocked` and `SecurityBlockOverlay` in [app/security-block-overlay.tsx](../app/security-block-overlay.tsx) to avoid exposing blocked flows.

## Examples to Emulate
- **Subscribe to signaling:** See subscription and filter-by-user in [services/signaling-service.ts](../services/signaling-service.ts).
- **Navigate on incoming call:** Pattern in [contexts/call-context.tsx](../contexts/call-context.tsx) and `CallModal` in [app/_layout.tsx](../app/_layout.tsx).
- **Flags override & debug:** Use `useFeatureFlags().setOverride()` and inspect `debugInfo` as in [contexts/feature-flag-context.tsx](../contexts/feature-flag-context.tsx).
- **Parsing chat content:** Use `PythonExecutionService.parseContentBlocks()` and render blocks according to type; avoid parsing ad hoc in components.

## Notes
- Existing general AI guidelines live in [.agents](../.agents/skills) and [.opencode](../.opencode/skills). Apply them only when consistent with this app's patterns.
- Avoid direct DB mutations in components; route writes via services and keep navigation effects in contexts.- **DO NOT run, build, export, or execute any commands.** Focus only on code analysis and generation.