---
name: output-conventions
description: File naming, import order, comment style, formatting, linting, and commit message conventions for TamashaRoom. Use for any new file, any commit message, or when formatting/organizing code.
---

# Output Conventions

Full detail: `docs/SYSTEM.md`, Chapter 28 (Output Rules).

## File Naming — kebab-case, matching the export

| Type | Convention | Example |
|---|---|---|
| Components | `kebab-case.tsx` | `member-list.tsx`, `room-chat.tsx` |
| Hooks | `use-kebab-case.ts` | `use-playback-sync.ts` |
| Utilities | `kebab-case.ts` | `date-utils.ts` |
| Types | `kebab-case.ts` or `types.ts` | `room-types.ts` |
| Tests | `kebab-case.test.ts` | `member-list.test.tsx` |
| Layouts | `PascalCase.tsx` | `Layouts/AuthenticatedLayout.tsx` |
| Pages | `PascalCase.tsx` (one per route) | `Pages/Rooms/Show.tsx` |

Layouts and Pages are the exception to kebab-case: they live in `Layouts/` and
`Pages/` respectively (see `react-rules`).

## Import Order

Group in this order, separated by blank lines:
1. React / Inertia
2. Third-party libraries
3. Absolute imports (`@/Components`, `@/Hooks`, `@/lib`, `@/stores`)
4. Relative imports (`./`, `../`)
5. Type-only imports (marked with `type`)

```ts
import { useState } from 'react';
import { router } from '@inertiajs/react';

import { create } from 'zustand';
import { z } from 'zod';

import { Button } from '@/Components/ui/button';
import { usePresence } from '@/Hooks/use-presence';

import { MemberList } from './member-list';
import type { Room } from './types';
```

## Comments Explain "Why," Not "What"

```ts
// ✅ Good
// We poll (not push) because this hosting has no WebSocket server — see
// `laravel-backend-rules` for the tiered-cadence pattern.
const { state } = usePlaybackSync(roomId);

// ❌ Bad
// Increment count
const increment = () => setCount(c => c + 1);
// TODO: fix this later
```

## Commit Messages — Conventional Commits

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

| Type | Use for |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Neither a fix nor a feature |
| `perf` | Performance improvement |
| `test` | Adding/correcting tests |
| `docs` | Documentation |
| `style` | Formatting only, no code change |
| `chore` | Build process, dependencies |

Examples:
```
feat(rooms): add kick-member confirmation dialog
fix(playback): resolve drift on reconnect after backgrounding tab
refactor(presence): extract usePresenceHeartbeat from MemberList
```

## Before Any Code Is Delivered

- Formatted with Prettier (`npm run format:check`) and Pint
  (`./vendor/bin/pint --test`); zero ESLint errors (`npm run lint`);
  TypeScript strict-clean (`npm run type-check`).
- File names kebab-case (Layouts/Pages PascalCase); imports grouped and ordered.
- No `console.log` — enforced by ESLint (`no-console`); `console.error` and
  `console.warn` are allowed.
- No commented-out code; no TODO without a ticket reference.
