import DangerButton from "@/Components/DangerButton";
import InputError from "@/Components/InputError";
import InputLabel from "@/Components/InputLabel";
import Modal from "@/Components/Modal";
import SecondaryButton from "@/Components/SecondaryButton";
import TextInput from "@/Components/TextInput";
import { useForm } from "@inertiajs/react";
import { FormEventHandler, useRef, useState } from "react";

export default function DeleteUserForm({
    className = "",
}: {
    className?: string;
}) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const {
        data,
        setData,
        delete: destroy,
        processing,
        reset,
        errors,
        clearErrors,
    } = useForm({
        password: "",
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
    };

    const deleteUser: FormEventHandler = (e) => {
        e.preventDefault();

        destroy(route("profile.destroy"), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);

        clearErrors();
        reset();
    };

    return (
        <section className={`space-y-6 ${className}`}>
            <header>
                <h2 className="text-lg font-medium text-foreground">
                    حذف حساب کاربری
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                    پس از حذف حساب کاربری، تمام اطلاعات و داده‌های شما برای
                    همیشه حذف خواهند شد. قبل از حذف، لطفاً اطلاعات مورد نیاز خود
                    را ذخیره کنید.
                </p>
            </header>

            <DangerButton onClick={confirmUserDeletion}>
                حذف حساب کاربری
            </DangerButton>

            <Modal show={confirmingUserDeletion} onClose={closeModal}>
                <form onSubmit={deleteUser} className="p-6">
                    <h2 className="text-lg font-medium text-foreground">
                        آیا از حذف حساب خود مطمئن هستید؟
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                        پس از حذف حساب کاربری، تمام اطلاعات و داده‌های شما برای
                        همیشه حذف خواهند شد. لطفاً رمز عبور خود را وارد کنید تا
                        حذف حساب تأیید شود.
                    </p>

                    <div className="mt-6">
                        <InputLabel
                            htmlFor="password"
                            value="رمز عبور"
                            className="sr-only"
                        />

                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            ref={passwordInput}
                            value={data.password}
                            onChange={(e) =>
                                setData("password", e.target.value)
                            }
                            className="mt-1 block w-3/4"
                            isFocused
                            placeholder="رمز عبور"
                        />

                        <InputError
                            message={errors.password}
                            className="mt-2"
                        />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeModal}>
                            انصراف
                        </SecondaryButton>

                        <DangerButton className="ms-3" disabled={processing}>
                            حذف حساب
                        </DangerButton>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
