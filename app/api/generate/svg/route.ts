import { handleGenerate } from "@/lib/api/generate-route";
import type { StyleId } from "@/lib/settings/schema";
import { svgRequestSchema } from "@/lib/generate/schemas";

// Stay under Vercel's 60s Hobby limit (CLAUDE.md rule 3); the provider call itself times out at 45s.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: svgRequestSchema,
    kind: "svg",
    modelOverride: (input) => input.model,
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
