/**
 * Decide whether a source change should preserve the playback position.
 *
 * TamashaRoom switches the transport from the proxy URL to the direct URL for
 * the SAME video when the proxy errors. A v10 `loadSource()` swap mutates the
 * same <video> element but natively resets `currentTime` to 0, which would
 * yank the whole room back to the start. Preserve only when the content
 * identity (`videoUrl`) is unchanged; a genuinely new video (URL changed) must
 * reset.
 */
export function shouldPreservePositionOnSourceChange(params: {
    previousSrc: string | null;
    nextSrc: string | undefined;
    previousVideoUrl: string | null;
    nextVideoUrl: string | null;
}): boolean {
    const { previousSrc, nextSrc, previousVideoUrl, nextVideoUrl } = params;

    return (
        previousSrc !== null &&
        nextSrc !== undefined &&
        previousSrc !== nextSrc &&
        previousVideoUrl !== null &&
        nextVideoUrl !== null &&
        previousVideoUrl === nextVideoUrl
    );
}
