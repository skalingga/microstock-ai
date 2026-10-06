function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the banned words/phrases found in `text` (whole words, case-insensitive).
 * The list comes from user_settings.banned_words so it can be edited without a deploy.
 */
export function findBannedWords(text: string, bannedWords: string[]): string[] {
  const found: string[] = [];
  for (const raw of bannedWords) {
    const word = raw.trim();
    if (!word) continue;
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, "iu");
    if (pattern.test(text)) found.push(word);
  }
  return found;
}
