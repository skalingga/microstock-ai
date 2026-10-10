"use client";

import { useId } from "react";
import { STYLES, type StyleId } from "@/lib/settings/schema";

// Hand-drawn examples of each style for the Generate page, so the style picker is not text only.
// They show the shape of the output, not a real AI result.

const DEFAULT_COLORS = ["#D35400", "#F39C12", "#7E5109", "#27AE60", "#FDF2E0"];

const DESCRIPTIONS: Record<StyleId, string> = {
  icon_set: "Satu objek, latar transparan. Untuk clipart dan stiker.",
  seamless_pattern: "Ubin yang menyambung tanpa batas. Untuk kain dan kertas kado.",
  flat_illustration: "Adegan sederhana 4:3 dengan latar. Untuk artikel dan poster.",
  badge_label: "Lencana atau pita tanpa tulisan. Untuk label dan promo.",
  abstract_background: "Geometris penuh 3:2, ada ruang untuk teks. Untuk slide dan banner.",
  silhouette: "Siluet hitam padat dari model gambar. Untuk bentuk lengkung seperti hewan.",
  line_art: "Garis hitam isi putih dari model gambar. Untuk kendaraan dan benda berdetail.",
  line_icon: "Ikon dari garis dengan tebal seragam, satu warna. Untuk set ikon antarmuka.",
  glyph_icon: "Ikon padat satu atau dua warna, tanpa garis tepi. Untuk set ikon antarmuka.",
  geometric_tile: "Ubin persegi dengan motif geometris simetris. Untuk set ubin dan pola dekoratif.",
};

function lightness(hex: string): number {
  const full = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : hex;
  const n = parseInt(full.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}

/** Five colors from the chosen palette (padded with the default autumn colors); the lightest goes last, as background. */
function pickColors(palette: string[]): string[] {
  const colors = palette.slice(0, 5);
  for (const c of DEFAULT_COLORS) {
    if (colors.length >= 5) break;
    if (!colors.includes(c)) colors.push(c);
  }
  const lightest = colors.reduce((best, c) => (lightness(c) > lightness(best) ? c : best));
  return [...colors.filter((c) => c !== lightest), lightest];
}

export function styleDescription(style: StyleId): string {
  return DESCRIPTIONS[style];
}

/** Styles whose output has a transparent background, shown over the checkerboard. */
export function isTransparentStyle(style: StyleId): boolean {
  return ["icon_set", "badge_label", "silhouette", "line_art", "line_icon", "glyph_icon"].includes(style);
}

export function StylePreview({ style, palette }: { style: StyleId; palette: string[] }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`relative w-full max-w-28 shrink-0 sm:max-w-40 overflow-hidden rounded-lg border ${isTransparentStyle(style) ? "bg-checker" : ""}`}>
        <span className="absolute top-1.5 left-1.5 rounded-sm bg-card px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Contoh
        </span>
        <StyleArt style={style} palette={palette} label={`Contoh gaya ${STYLES.find((s) => s.value === style)?.label ?? style}`} />
      </div>
      <p className="text-sm text-muted-foreground">{DESCRIPTIONS[style]}</p>
    </div>
  );
}

/** The hand-drawn example on its own, for small style tiles. Decorative unless a label is given. */
export function StyleArt({ style, palette, label, className }: { style: StyleId; palette: string[]; label?: string; className?: string }) {
  const patternId = useId();
  const [a, b, c, d, bg] = pickColors(palette);

  return (
    <svg
      viewBox={VIEWBOX[style]}
      className={className ?? "block h-auto w-full"}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {style === "icon_set" && (
        <>
          <ellipse cx="256" cy="300" rx="150" ry="125" fill={a} />
          <ellipse cx="256" cy="300" rx="60" ry="125" fill={b} />
          <path d="M246 180 Q250 130 280 110 L292 124 Q270 140 268 180Z" fill={c} />
          <path d="M272 140 Q330 100 360 140 Q320 160 272 140Z" fill={d} />
        </>
      )}
      {style === "seamless_pattern" && (
        <>
          <defs>
            <pattern id={patternId} width="128" height="128" patternUnits="userSpaceOnUse">
              <rect width="128" height="128" fill={bg} />
              <path d="M30 70 Q30 30 70 25 Q72 65 30 70Z" fill={a} />
              <path d="M90 120 Q92 90 120 86 Q118 116 90 120Z" fill={b} />
              <circle cx="100" cy="35" r="7" fill={c} />
              <circle cx="20" cy="112" r="5" fill={d} />
            </pattern>
          </defs>
          <rect width="512" height="512" fill={`url(#${patternId})`} />
          <rect x="1" y="1" width="255" height="255" fill="none" stroke={c} strokeDasharray="8 8" strokeWidth="3" />
        </>
      )}
      {style === "flat_illustration" && (
        <>
          <rect width="800" height="600" fill={bg} />
          <circle cx="620" cy="140" r="70" fill={b} />
          <path d="M0 420 Q200 320 420 400 T800 380 V600 H0Z" fill={b} opacity="0.6" />
          <path d="M0 480 Q250 420 500 470 T800 460 V600 H0Z" fill={a} />
          <rect x="170" y="300" width="18" height="140" fill={c} />
          <circle cx="179" cy="270" r="70" fill={d} />
          <ellipse cx="420" cy="500" rx="55" ry="42" fill={b} />
          <ellipse cx="520" cy="510" rx="40" ry="30" fill={c} />
        </>
      )}
      {style === "badge_label" && (
        <>
          <path d="M150 330 L110 450 L170 420 L200 470 L230 350Z" fill={c} />
          <path d="M362 330 L402 450 L342 420 L312 470 L282 350Z" fill={c} />
          <circle cx="256" cy="230" r="150" fill={a} />
          <circle cx="256" cy="230" r="118" fill="none" stroke={bg} strokeWidth="10" strokeDasharray="4 14" />
          <path d="M256 150 Q300 200 256 310 Q212 200 256 150Z" fill={b} />
          <path d="M256 175 V295" stroke={c} strokeWidth="6" />
        </>
      )}
      {style === "silhouette" && (
        <g fill="#111111">
          <path d="M256 236 C230 200 170 170 60 190 C110 205 120 240 110 262 C150 250 175 262 182 290 C205 270 235 268 256 290 C277 268 307 270 330 290 C337 262 362 250 402 262 C392 240 402 205 452 190 C342 170 282 200 256 236Z" />
          <path d="M240 214 L246 192 L256 206 L266 192 L272 214Z" />
          <path d="M130 380 C118 360 92 348 50 356 C70 362 74 376 70 386 C86 381 96 386 99 397 C108 389 120 388 130 397 C140 388 152 389 161 397 C164 386 174 381 190 386 C186 376 190 362 210 356 C168 348 142 360 130 380Z" />
          <path d="M390 400 C380 384 358 374 324 381 C340 386 343 397 340 405 C353 401 361 405 363 414 C370 408 381 407 390 414 C399 407 410 408 417 414 C419 405 427 401 440 405 C437 397 440 386 456 381 C422 374 400 384 390 400Z" />
        </g>
      )}
      {style === "line_art" && (
        <g stroke="#111111" strokeWidth="8" strokeLinejoin="round" fill="#ffffff">
          <path d="M40 300 L52 250 C90 236 130 232 160 230 L200 180 C230 160 300 160 330 178 L370 226 C420 230 460 240 476 262 L480 300 Z" />
          <path d="M214 190 L200 228 L268 228 L268 182 C244 180 228 182 214 190Z" />
          <path d="M286 182 L286 228 L350 228 L322 190 C312 184 300 182 286 182Z" />
          <circle cx="140" cy="300" r="42" fill="#111111" />
          <circle cx="140" cy="300" r="20" />
          <circle cx="390" cy="300" r="42" fill="#111111" />
          <circle cx="390" cy="300" r="20" />
          <path d="M60 268 L470 268" fill="none" />
        </g>
      )}
      {style === "line_icon" && (
        <g fill="none" stroke={a} strokeWidth="24" strokeLinecap="round" strokeLinejoin="round">
          <path d="M110 400 C110 220 220 110 400 112 C400 290 300 400 110 400Z" />
          <path d="M110 400 L300 210" />
          <path d="M250 262 L250 200 M300 210 L360 210" />
        </g>
      )}
      {style === "glyph_icon" && (
        <>
          <path d="M110 400 C110 220 220 110 400 112 C400 290 300 400 110 400Z" fill={a} />
          <path d="M110 400 L300 210" fill="none" stroke={bg} strokeWidth="20" strokeLinecap="round" />
          <circle cx="380" cy="380" r="36" fill={b} />
        </>
      )}
      {style === "geometric_tile" && (
        <>
          <rect x="24" y="24" width="464" height="464" rx="48" fill={a} />
          <circle cx="256" cy="256" r="150" fill="none" stroke={bg} strokeWidth="20" />
          <path d="M256 106 L406 256 L256 406 L106 256Z" fill={b} />
          <circle cx="256" cy="256" r="44" fill={bg} />
        </>
      )}
      {style === "abstract_background" && (
        <>
          <rect width="1500" height="1000" fill={bg} />
          <circle cx="1350" cy="120" r="380" fill={b} />
          <circle cx="150" cy="950" r="320" fill={a} />
          <path d="M0 0 H520 L0 420Z" fill={b} opacity="0.6" />
          <path d="M1500 1000 H950 L1500 560Z" fill={c} />
          <rect x="1150" y="620" width="140" height="140" rx="20" fill={d} />
        </>
      )}
    </svg>
  );
}

// Same canvas shapes as the generate prompts (lib/providers/prompts.ts).
const VIEWBOX: Record<StyleId, string> = {
  icon_set: "0 0 512 512",
  seamless_pattern: "0 0 512 512",
  flat_illustration: "0 0 800 600",
  badge_label: "0 0 512 512",
  abstract_background: "0 0 1500 1000",
  silhouette: "0 0 512 512",
  line_art: "0 0 512 512",
  line_icon: "0 0 512 512",
  glyph_icon: "0 0 512 512",
  geometric_tile: "0 0 512 512",
};
