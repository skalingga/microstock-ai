import type { StyleId } from "@/lib/settings/schema";

// One clean reference SVG per style, shown to the model as a quality bar (few-shot). The subjects are
// deliberately neutral so the model copies the structure, not the picture. Every example passes the
// app's own QC: grouped with ids, flat fills, no text, within the viewBox (the tile joins at the edges).

export const SVG_EXAMPLES: Record<StyleId, string> = {
  icon_set: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<g id="pot"><path d="M176 330h160l-20 120a16 16 0 0 1-16 14H212a16 16 0 0 1-16-14z" fill="#C8643C"/><rect x="164" y="306" width="184" height="36" rx="10" fill="#E07A4A"/><rect x="190" y="352" width="132" height="10" rx="5" fill="#B0532F"/></g>
<g id="stem"><rect x="250" y="170" width="12" height="140" rx="6" fill="#3F8F5A"/></g>
<g id="leaves"><path d="M256 230C256 170 210 140 160 150C160 200 200 235 256 230z" fill="#4FB26D"/><path d="M256 200C256 140 300 110 352 120C352 170 312 205 256 200z" fill="#6CC983"/><path d="M256 270C256 235 280 215 316 220C316 255 292 275 256 270z" fill="#4FB26D"/></g>
<g id="shine"><circle cx="196" cy="168" r="8" fill="#8FDCA0"/><circle cx="318" cy="136" r="8" fill="#9BE3AB"/></g>
</svg>`,

  seamless_pattern: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect id="ground" width="512" height="512" fill="#FDF3E1"/>
<g id="flowers" fill="#E8744F"><circle cx="256" cy="256" r="52"/><circle cx="0" cy="0" r="52"/><circle cx="512" cy="0" r="52"/><circle cx="0" cy="512" r="52"/><circle cx="512" cy="512" r="52"/></g>
<g id="centers" fill="#FFD166"><circle cx="256" cy="256" r="20"/><circle cx="0" cy="0" r="20"/><circle cx="512" cy="0" r="20"/><circle cx="0" cy="512" r="20"/><circle cx="512" cy="512" r="20"/></g>
<g id="leaves" fill="#4F9D77"><polygon points="256,-44 296,0 256,44 216,0"/><polygon points="256,468 296,512 256,556 216,512"/><polygon points="-44,256 0,216 44,256 0,296"/><polygon points="468,256 512,216 556,256 512,296"/></g>
<g id="dots" fill="#F4B6A0"><circle cx="128" cy="128" r="14"/><circle cx="384" cy="128" r="14"/><circle cx="128" cy="384" r="14"/><circle cx="384" cy="384" r="14"/></g>
</svg>`,

  flat_illustration: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
<rect id="sky" width="800" height="600" fill="#CFE8F7"/>
<circle id="sun" cx="650" cy="120" r="60" fill="#FFD166"/>
<path id="hills" d="M0 430C150 360 300 380 420 430C540 380 680 360 800 420V600H0z" fill="#8CCB8A"/>
<rect id="ground" y="470" width="800" height="130" fill="#5FAE6E"/>
<g id="cabin"><rect x="250" y="300" width="220" height="170" fill="#F2C98A"/><polygon points="230,305 360,200 490,305" fill="#C8553D"/><rect x="335" y="380" width="50" height="90" rx="6" fill="#7A4E2D"/><rect x="275" y="340" width="45" height="45" rx="4" fill="#BFE3F5"/><rect x="400" y="340" width="45" height="45" rx="4" fill="#BFE3F5"/></g>
<g id="tree"><rect x="560" y="360" width="24" height="110" fill="#7A4E2D"/><circle cx="572" cy="330" r="60" fill="#3E9B5F"/><circle cx="535" cy="365" r="40" fill="#4FB26D"/><circle cx="610" cy="365" r="42" fill="#4FB26D"/></g>
</svg>`,

  badge_label: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<g id="ribbon"><path d="M196 430L170 500L214 484L236 504L246 440z" fill="#D64545"/><path d="M316 430L342 500L298 484L276 504L266 440z" fill="#D64545"/></g>
<path id="shield" d="M256 56L420 112V250C420 350 350 420 256 456C162 420 92 350 92 250V112z" fill="#2F4B7C"/>
<path id="inner" d="M256 84L394 130V250C394 335 335 395 256 428C177 395 118 335 118 250V130z" fill="#3A5F9E"/>
<polygon id="star" points="256,160 277,221 342,222 290,261 309,323 256,286 203,323 222,261 170,222 235,221" fill="#F2C14E"/>
</svg>`,

  abstract_background: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 1000">
<rect id="base" width="1500" height="1000" fill="#12355B"/>
<circle id="orb-a" cx="300" cy="250" r="380" fill="#1F5C99"/>
<circle id="orb-b" cx="1250" cy="820" r="460" fill="#2A7FB8"/>
<path id="wave" d="M0 700C300 600 500 800 800 720C1100 640 1300 560 1500 640V1000H0z" fill="#F2A65A"/>
<g id="accents"><circle cx="1100" cy="200" r="140" fill="#F7C873"/><circle cx="400" cy="820" r="90" fill="#12355B"/><circle cx="760" cy="420" r="50" fill="#2A7FB8"/></g>
</svg>`,
};
