import { useEffect } from "react";
import { usePlayer } from "@videojs/react";

/**
 * The lock/unlock surface of ScreenOrientation. Deliberately local: the
 * installed TypeScript lib types ScreenOrientation without these members
 * (they are mobile-only), and lock is additionally absent at runtime on
 * iOS Safari — hence fully optional here.
 */
interface LockableOrientation {
    lock?: (orientation: "landscape") => Promise<void>;
    unlock?: () => void;
}

/**
 * Lock the screen to landscape while the player is fullscreen and release
 * the lock on exit — the standard mobile video-fullscreen behavior.
 *
 * The Screen Orientation lock API only applies on mobile browsers and only
 * while fullscreen; it is absent entirely on iOS Safari and rejects on
 * platforms that cannot control orientation (desktop browsers). Every
 * unsupported path is a deliberate no-op: fullscreen must never fail
 * because the orientation lock could not be taken.
 */
export function useFullscreenOrientationLock(): void {
    const isFullscreen = usePlayer((s) => s.fullscreen);

    useEffect(() => {
        if (!isFullscreen) return;

        const orientation = (
            typeof screen !== "undefined" ? screen.orientation : undefined
        ) as LockableOrientation | undefined;
        if (
            orientation === undefined ||
            typeof orientation.lock !== "function"
        ) {
            return;
        }

        orientation.lock("landscape").catch(() => {
            // Unsupported or denied (e.g. desktop rejects orientation locks);
            // staying fullscreen without the lock is fine.
        });

        return () => {
            orientation.unlock?.();
        };
    }, [isFullscreen]);
}
