import { useEffect, useState } from "react";

export function useFullscreenTarget(): Element | null {
    const [element, setElement] = useState<Element | null>(null);

    useEffect(() => {
        const update = (): void => {
            const fsEl =
                document.fullscreenElement ||
                (document as unknown as { webkitFullscreenElement?: Element })
                    .webkitFullscreenElement ||
                null;
            setElement(fsEl);
        };

        update();

        document.addEventListener("fullscreenchange", update);
        document.addEventListener("webkitfullscreenchange", update);

        return () => {
            document.removeEventListener("fullscreenchange", update);
            document.removeEventListener("webkitfullscreenchange", update);
        };
    }, []);

    return element;
}
