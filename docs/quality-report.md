# TamashaRoom — Quality Report

> **⚠️ HISTORICAL REPORT — NON-AUTHORITATIVE.**
>
> This is a point-in-time snapshot generated on **July 24, 2026** (branch
> `frontend_rebuild`). It is **not** the current state of the project. Do not
> treat its test counts, file inventory, or "Cannot run" notes as current facts.
> For the current state, read the canonical docs instead:
> - `docs/TASK.md` — current test counts and what is done/pending
> - `docs/PROJECT.md` — current stack, structure, env vars
> - `docs/deployment-checklist.md` — current deployment procedure
> - `docs/SYSTEM.md` — current operating rules
>
> **Known stale claims in this snapshot (as of 2026-08-02):**
> - §5 "Stores (4 Zustand)" lists `stores/sidebar.ts` — **that store does not
>   exist**. The current stores are `theme`, `room-ui`, `subtitle`.
> - §5 "Backend" lists `PollingController` — **removed**. Playback state is
>   served by `PlaybackController`.
> - §1 "Total: 10 Feature + 4 Unit test files (14 PHP tests)" — that counts
>   **files**, not tests; the PHP suites now contain far more test methods. See
>   `docs/TASK.md` for current counts.
> - §6 references a "195-step checklist" — `docs/deployment-checklist.md` is a
>   10-section document, not a 195-step checklist.
> - §2.2 lists 3 a11y specs; there are now 4 (including `welcome-a11y.spec.ts`).

---

## 1. Backend Tests

| Suite | Files | Status | Notes |
|---|---|---|---|
| Feature — RoomManagementTest | 1 (10.5 KB) | Cannot run | Requires `php` CLI |
| Feature — PlaybackSyncTest | 1 (10.8 KB) | Cannot run | Requires `php` CLI |
| Feature — SubtitleTest | 1 (9.2 KB) | Cannot run | Requires `php` CLI |
| Feature — SecurityTest | 1 (8.1 KB) | Cannot run | Requires `php` CLI |
| Feature — RateLimiterTest | 1 (8.0 KB) | Cannot run | Requires `php` CLI |
| Feature — VideoStreamTest | 1 (6.8 KB) | Cannot run | Requires `php` CLI |
| Feature — PresenceTest | 1 (6.3 KB) | Cannot run | Requires `php` CLI |
| Feature — ChatTest | 1 (5.2 KB) | Cannot run | Requires `php` CLI |
| Feature — ProfileTest | 1 (2.5 KB) | Cannot run | Requires `php` CLI |
| Feature — ExampleTest | 1 (359 B) | Cannot run | Requires `php` CLI |
| Unit — PresenceServiceTest | 1 (4.1 KB) | Cannot run | Requires `php` CLI |
| Unit — SubtitleConverterTest | 1 (3.4 KB) | Cannot run | Requires `php` CLI |
| Unit — UrlSecurityServiceTest | 1 (3.3 KB) | Cannot run | Requires `php` CLI |
| Unit — ExampleTest | 1 (243 B) | Cannot run | Requires `php` CLI |

**Total:** 10 Feature + 4 Unit test files (14 PHP tests)  
**Note:** `php artisan test` requires PHP 8.4+ CLI with SQLite. Run manually in a proper terminal.

---

## 2. Frontend Tests

### 2.1 E2E Tests (Playwright)

| File | Lines | Status | Notes |
|---|---|---|---|
| `tests/e2e/room.spec.ts` | ~120 | Cannot run | Requires Playwright + Node |
| `tests/e2e/chat.spec.ts` | 105 | Cannot run | Requires Playwright + Node |
| `tests/e2e/subtitle.spec.ts` | 140 | Cannot run | Requires Playwright + Node |
| `tests/e2e/lock-kick-transfer.spec.ts` | 193 | Cannot run | Requires Playwright + Node |

**Note:** Run with `npx playwright test tests/e2e/` in a terminal with Node.js on PATH.

### 2.2 A11y Tests

| File | Lines | Status | Notes |
|---|---|---|---|
| `tests/a11y/a11y.spec.ts` | ~55 | Cannot run | Requires Playwright + Node |
| `tests/a11y/auth-a11y.spec.ts` | 55 | Cannot run | Requires Playwright + Node |
| `tests/a11y/room-a11y.spec.ts` | ~30 | Cannot run | Requires Playwright + Node |

**Note:** Run with `npx playwright test tests/a11y/` in a terminal with Node.js on PATH.

---

## 3. Code Quality

### 3.1 Build Output (verified from disk)

| Metric | Value |
|---|---|
| Build assets | **25 files** in `public/build/assets/` |
| CSS bundle | **60.7 KB** — `app-tI-nsFxL.css` |
| JS entry chunk | **399 KB** — `app-AOop0pi3.js` |
| Largest page chunk | **54.6 KB** — `Show-DQC_9jcb.js` (Rooms/Show) |
| Largest shared chunk | **36.5 KB** — `DeleteUserForm-7PzqdjL7.js` |
| Smallest chunk | **405 B** — `message-square-C0rMNWYo.js` (icon component) |
| Last build | July 24, 2026 5:30 PM |

### 3.2 TypeScript Check
- **Cannot run** in this shell environment (requires `npx tsc --noEmit`)
- TypeScript config: `strict: true` in `tsconfig.json`
- No `.tsbuildinfo` file present (build uses Vite's isolated module compilation)

### 3.3 Lint
- **Cannot run** in this shell environment (requires `npx eslint`)

---

## 4. Security

### 4.1 npm Audit
- **Cannot run** in this shell environment (requires `npm audit`)
- `node_modules/` is present at 622 MB with 833 packages

### 4.2 Composer Audit
- **Cannot run** in this shell environment (requires `composer audit`)
- `vendor/` is present with all Laravel 13 dependencies

### 4.3 Known Security Features (verified from code)
| Feature | Status |
|---|---|
| Auth: password hashing | ✅ `'password' => 'hashed'` model cast + `Hash::make()` removed from controller (no double-hash) |
| XSS: subtitle sanitization | ✅ `sanitizeText()` in `utils.ts` strips HTML tags; applied at every subtitle boundary |
| XSS: chat messages | ✅ Rendered via React's default escaping (JSX text content) |
| CSRF: Laravel | ✅ Inertia.js includes `_token` automatically |
| Rate limiting | ✅ `RateLimiterTest.php` covers throttle rules |
| URL validation | ✅ `UrlSecurityServiceTest.php` validates video URLs |
| Locked rooms | ✅ Authorization policy checks `is_locked` |

---

## 5. File Inventory

### Pages (11 entry points in manifest)
| Page | File | Status |
|---|---|---|
| Welcome | `resources/js/Pages/Welcome.tsx` | Built (10 KB) |
| Dashboard | `resources/js/Pages/Dashboard.tsx` | Built (5.6 KB) |
| Login | `resources/js/Pages/Auth/Login.tsx` | Built (3.6 KB) |
| Register | `resources/js/Pages/Auth/Register.tsx` | Built (3.3 KB) |
| ForgotPassword | `resources/js/Pages/Auth/ForgotPassword.tsx` | Built (2.1 KB) |
| ResetPassword | `resources/js/Pages/Auth/ResetPassword.tsx` | Built (2.8 KB) |
| ConfirmPassword | `resources/js/Pages/Auth/ConfirmPassword.tsx` | Built (1.9 KB) |
| VerifyEmail | `resources/js/Pages/Auth/VerifyEmail.tsx` | Built (2.4 KB) |
| Profile/Edit | `resources/js/Pages/Profile/Edit.tsx` | Built (10.1 KB) |
| Profile/Partials (3) | 3 partial files | Built (3.8–36.5 KB) |
| Rooms/Show | `resources/js/Pages/Rooms/Show.tsx` | Built (54.6 KB) |

### Shared Components (9 manifest entries)
| Chunk | Purpose |
|---|---|
| `AppLayout` | Authenticated layout shell |
| `GuestLayout` | Guest/auth layout shell |
| `ApplicationLogo` | SVG logo mark |
| `PrimaryButton` | Legacy Breeze button |
| `TextInput` | Legacy Breeze input |
| `button` | UI primitive (variants) |
| `input` | UI primitive (variants) |
| `theme` | Theme toggle store |
| `message-square` | Icon component |

### Layouts
| File | Status |
|---|---|
| `resources/js/Layouts/GuestLayout.tsx` | ✅ Dark near-black bg, centered card, indigo accent bar |
| `resources/js/Layouts/AuthenticatedLayout.tsx` | ✅ Palette tokens (dark indigo/rose), theme tokens, Persian |
| `resources/js/Layouts/AppLayout.tsx` | ✅ Sidebar, header, main content slot |

### Stores (4 Zustand)
| File | Purpose |
|---|---|
| `stores/theme.ts` | Dark/light toggle, persisted to localStorage, default dark |
| `stores/room-ui.ts` | Room state: video_url, room_name, invite_code, is_locked, ownerId |
| `stores/subtitle.ts` | Subtitle tracks, active track, current cue |
| `stores/sidebar.ts` | Sidebar collapse state |

### Backend (verified from disk — no changes made)
| Domain | Files | Tests |
|---|---|---|
| Auth | Controllers + Requests | ProfileTest |
| Rooms | RoomController, Policy, Form Requests | RoomManagementTest (10.5 KB) |
| Playback Sync | PlaybackController, PollingController | PlaybackSyncTest (10.8 KB) |
| Chat | ChatController (polling-based) | ChatTest (5.2 KB) |
| Subtitles | SubtitleController, Converter | SubtitleTest (9.2 KB) |
| Presence | PresenceController, Service | PresenceTest (6.3 KB) |
| Security | RateLimiter, UrlSecurityService | RateLimiterTest (8 KB), SecurityTest (8.1 KB) |
| Video Streaming | VideoStreamController | VideoStreamTest (6.8 KB) |

---

## 6. Recommendations

### Must Run Before Deployment
1. Open a **proper terminal** (Windows Terminal / CMD with Node.js and PHP on PATH)
2. Run tests:
   ```bash
   cd C:\Users\Khashayar\Documents\TamashaRoom
   php artisan test
   npx playwright test tests/e2e/
   npx playwright test tests/a11y/
   ```
3. Run code quality:
   ```bash
   npx tsc --noEmit
   npx eslint resources/js/
   npm run build
   ```
4. Run security audits:
   ```bash
   npm audit
   composer audit
   ```
5. Follow `docs/deployment-checklist.md` for production deployment (195-step checklist covering env, migrations, scheduled-task cron entry — which fans out to the `queue:work --stop-when-empty --max-time=30` batch drain, no persistent worker — security, rollback).

### Known Issues
| Issue | Severity | Status |
|---|---|---|
| Shell environment: Node.js/npm executables produce empty output when called from this tool | Operational | Cannot resolve — use a real terminal |
| Shell environment: PHP not on PATH | Operational | Install PHP 8.4+ CLI or use WSL |
| Vite HMR: requires `host: '127.0.0.1'` (not `'0.0.0.0'`) on Windows | RESOLVED | `vite.config.js` fixed |
| npm.ps1 wrapper broken on this system (PowerShell $LASTEXITCODE issue) | Operational | Use `npm.cmd` from CMD, not PowerShell |

### Code Quality Summary (from last verified build: July 24, 5:30 PM)
- **npm run build:** ✅ Zero errors — 2840 modules transformed, 25 assets, 60.7 KB CSS, all 11 page chunks + 9 shared chunks
- **TypeScript:** Strict mode enabled, no `.tsbuildinfo` (Vite isolates module compilation)
- **Design system:** Dark indigo/rose palette (near-black #0A0A0F bg, indigo #6366F1 primary, rose #F43F5E destructive), Vazirmatn + Inter (Latin fallback), RTL logical properties, Persian digits
- **Architecture:** No React Query, no WebSockets — Zustand stores, Inertia props, polling-based sync (shadcn-style `ui/` primitives on Radix + Sonner toast added 2026-08-08)
