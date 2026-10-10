// The manual upload steps on Adobe's side, ticked per export (exports.checklist_done). Shared by the export page
// and Meja, which reminds about exports whose steps are not done yet.

export type ChecklistStepId = "zip" | "upload" | "ai" | "csv" | "check" | "release";

export const CHECKLIST_STEP_IDS: ChecklistStepId[] = ["zip", "upload", "ai", "csv", "check", "release"];
export const CHECKLIST_STEPS = CHECKLIST_STEP_IDS.length;

/** Exports whose checklist is not finished, and how many of those still miss the required AI label step. */
export function unfinishedUploads(rows: { checklist_done: string[] | null }[]): { unfinished: number; missingAiLabel: number } {
  const open = rows.filter((r) => new Set(r.checklist_done ?? []).size < CHECKLIST_STEPS);
  return { unfinished: open.length, missingAiLabel: open.filter((r) => !(r.checklist_done ?? []).includes("ai")).length };
}
