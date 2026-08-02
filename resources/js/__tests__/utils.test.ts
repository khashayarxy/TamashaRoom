import { describe, it, expect } from "vitest";
import { extractInviteCode } from "@/lib/utils";

describe("extractInviteCode", () => {
    it("returns a bare code unchanged", () => {
        expect(extractInviteCode("ABC123XYZ")).toBe("ABC123XYZ");
    });

    it("extracts the code from a full join URL", () => {
        expect(
            extractInviteCode("https://tamasharoom.example/rooms/join/ABC123"),
        ).toBe("ABC123");
    });

    it("extracts the code from a relative join path", () => {
        expect(extractInviteCode("/rooms/join/ABC123")).toBe("ABC123");
    });

    it("trims surrounding whitespace from a bare code", () => {
        expect(extractInviteCode("  ABC123  ")).toBe("ABC123");
    });
});
