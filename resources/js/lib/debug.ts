/**
 * Namespaced, `VITE_DEBUG`-gated debug logger.
 *
 * Enabled only when the build/dev environment has `VITE_DEBUG=true`. Vite
 * statically replaces `import.meta.env.VITE_DEBUG` with the literal value at
 * build time, so in a production build `enabled` folds to `false`, the
 * `if (!enabled) return;` guard makes every `debug()` call an empty early
 * return, and the `console.debug` bodies are eliminated by the bundler +
 * minifier. Nothing is emitted unless a debug build was made deliberately.
 *
 * Scopes are namespaced as `[debug:<topic>]` to match the backend convention
 * `Log::debug('[debug:<topic>]', [...])` — see the `debugging` skill.
 *
 * Usage:
 *   import { debug, enableDebugScope } from "@/lib/debug";
 *   enableDebugScope("playback");            // opt in for a session
 *   debug("playback", "position corrected", { from: 3.1, to: 9.4 });
 *   // → [debug:playback] position corrected { from: 3.1, to: 9.4 }
 */
const enabled = import.meta.env.VITE_DEBUG === "true";

const activeScopes = new Set<string>();

/** Opt in to a specific namespace for the current session. */
export function enableDebugScope(scope: string): void {
    activeScopes.add(scope);
}

/** Whether `debug(scope, ...)` would emit anything right now. */
export function debugEnabled(scope: string): boolean {
    return enabled && activeScopes.has(scope);
}

/**
 * Log `[debug:<scope>] <message> ...args` — a no-op unless the build has
 * `VITE_DEBUG=true` and the scope has been enabled.
 */
export function debug(
    scope: string,
    message: string,
    ...args: unknown[]
): void {
    if (!enabled || !activeScopes.has(scope)) return;
    // eslint-disable-next-line no-console -- deliberate, VITE_DEBUG-gated output
    console.debug(`[debug:${scope}]`, message, ...args);
}
