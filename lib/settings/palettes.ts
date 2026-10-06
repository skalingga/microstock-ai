import type { Palette } from "./schema";

// Ready-made palettes for popular stock themes. They sit next to the user's own palettes in the
// generate form and need no database change. Colors are flat, harmonious, and print-friendly.

export const PRESET_PALETTES: Palette[] = [
  { name: "Halloween", colors: ["#FF7A1A", "#6B3FA0", "#1F1B2E", "#9BD43B", "#F5E6C8"] },
  { name: "Musim gugur", colors: ["#C8553D", "#F2A65A", "#E9C46A", "#6B705C", "#4A3728"] },
  { name: "Natal", colors: ["#C0392B", "#1E7B4B", "#F4D35E", "#F8F4EC", "#1B2A41"] },
  { name: "Musim panas", colors: ["#FF6B6B", "#FFD93D", "#2EC4B6", "#3A86FF", "#FFF3D6"] },
  { name: "Musim semi", colors: ["#F8A5C2", "#B8E986", "#FFE066", "#7BDFF2", "#6B4E71"] },
  { name: "Musim dingin", colors: ["#2B4C7E", "#7FB7E6", "#DCEBF7", "#9AA5B1", "#1A2A44"] },
  { name: "Alam dan botani", colors: ["#2F6B4F", "#6BAA75", "#C9DDB5", "#8B5E3C", "#F4EFE1"] },
  { name: "Tropis", colors: ["#00A896", "#F9C74F", "#F3722C", "#F94144", "#2D6A4F"] },
  { name: "Retro", colors: ["#E76F51", "#F4A261", "#E9C46A", "#2A9D8F", "#264653"] },
  { name: "Bisnis", colors: ["#1F3A5F", "#3D7EA6", "#8FB8DE", "#F2A541", "#EEF2F6"] },
];

/** The user's own palettes first, then the presets whose names are not already taken. */
export function withPresetPalettes(own: Palette[]): Palette[] {
  const taken = new Set(own.map((p) => p.name.trim().toLowerCase()));
  return [...own, ...PRESET_PALETTES.filter((p) => !taken.has(p.name.toLowerCase()))];
}
