import { cn } from "@/lib/utils";
import { EmojiPicker as FrimoussePicker } from "frimousse";
import { forwardRef } from "react";

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void;
    className?: string;
}

/**
 * Language-neutral emoji picker. Emoji grids are universal UI — this component
 * is deliberately LTR/direction-neutral and never mirrored, per rtl-i18n-policy.
 * Styled for the dark-favored dashboard palette with shadcn-style tokens.
 */
export const EmojiPicker = forwardRef<HTMLDivElement, EmojiPickerProps>(
    ({ onEmojiSelect, className }, ref) => {
        return (
            <FrimoussePicker.Root
                ref={ref}
                onEmojiSelect={({ emoji }) => onEmojiSelect(emoji)}
                className={cn(
                    "flex h-[320px] w-[300px] flex-col bg-card text-card-foreground",
                    className,
                )}
                dir="ltr"
            >
                <FrimoussePicker.Search className="mx-3 my-2 h-9 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
                <FrimoussePicker.Viewport className="relative flex-1 outline-none">
                    <FrimoussePicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                        در حال بارگذاری…
                    </FrimoussePicker.Loading>
                    <FrimoussePicker.Empty className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
                        هیچ شکلی پیدا نشد
                    </FrimoussePicker.Empty>
                    <FrimoussePicker.List
                        className="select-none pb-1.5"
                        components={{
                            CategoryHeader: ({ category, ...props }) => (
                                <div
                                    className="sticky top-0 z-10 bg-card/95 px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground backdrop-blur-sm"
                                    {...props}
                                >
                                    {category.label}
                                </div>
                            ),
                            Row: ({ children, ...props }) => (
                                <div className="scroll-my-1.5 px-2" {...props}>
                                    {children}
                                </div>
                            ),
                            Emoji: ({ emoji, ...props }) => (
                                <button
                                    type="button"
                                    aria-label={emoji.label}
                                    className="flex size-8 items-center justify-center rounded-lg text-xl transition-colors hover:bg-accent data-[active]:bg-accent"
                                    {...props}
                                >
                                    {emoji.emoji}
                                </button>
                            ),
                        }}
                    />
                </FrimoussePicker.Viewport>
            </FrimoussePicker.Root>
        );
    },
);

EmojiPicker.displayName = "EmojiPicker";

export default EmojiPicker;
