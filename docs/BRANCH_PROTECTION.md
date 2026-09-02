# Branch Protection Rules for `master`

Configure in GitHub → Settings → Branches → Add rule:

- ✅ Require status checks to pass before merging
  - `ci` workflow must be green
- ✅ Require branches to be up to date before merging
- ✅ Include administrators
- ❌ Do NOT require reviews (solo project for now)
- ❌ Do NOT restrict pushes (allow direct push for speed)

Note: For team projects, enable "Require pull request reviews" with 1 approval.
