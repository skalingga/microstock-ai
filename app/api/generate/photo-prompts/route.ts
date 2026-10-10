import { handleGenerate } from "@/lib/api/generate-route";
import { photoPromptsRequestSchema } from "@/lib/generate/schemas";
import { ProviderError } from "@/lib/providers/errors";
import { findBannedWords } from "@/lib/settings/banned";

// Stay under Vercel's 60s Hobby limit (CLAUDE.md rule 3); the provider call itself times out at 55s.
export const maxDuration = 60;

// Stage 12: prompts the user copies into Google Flow. The app never calls Flow itself.
export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: photoPromptsRequestSchema,
    kind: "concepts",
    textToCheck: (input) => input.theme,
    run: async (provider, input, { bannedWords }) => {
      const result = await provider.generatePhotoPrompts(input);
      // The model can slip a banned name into a prompt; drop those instead of showing them.
      const prompts = result.prompts.filter((p) => findBannedWords(`${p.subject} ${p.prompt}`, bannedWords).length === 0);
      if (prompts.length === 0) {
        throw new ProviderError("bad_output", "Semua prompt yang dihasilkan mengandung kata terlarang. Coba lagi.");
      }
      return { ...result, prompts };
    },
  });
}
