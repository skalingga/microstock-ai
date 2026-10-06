import { ADOBE, categoryNumber } from "@/lib/adobe/rules";
import { findBannedWords } from "@/lib/settings/banned";
import { NEWS_WORDS } from "./config";
import type { MetadataFields, QcNote } from "./types";

/** Metadata rules: Adobe limits, banned words, news-like titles, category, releases. */
export function checkMetadata(meta: MetadataFields, bannedWords: string[]): QcNote[] {
  const problems: QcNote[] = [];
  const cek = (message: string) => problems.push({ check: "metadata", status: "cek", message });

  const title = (meta.title ?? "").trim();
  if (!title) cek("Judul belum diisi.");
  if (title.length > ADOBE.titleMaxChars) cek(`Judul ${title.length} karakter (maksimal ${ADOBE.titleMaxChars}).`);
  if (title.includes(",")) cek("Judul tidak boleh mengandung koma.");

  if (meta.keywords.length === 0) cek("Keyword belum diisi.");
  if (meta.keywords.length > ADOBE.keywordsMax) {
    cek(`${meta.keywords.length} keyword (maksimal ${ADOBE.keywordsMax}).`);
  }

  const banned = [...new Set([...findBannedWords(title, bannedWords), ...findBannedWords(meta.keywords.join(" "), bannedWords)])];
  if (banned.length > 0) cek(`Mengandung kata terlarang: ${banned.join(", ")}.`);

  const news = findBannedWords(title, NEWS_WORDS);
  if (news.length > 0) cek(`Judul bernuansa berita nyata (${news.join(", ")}). Adobe tidak mengizinkannya.`);

  if (categoryNumber(meta.category) === null) cek("Kategori Adobe belum dipilih atau tidak dikenal.");
  if (meta.needsRelease) cek("Perlu Release: menggambarkan orang atau properti nyata.");

  return problems.length > 0 ? problems : [{ check: "metadata", status: "ok", message: "Metadata lengkap dan sesuai aturan." }];
}
