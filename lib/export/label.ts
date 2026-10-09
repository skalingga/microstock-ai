/** "Autumn leaves, Coffee cups +2": the themes in an export, most frequent first, for naming it in Riwayat. */
export function exportLabel(groupLabels: string[]): string {
  const counts = new Map<string, number>();
  for (const l of groupLabels) counts.set(l, (counts.get(l) ?? 0) + 1);
  const names = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);
  const shown = names.slice(0, 2).join(", ");
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}
