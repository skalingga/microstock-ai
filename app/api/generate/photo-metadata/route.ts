import { handleGenerate } from "@/lib/api/generate-route";
import { photoMetadataRequestSchema } from "@/lib/generate/schemas";
import { normalizePhotoMetadata } from "@/lib/metadata/postprocess";

// Stay under Vercel's 60s Hobby limit (CLAUDE.md rule 3); the provider call itself times out at 55s.
export const maxDuration = 60;

// Stage 12: one vision call per uploaded photo gives its metadata and the defects it can see.
export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: photoMetadataRequestSchema,
    kind: "metadata",
    vision: true,
    textToCheck: (input) => `${input.theme} ${input.prompt ?? ""}`,
    run: async (provider, input, { bannedWords }) => {
      const result = await provider.generatePhotoMetadata(input);
      const { metadata, notes } = normalizePhotoMetadata(result.metadata, bannedWords);
      return { metadata, notes, model: result.model, costIdr: result.costIdr, rateLimit: result.rateLimit };
    },
  });
}
