import { beforeEach, describe, expect, it } from "vitest";
import { useProfileDialogStore } from "@/stores/profile-dialog";

describe("useProfileDialogStore", () => {
    beforeEach(() => {
        useProfileDialogStore.setState({ open: false });
    });

    it("starts closed", () => {
        expect(useProfileDialogStore.getState().open).toBe(false);
    });

    it("setOpen opens and closes the dialog", () => {
        useProfileDialogStore.getState().setOpen(true);
        expect(useProfileDialogStore.getState().open).toBe(true);
        useProfileDialogStore.getState().setOpen(false);
        expect(useProfileDialogStore.getState().open).toBe(false);
    });
});
