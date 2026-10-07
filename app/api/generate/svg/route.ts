import { handleGenerate } from "@/lib/api/generate-route";
import { IMAGE_REQUEST_BUDGET_MS } from "@/lib/providers/kenari-image";
import { isImageStyle, type StyleId } from "@/lib/settings/schema";
import { svgRequestSchema } from "@/lib/generate/schemas";

// Vercel Hobby with Fluid compute allows up to 300s (vercel.com/docs/functions/limitations, checked 2026-10-07).
// 120s leaves room for the image model of the traced styles, which sometimes needs more than 55s; text calls
// keep their 57s budget inside handleGenerate.
export const maxDuration = 120;

export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: svgRequestSchema,
    kind: "svg",
    usesImageModel: (input) => isImageStyle(input.style),
    budgetMs: (input) => (isImageStyle(input.style) ? IMAGE_REQUEST_BUDGET_MS : undefined),
    modelOverride: (input) => (input.model ? { provider: input.modelProvider ?? "kenari", model: input.model } : undefined),
    textToCheck: (input) => `${input.theme} ${input.concept.subject} ${input.concept.composition}`,
    run: (provider, input) =>
      provider.generateSvg({
        theme: input.theme,
        style: input.style as StyleId,
        concept: input.concept,
        feedback: input.feedback,
      }),
  });
}
