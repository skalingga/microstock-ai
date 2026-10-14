// Shutterstock rules for the trial upload (user's request, 14 Oct 2026). Sources, checked 14 Oct 2026:
//   CSV layout     https://submit.shutterstock.com/help/en/articles/10617486-how-do-i-include-existing-metadata-with-my-content-submission
//   Vectors (EPS)  https://submit.shutterstock.com/help/en/articles/10617412-how-do-i-submit-vector-illustrations-for-review
//   AI policy      https://submit.shutterstock.com/help/en/articles/10594676-ai-generated-content-on-shutterstock-contributor-faq
// Shutterstock does not accept AI-generated content from contributors. The user chose to try anyway and accepts rejection.
// Only photos (JPEG) are exported: vectors must be EPS (Illustrator 8/10), which the app cannot write yet.

import { normalizeCategory, type AdobeCategory } from "@/lib/adobe/rules";

export const SHUTTERSTOCK = {
  /** Header must match Shutterstock's sample exactly; Illustration, Mature Content and Editorial are optional Yes/No. */
  csvHeader: ["Filename", "Description", "Keywords", "Categories", "Illustration", "Mature Content", "Editorial"],
  /** Not on the official CSV page; third-party guides say 7 to 50. */
  keywordsMin: 7,
  keywordsMax: 50,
  /** One or two categories per file. */
  categoriesMax: 2,
} as const;

// Category names as commonly listed for Shutterstock photos. NOT confirmed against an official page: the CSV page only
// says "selected from this list". Compare with the category dropdown in the contributor portal before the first CSV upload.
export const SHUTTERSTOCK_CATEGORIES = [
  "Abstract",
  "Animals/Wildlife",
  "Arts",
  "Backgrounds/Textures",
  "Beauty/Fashion",
  "Buildings/Landmarks",
  "Business/Finance",
  "Celebrities",
  "Education",
  "Food and drink",
  "Healthcare/Medical",
  "Holidays",
  "Industrial",
  "Interiors",
  "Miscellaneous",
  "Nature",
  "Objects",
  "Parks/Outdoor",
  "People",
  "Religion",
  "Science",
  "Signs/Symbols",
  "Sports/Recreation",
  "Technology",
  "Transportation",
  "Vintage",
] as const;

export type ShutterstockCategory = (typeof SHUTTERSTOCK_CATEGORIES)[number];

/** Closest Shutterstock category for each Adobe category the metadata AI picks. */
const FROM_ADOBE: Record<AdobeCategory, ShutterstockCategory> = {
  Animals: "Animals/Wildlife",
  "Buildings and architecture": "Buildings/Landmarks",
  Business: "Business/Finance",
  Drinks: "Food and drink",
  "The environment": "Nature",
  "States of mind": "Abstract",
  Food: "Food and drink",
  "Graphic resources": "Backgrounds/Textures",
  "Hobbies and leisure": "Sports/Recreation",
  Industry: "Industrial",
  Landscape: "Nature",
  Lifestyle: "People",
  People: "People",
  "Plants and flowers": "Nature",
  "Culture and religion": "Religion",
  Science: "Science",
  "Social issues": "People",
  Sports: "Sports/Recreation",
  Technology: "Technology",
  Transport: "Transportation",
  Travel: "Parks/Outdoor",
};

/** One or two Shutterstock categories: the mapped Adobe category, plus "People" when the photo shows people. */
export function shutterstockCategories(adobeCategory: string | null | undefined, showsPeople = false): ShutterstockCategory[] {
  const adobe = normalizeCategory(adobeCategory);
  const main = adobe ? FROM_ADOBE[adobe] : "Miscellaneous";
  return showsPeople && main !== "People" ? [main, "People"] : [main];
}
