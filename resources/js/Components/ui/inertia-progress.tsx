import { router } from "@inertiajs/react";
import { useEffect, useState } from "react";

/**
 * ARIA-compliant replacement for Inertia's bundled top progress bar.
 *
 * Inertia's built-in NProgress renders `<div role="bar">`, an invalid ARIA
 * role that fails axe audits. We disable that and render our own thin bar
 * with a proper `progressbar` role and live progress values, driven by the
 * global `inertia:start` / `inertia:progress` / `inertia:finish` events.
 */
const InertiaProgress = () => {
    const [active, setActive] = useState(false);
    const [percentage, setPercentage] = useState(0);

    useEffect(() => {
        const offStart = router.on("start", () => {
            setActive(true);
            setPercentage(0);
        });

        const offProgress = router.on("progress", (event) => {
            const value = event.detail.progress?.percentage;
            if (typeof value === "number") {
                setPercentage(Math.round(Math.min(value, 100)));
            }
        });

        const offFinish = router.on("finish", (event) => {
            if (event.detail.visit.completed) {
                setPercentage(100);
                window.setTimeout(() => setActive(false), 300);
            } else {
                setActive(false);
                setPercentage(0);
            }
        });

        return () => {
            offStart();
            offProgress();
            offFinish();
        };
    }, []);

    if (!active) {
        return null;
    }

    return (
        <div
            className="fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden bg-transparent"
            role="progressbar"
            aria-label="بارگذاری صفحه"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentage}
        >
            <div
                className="h-full bg-primary transition-all duration-200 ease-linear"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
};

export { InertiaProgress };
