import { Button } from "@/Components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/Components/ui/dialog";
import { useProfileDialogStore } from "@/stores/profile-dialog";
import UpdatePasswordForm from "@/Pages/Profile/Partials/UpdatePasswordForm";
import UpdateProfileInformationForm from "@/Pages/Profile/Partials/UpdateProfileInformationForm";
import { router } from "@inertiajs/react";

/**
 * Global Profile dialog, opened from the app header avatar/name.
 * Reuses the Profile page account forms (same components, same routes),
 * so validation and submission behavior are identical to `/profile` —
 * that route stays intact for deep links. `mustVerifyEmail` mirrors the
 * ProfileController predicate (`$user instanceof MustVerifyEmail`), which
 * is false while email verification stays unenforced for MVP.
 *
 * Account deletion is deliberately NOT embedded: DeleteUserForm renders
 * its own legacy (HeadlessUI) modal, and nesting it inside this native
 * top-layer dialog breaks its cancel path (verified: the confirm's cancel
 * button never becomes clickable — focus/scroll fight between the two
 * modal layers). Deletion stays on the `/profile` page, linked below.
 */
export function ProfileDialog() {
    const open = useProfileDialogStore((s) => s.open);
    const setOpen = useProfileDialogStore((s) => s.setOpen);

    const goToDeleteAccount = () => {
        setOpen(false);
        router.visit(route("profile.edit"));
    };

    return (
        <Dialog open={open} onClose={() => setOpen(false)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>پروفایل</DialogTitle>
                    <DialogDescription>
                        اطلاعات حساب کاربری خود را مدیریت کنید.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-8">
                    <UpdateProfileInformationForm mustVerifyEmail={false} />
                    <UpdatePasswordForm />
                    <section>
                        <header>
                            <h2 className="text-lg font-medium text-foreground">
                                حذف حساب کاربری
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                به دلیل حساس بودن این عمل، حذف حساب فقط از طریق
                                صفحه پروفایل انجام می‌شود.
                            </p>
                        </header>
                        <Button
                            variant="destructive"
                            className="mt-4"
                            onClick={goToDeleteAccount}
                        >
                            رفتن به صفحه پروفایل
                        </Button>
                    </section>
                </div>
            </DialogContent>
        </Dialog>
    );
}
