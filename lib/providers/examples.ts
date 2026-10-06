import type { StyleId } from "@/lib/settings/schema";

// Reference SVG shown to the model, only for styles where it measurably helped. In the first live test
// the example tripled the cost per SVG (Rp4 to Rp12) without making clipart or backgrounds better, so only
// the seamless pattern keeps one: tiles failed the seam check 2 times in 5, and the example shows how a
// shape crossing an edge is repeated on the opposite edge. It passes the app's own QC (grouped, flat fills).

export const SVG_EXAMPLES: Partial<Record<StyleId, string>> = {
  seamless_pattern: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect id="ground" width="512" height="512" fill="#FDF3E1"/>
<g id="flowers" fill="#E8744F"><circle cx="256" cy="256" r="52"/><circle cx="0" cy="0" r="52"/><circle cx="512" cy="0" r="52"/><circle cx="0" cy="512" r="52"/><circle cx="512" cy="512" r="52"/></g>
<g id="centers" fill="#FFD166"><circle cx="256" cy="256" r="20"/><circle cx="0" cy="0" r="20"/><circle cx="512" cy="0" r="20"/><circle cx="0" cy="512" r="20"/><circle cx="512" cy="512" r="20"/></g>
<g id="leaves" fill="#4F9D77"><polygon points="256,-44 296,0 256,44 216,0"/><polygon points="256,468 296,512 256,556 216,512"/><polygon points="-44,256 0,216 44,256 0,296"/><polygon points="468,256 512,216 556,256 512,296"/></g>
<g id="dots" fill="#F4B6A0"><circle cx="128" cy="128" r="14"/><circle cx="384" cy="128" r="14"/><circle cx="128" cy="384" r="14"/><circle cx="384" cy="384" r="14"/></g>
</svg>`,
};
