// Shared class for native <select> elements so they match the shadcn <Input>: 16px on phones so iOS Safari does not zoom on focus.
export const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-base outline-none md:text-sm transition-colors max-sm:h-11 pointer-coarse:h-11 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30";

// Every action bar pinned above the phone tab bar looks the same below lg: a flat full-width band with a top rule.
// Pages that keep their bar pinned on PC add their own lg: classes (a floating card there, with no tab bar).
export const pinnedBar =
  "max-lg:sticky max-lg:bottom-[var(--tabbar-h)] max-lg:z-20 max-lg:-mx-4 max-lg:rounded-none max-lg:border-0 max-lg:border-t max-lg:bg-card max-lg:px-4 max-lg:py-3 max-lg:shadow-none sm:max-lg:-mx-6 sm:max-lg:px-6";

// Grows a small control to a 44px touch target on phones and touch screens.
export const tapTarget = "max-sm:min-h-11 pointer-coarse:min-h-11";
