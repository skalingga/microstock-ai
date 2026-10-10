// Shared class for native <select> elements so they match the shadcn <Input>: 16px on phones so iOS Safari does not zoom on focus.
export const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-base outline-none md:text-sm transition-colors max-sm:h-11 pointer-coarse:h-11 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring dark:bg-input/30";

// Grows a small control to a 44px touch target on phones and touch screens.
export const tapTarget = "max-sm:min-h-11 pointer-coarse:min-h-11";
