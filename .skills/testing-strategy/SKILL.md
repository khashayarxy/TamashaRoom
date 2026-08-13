---
name: testing-strategy
description: Testing strategy for TamashaRoom — what to test at each layer (unit/integration/E2E), the testing pyramid, component testability requirements, and which tool to use where (PHPUnit, Vitest, React Testing Library, Playwright, axe-core). Use when writing any test or deciding what kind of test a change needs.
---

# Testing Strategy

Full detail: `docs/SYSTEM.md`, 14.08 (Component Testing) and the testing
tooling in `docs/PROJECT.md`. **Current test counts are canonical in
`docs/TASK.md`** — reference it, do not hardcode counts here or elsewhere.

**Counting caveat:** if new tests are added with data providers (`#[DataProvider]`,
`it.each`, `test.each`) or parameterized loops, the *static declaration count* will
be lower than the *runtime count* (each provider row expands to one executed test).
Report which number you mean when the two differ.

## Tools — Which One, Where

| Layer | Tool | Command |
|---|---|---|
| Backend feature/unit | PHPUnit | `php artisan test` |
| Frontend unit | Vitest | `npm run test` |
| Frontend component | Vitest + React Testing Library | `npm run test` |
| E2E | Playwright | `npm run test:e2e` |
| Accessibility audit | @axe-core/playwright | `npm run test:a11y` |
| Contrast a11y audit (fast) | @axe-core/playwright | `npm run test:a11y:contrast` |

## The Testing Pyramid

```
        ▲
       / \      E2E (Playwright) — critical user flows
      /___\
     /     \    Integration — component + hook + API
    /_______\
   Unit — pure components, logic, utilities
```

| Test type | Test this | Don't test this |
|---|---|---|
| Unit | Pure logic, utilities, simple components | Implementation details |
| Integration | Component + hook, component + form | External APIs (mock them) |
| E2E | Full user flows, navigation, auth | Internal state |

For TamashaRoom specifically, the highest-value E2E flows are: create a
room → share invite → second user joins → playback stays in sync; owner
kicks/transfers ownership; subtitle upload and rendering. These involve
multiple systems (auth, polling, Eloquent) and are exactly where bugs hide
that unit tests won't catch.

## What Makes a Component Testable

A component you can't test in under 5 minutes needs redesign, not a
cleverer test. Testability requirements:

1. **Props are the only input** — no hidden dependencies on global stores or
   direct API calls inside the component.
2. **Predictable output** — same props, same rendered output, every time.
3. **Side effects are explicit** — data fetching, navigation, and analytics
   are injected via props/hooks that can be mocked, not called directly.
4. **No direct global state access** — read through a hook or prop that a
   test can substitute.

```tsx
// ✅ Testable — props only, predictable
function StatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return <span>{status === 'active' ? 'Active' : 'Inactive'}</span>;
}
expect(render(<StatusBadge status="active" />).textContent).toBe('Active');

// ❌ Untestable — hidden dependency on a global store
function UserName() {
  const user = useAuthStore(); // can't mock without full store setup
  return <span>{user.name}</span>;
}
```

## Backend Testing (PHPUnit)

- Feature tests hit real routes through the full HTTP stack (middleware,
  Form Requests, Policies) — this is where authorization and validation
  bugs get caught. Follow the existing pattern in `SecurityTest` for
  anything touching auth, headers, or rate limits.
- Unit tests target isolated logic — services like `UrlSecurityService`,
  value objects, anything with branching logic worth testing without HTTP
  overhead. Reflection is an accepted pattern for exercising private
  methods (see `UrlSecurityServiceTest`, `VideoStreamTest`).
- Test error paths as thoroughly as happy paths: an unauthorized user hitting
  a room they don't belong to, a malformed subtitle upload, an expired
  invite code, a rate limit exceeded.

## Frontend Testing (Vitest + RTL)

- Test behavior, not implementation — assert on what the user sees/can do,
  not on internal state or which hook fired.
- Tests are deterministic: no real timers (use fake timers for anything
  polling-related), no randomness, no reliance on real network calls (mock
  the fetch layer).
- The `use-playback-sync` hook and any polling-based hook are prime unit-test
  candidates precisely because they're isolated from rendering — test the
  hook's state transitions directly rather than only through a rendered component.
- **Inertia page tests**: mock every `@inertiajs/react` export a page uses —
  pages rendering `<Head>` need `Head: () => null` in the mock or the render
  throws. Assert a toggleable form by its control (`getByLabelText`), not a
  persistent section heading; keep rendered fixtures complete against the
  component's exported prop type (missing required fields fail `type-check`).

## Before Any Refactor

Never refactor without tests covering the code first (see `code-review-rules`).
If coverage is missing, write the test that captures current behavior, confirm
it passes, then refactor, then confirm it still passes.

## Verification Escalation — Run Only What the Change Warrants

Escalate only when lower levels provably cover the change. Do not default to
the full suite; a doc-only or isolated change stops at Level 1–2.

| Level | Scope | When |
|---|---|---|
| **1** | Static/format/lint **for the edited files** | Every code change, before anything else |
| **2** | **Targeted** test for the affected subsystem | The behavior changed; `--filter=` or single-file vitest |
| **3** | Related integration / E2E / a11y test | Flow spans systems (join→playback→chat) or touches UI (`npm run test:a11y:contrast` when modifying components/pages) |
| **4** | **Full** suite (`php artisan test`, `npm run test`, `test:e2e`, `test:a11y`) | Only when the change is broadly reachable (below) |

**Level 4 (full suite) is required only for:** shared infrastructure changes;
cross-cutting behavior; authentication/authorization; database/schema;
routing; core playback/synchronization; dependencies/config; and the
pre-push verification sequence. For anything else, stop at the matched level.

See `docs/TASK.md` (canonical counts) and the test-location index in
`docs/MAP.md`. Command names (not custom) come from AGENTS.md / package.json —
never invent commands.

## Checklist

- Unit tests exist for business logic and utilities.
- Integration tests exist for user flows involving multiple components/hooks.
- Critical cross-system flows (room join, playback sync, ownership transfer)
  have E2E coverage.
- Error paths are tested, not just happy paths.
- Tests are deterministic — no flaky timing or randomness.
- New/changed interactive UI has an accessibility audit pass
  (`@axe-core/playwright`).
- A component that's hard to test is treated as a design smell, not a
  testing problem — see `react-rules` for the fix.
