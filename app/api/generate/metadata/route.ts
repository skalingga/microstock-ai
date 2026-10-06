import { handleGenerate } from "@/lib/api/generate-route";
import { metadataRequestSchema } from "@/lib/generate/schemas";
import { normalizeMetadata } from "@/lib/metadata/postprocess";
import type { StyleId } from "@/lib/settings/schema";

// Stay under Vercel's 60s Hobby limit (CLAUDE.md rule 3); the provider call itself times out at 55s.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: metadataRequestSchema,
    kind: "metadata",
    textToCheck: (input) => `${input.theme} ${input.concept}`,
    run: async (provider, input, { bannedWords }) => {
      const result = await provider.generateMetadata({ ...input, style: input.style as StyleId });
      const { metadata, notes } = normalizeMetadata(result.metadata, bannedWords, input.style as StyleId);
      return { metadata, notes, model: result.model, costIdr: result.costIdr, rateLimit: result.rateLimit };
    },
  });
}
