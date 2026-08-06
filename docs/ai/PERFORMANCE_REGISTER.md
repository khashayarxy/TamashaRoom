# POST /register — Performance Note (2026-08-07)

Sources of truth: `app/Http/Controllers/Auth/RegisteredUserController.php`, `app/Models/User.php`,
`routes/auth.php`, `app/Providers/AppServiceProvider.php` (App rate limiters). Measured with a
non-invasive CLI profiler (temporary script, no repo/app code changed).

## Measured timings (local env)

Environment measured: `session=database`, `cache=database`, `queue=database`, `mail=log`,
**bcrypt cost 12** (`BCRYPT_ROUNDS=12` in local `.env`). Averages over 3 runs.

| Phase | Duration | Notes |
|---|---|---|
| Validation (rules + unique query) | ~10.8 ms | 2 `SELECT COUNT(*)` on `users.email`; `lowercase`/`email`/`max`/`Password::defaults()` — all local |
| Password hashing (isolated) | **~207 ms** | `bcrypt`, cost 12 — dominant cost |
| `User::create` (incl. `hashed` cast) | **~217 ms** | equals hashing + 1 INSERT (~4.4 ms) |
| `event(Registered)` + listener | ~0.2 ms | → `SendEmailVerificationNotification` **early-returns** (`User` has no `MustVerifyEmail`) |
| `Auth::login` + session regenerate | ~1.5 ms | `DELETE` + `INSERT` on `sessions` |
| DB queries (validation+create+session) | ~14 ms / 9 queries | 3 runs combined; per-run ~5 ms / 3 queries |

Controller body totals **~235 ms**; the web stack (throttle, CSRF, session start, Inertia share)
adds the remaining handler overhead.

## There is no ~30 s blocking path

No step in `POST /register` can block for ~30 s:

- **No mail.** `SendEmailVerificationNotification` bails immediately (`User` does not implement
  `MustVerifyEmail`); `MAIL_MAILER=log` is never even reached — no SMTP connect/retry timeout.
- **No queue.** `Registered` has no queued listeners; nothing is pushed onto the `database` queue.
- **No external network call in validation.** `Password::defaults()` is not customized, so there is
  no `uncompromised()`/pwned API check. The only `->timeout(` in the codebase is the video
  playback-mode probe (`DetermineVideoPlaybackModeAction`, 3 s) — a different feature.
- **No sleeps / socket timeouts** in the request path.
- The ~30 s figure that appears in project docs refers to the **cron queue drain** (the
  `queue:work --stop-when-empty --max-time=30` invocation guarded by that cron), not the
  register request.

## The only potential bottleneck: bcrypt cost 12 (~200+ ms)

- At cost 12 hashing is the single largest, most predictable synchronous latency in registration.
- On the target shared cPanel (1 CPU / Apache / PHP 8.4) cost 12 will likely exceed **300 ms**
  per hash, pushing the register response noticeably slower than local measurements.

## Bottleneck keeps cost 12 until production/cPanel benchmarking

**Decision (2026-08-07): do not change `BCRYPT_ROUNDS` now.** No code changes were made.

- Keep cost 12 for security margins (OWASP recommends ≥ cost 10–12 for bcrypt).
- After deployment, benchmark the real cPanel environment.
- Only if registration latency becomes a real-world issue there, lower `BCRYPT_ROUNDS` to **11**
  in the production `.env` (a one-line config change, no code change), and document the resulting
  timing alongside this note.

Related: `docs/TASK.md` → Completed (2026-08-07) "Register Latency Profile".
This note lives at level 4 (`docs/ai/`); it must not contradict `docs/` or the source code.