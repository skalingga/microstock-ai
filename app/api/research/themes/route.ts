import { handleGenerate } from "@/lib/api/generate-route";
import { ProviderError } from "@/lib/providers/errors";
import { eventsInPeriod, REGIONS, type RegionId } from "@/lib/research/calendar";
import { themesRequestSchema } from "@/lib/research/schemas";
import { findBannedWords } from "@/lib/settings/banned";

// Stay under Vercel's 60s Hobby limit (CLAUDE.md rule 3); the provider call itself times out at 55s.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleGenerate({
    request,
    schema: themesRequestSchema,
    kind: "themes",
    textToCheck: (input) => input.category ?? "",
    run: async (provider, input, { bannedWords }) => {
      const region = REGIONS.find((r) => r.value === input.region);
      const events = eventsInPeriod(
        input.region as RegionId,
        new Date(`${input.periodStart}T00:00:00Z`),
        new Date(`${input.periodEnd}T00:00:00Z`),
      );

      const result = await provider.generateThemes({
        region: region?.label ?? input.region,
        events: events.map((e) => ({ name: e.name, date: e.date, weight: e.weight })),
        category: input.category,
        count: input.count,
      });

      // Ideas that name a banned term are dropped, like concepts in the generate flow.
      const clean = result.themes.filter(
        (t) => findBannedWords(`${t.title} ${t.keywords.join(" ")}`, bannedWords).length === 0,
      );
      if (clean.length === 0) {
        throw new ProviderError("bad_output", "Semua tema yang dihasilkan mengandung kata terlarang. Coba lagi.");
      }

      const themes = clean.map((t) => {
        const event = events.find((e) => e.name.toLowerCase() === t.event.toLowerCase());
        return { ...t, event: event?.name ?? "", eventDate: event?.date ?? null, uploadBy: event?.uploadBy ?? null, eventWeight: event?.weight ?? 2 };
      });
      return { ...result, themes };
    },
  });
}
