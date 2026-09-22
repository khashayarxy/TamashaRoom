import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubtitleManagerDialog } from "@/Components/composite/subtitle-manager-dialog";

const noop = () => {};
const asyncNoop = async () => {};

function baseProps() {
    return {
        open: true,
        onClose: noop,
        isOwner: false,
        activeTrackId: null as number | null,
        roomDefaultId: null as number | null,
        tracksError: false,
        onUploadTrack: asyncNoop,
        onSelectTrack: noop,
        onFollowDefault: noop,
        onSetDefault: noop,
        onRequestDelete: noop,
    };
}

describe("SubtitleManagerDialog embedded tracks", () => {
    it("shows language and embedded badge only on embedded rows", () => {
        render(
            <SubtitleManagerDialog
                {...baseProps()}
                tracks={[
                    {
                        id: 1,
                        kind: "upload",
                        track_index: null,
                        label: "Manual",
                        language: "fa",
                        original_extension: "vtt",
                        created_at: "2026-08-04T00:00:00.000000Z",
                    },
                    {
                        id: 2,
                        kind: "embedded",
                        track_index: 0,
                        label: "Embedded (PER)",
                        language: "per",
                        original_extension: "mkv",
                        created_at: "2026-08-04T00:00:00.000000Z",
                    },
                ]}
            />,
        );

        expect(screen.getByText("Manual")).toBeInTheDocument();
        expect(screen.getByText(/داخلی/)).toBeInTheDocument();
        expect(screen.getByText(/per/)).toBeInTheDocument();
    });
});
