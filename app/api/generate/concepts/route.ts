import { handleGenerate } from "@/lib/api/generate-route";
import { ProviderError } from "@/lib/providers/errors";
import type { StyleId } from "@/lib/settings/schema";
import { findBannedWords } from "@/lib/settings/banned";
import { unifyPalettes } from "@/lib/generate/concept";
import { conceptsRequestSchema } from "@/lib/generate/schemas";

// Stay under Vercel's 60s Hobby limit (CLAUDE.md rule 3); the provider call itself times out at 55s.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: conceptsRequestSchema,
    kind: "concepts",
    textToCheck: (input) => input.theme,
    run: async (provider, input, { bannedWords }) => {
      const result = await provider.generateConcepts({ ...input, style: input.style as StyleId });

      // The model can slip a banned name into a concept; drop those instead of sending them on.
      const concepts = result.concepts.filter(
        (c) => findBannedWords(`${c.subject} ${c.composition}`, bannedWords).length === 0,
      );
      if (concepts.length === 0) {
        throw new ProviderError("bad_output", "Semua konsep yang dihasilkan mengandung kata terlarang. Coba lagi.");
      }
      return { ...result, concepts: unifyPalettes(concepts, input.palette) };
    },
  });
}
