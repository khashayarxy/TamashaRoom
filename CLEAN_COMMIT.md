# TamashaRoom — Clean Commit Checklist

## Files to commit (28 changed files)

### Frontend — Core
| File | Reason |
|---|---|
| `resources/js/stores/theme.ts` | Dark mode default + persist toggle |
| `resources/js/Pages/Welcome.tsx` | Dark mode toggle button + Persuade landing |
| `resources/js/Pages/Dashboard.tsx` | Room creation error display |
| `resources/js/Pages/Rooms/Show.tsx` | Chat unread badge on tab |
| `resources/js/Components/composite/room-chat.tsx` | Tab switch visibility handler + document.title notifications |
| `resources/css/app.css` | Full warm palette via CSS variables, RTL, dark mode |

### Frontend — Auth & Profile (converted to Persian/warm palette)
| File | Reason |
|---|---|
| `resources/js/Pages/Auth/Login.tsx` | Persian UI, warm palette, brand personality |
| `resources/js/Pages/Auth/Register.tsx` | Same |
| `resources/js/Pages/Auth/ForgotPassword.tsx` | Same |
| `resources/js/Pages/Auth/ResetPassword.tsx` | Same |
| `resources/js/Pages/Auth/ConfirmPassword.tsx` | Same |
| `resources/js/Pages/Auth/VerifyEmail.tsx` | Same |
| `resources/js/Pages/Profile/Edit.tsx` | Persian UI, warm palette |
| `resources/js/Pages/Profile/Partials/DeleteUserForm.tsx` | Same |
| `resources/js/Pages/Profile/Partials/UpdatePasswordForm.tsx` | Same |
| `resources/js/Pages/Profile/Partials/UpdateProfileInformationForm.tsx` | Same |

### Frontend — Layouts & Components
| File | Reason |
|---|---|
| `resources/js/Layouts/GuestLayout.tsx` | Warm dark bg, RTL, amber accent bar |
| `resources/js/Layouts/AuthenticatedLayout.tsx` | Warm palette, Persian nav |
| `resources/js/Layouts/AppLayout.tsx` | Theme-aware layout |
| `resources/js/lib/utils.ts` | cn() with tailwind-merge, sanitizeText, toPersianDigits |
| `resources/js/stores/room-ui.ts` | ownerId for transfer UX |
| `resources/js/Components/ui/dialog.tsx` | Dark mode theme tokens |
| `resources/js/Components/ui/toast.tsx` | Dark mode colors |

### Backend — Bug Fixes
| File | Reason |
|---|---|
| `app/Http/Requests/StoreRoomRequest.php` | Removed `orWhereNull('last_activity_at')` bug |
| `app/Http/Controllers/Auth/RegisteredUserController.php` | Removed double-hashing (model cast handles it) |
| `config/tamasharoom.php` | Verified room limit (50 global — no change needed) |

### Documentation & Config
| File | Reason |
|---|---|
| `.gitignore` | Excludes test-results/, vite_build_*.txt, .last-run.json |
| `docs/quality-report.md` | Build verification report |

---

## Files to UNTRACK (must `git rm --cached`)

These were created during development and should be removed from Git tracking.
All have been **deleted from disk**. Run one command to untrack any that were previously committed:

```bash
# Untrack all temp/build artifacts (skip any that return "did not match any files")
git rm --cached build_out.txt build_out2.txt build_out3.txt build_out4.txt 2>/dev/null
git rm --cached build_err4.txt build-err.txt build-out.txt build-output.txt 2>/dev/null
git rm --cached vite_build_out.txt vite_build_err.txt vite-err.txt vite-out.txt vite-stderr.txt vite-stdout.txt 2>/dev/null
git rm --cached tsc-err.txt tsc-out.txt node_err.txt node_test.txt 2>/dev/null
git rm --cached test-results/.last-run.json 2>/dev/null
git rm --cached -r test-results/ 2>/dev/null
git rm --cached build.log test.log 2>/dev/null
```

After running, `git status` should show **zero untracked temp files**.

---

## Pre-commit Verification

```bash
# 1. Verify .gitignore is correct
cat .gitignore

# 2. Confirm no temp files in staged status
git status

# 3. Check only the files above are modified
git diff --stat

# 4. Show what will be committed
git log --oneline -3
git diff --cached --stat
```

---

## Commit Message

```
feat: complete TamashaRoom frontend build

- Dark mode default + toggle on all pages
- Persian UI for Auth, Profile, Dashboard
- Warm amber/charcoal palette via CSS variables
- RTL layout with logical properties throughout
- Vazirmatn + JetBrains Mono typography
- Chat tab-switch visibility handler + document.title notifications
- Room creation limit fix (orWhereNull bug removed)
- Password double-hash fix (model casts handle hashing)
- Covers: legacy Breeze, composite components, Zustand stores, layout system
```

---

## Post-Commit Check

```bash
php artisan config:clear
php artisan route:clear
php artisan view:clear
npm run build
```

---

## Deployment notes

See `docs/deployment-checklist.md` for full production setup (env, queue worker, cron, security hardening).
