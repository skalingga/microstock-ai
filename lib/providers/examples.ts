import type { StyleId } from "@/lib/settings/schema";

// Reference SVG shown to the model, only for styles where it measurably helped. In the first live test
// the example tripled the cost per SVG (Rp4 to Rp12) without making clipart or backgrounds better, so only
// styles that were failing without one keep it:
// - seamless_pattern: tiles failed the seam check 2 times in 5; the example shows how a shape crossing an
//   edge is repeated on the opposite edge.
// - frame (stage 14): frames came back as thin laurel lines or four lone circles; the example shows a bold
//   band with a rich, symmetric decoration and an empty center.
// Each example passes the app's own QC (grouped, flat fills, no text).

export const SVG_EXAMPLES: Partial<Record<StyleId, string>> = {
  seamless_pattern: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect id="ground" width="512" height="512" fill="#FDF3E1"/>
<g id="flowers" fill="#E8744F"><circle cx="256" cy="256" r="52"/><circle cx="0" cy="0" r="52"/><circle cx="512" cy="0" r="52"/><circle cx="0" cy="512" r="52"/><circle cx="512" cy="512" r="52"/></g>
<g id="centers" fill="#FFD166"><circle cx="256" cy="256" r="20"/><circle cx="0" cy="0" r="20"/><circle cx="512" cy="0" r="20"/><circle cx="0" cy="512" r="20"/><circle cx="512" cy="512" r="20"/></g>
<g id="leaves" fill="#4F9D77"><polygon points="256,-44 296,0 256,44 216,0"/><polygon points="256,468 296,512 256,556 216,512"/><polygon points="-44,256 0,216 44,256 0,296"/><polygon points="468,256 512,216 556,256 512,296"/></g>
<g id="dots" fill="#F4B6A0"><circle cx="128" cy="128" r="14"/><circle cx="384" cy="128" r="14"/><circle cx="128" cy="384" r="14"/><circle cx="384" cy="384" r="14"/></g>
</svg>`,
  frame: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
<g id="band" fill="#2F6B4F"><path fill-rule="evenodd" d="M70 70H930V930H70ZM150 150V850H850V150Z"/></g>
<g id="leaves" fill="#4F9D77"><ellipse cx="250" cy="185" rx="16" ry="36" transform="rotate(-20 250 185)"/><ellipse cx="250" cy="815" rx="16" ry="36" transform="rotate(-20 250 815)"/><ellipse cx="185" cy="250" rx="16" ry="36" transform="rotate(70 185 250)"/><ellipse cx="815" cy="250" rx="16" ry="36" transform="rotate(70 815 250)"/><ellipse cx="350" cy="185" rx="16" ry="36" transform="rotate(20 350 185)"/><ellipse cx="350" cy="815" rx="16" ry="36" transform="rotate(20 350 815)"/><ellipse cx="185" cy="350" rx="16" ry="36" transform="rotate(110 185 350)"/><ellipse cx="815" cy="350" rx="16" ry="36" transform="rotate(110 815 350)"/><ellipse cx="450" cy="185" rx="16" ry="36" transform="rotate(-20 450 185)"/><ellipse cx="450" cy="815" rx="16" ry="36" transform="rotate(-20 450 815)"/><ellipse cx="185" cy="450" rx="16" ry="36" transform="rotate(70 185 450)"/><ellipse cx="815" cy="450" rx="16" ry="36" transform="rotate(70 815 450)"/><ellipse cx="550" cy="185" rx="16" ry="36" transform="rotate(20 550 185)"/><ellipse cx="550" cy="815" rx="16" ry="36" transform="rotate(20 550 815)"/><ellipse cx="185" cy="550" rx="16" ry="36" transform="rotate(110 185 550)"/><ellipse cx="815" cy="550" rx="16" ry="36" transform="rotate(110 815 550)"/><ellipse cx="650" cy="185" rx="16" ry="36" transform="rotate(-20 650 185)"/><ellipse cx="650" cy="815" rx="16" ry="36" transform="rotate(-20 650 815)"/><ellipse cx="185" cy="650" rx="16" ry="36" transform="rotate(70 185 650)"/><ellipse cx="815" cy="650" rx="16" ry="36" transform="rotate(70 815 650)"/><ellipse cx="750" cy="185" rx="16" ry="36" transform="rotate(20 750 185)"/><ellipse cx="750" cy="815" rx="16" ry="36" transform="rotate(20 750 815)"/><ellipse cx="185" cy="750" rx="16" ry="36" transform="rotate(110 185 750)"/><ellipse cx="815" cy="750" rx="16" ry="36" transform="rotate(110 815 750)"/></g>
<g id="petals" fill="#E8744F"><circle cx="130" cy="96" r="26"/><circle cx="162" cy="119" r="26"/><circle cx="150" cy="158" r="26"/><circle cx="110" cy="158" r="26"/><circle cx="98" cy="119" r="26"/><circle cx="870" cy="96" r="26"/><circle cx="902" cy="119" r="26"/><circle cx="890" cy="158" r="26"/><circle cx="850" cy="158" r="26"/><circle cx="838" cy="119" r="26"/><circle cx="130" cy="836" r="26"/><circle cx="162" cy="859" r="26"/><circle cx="150" cy="898" r="26"/><circle cx="110" cy="898" r="26"/><circle cx="98" cy="859" r="26"/><circle cx="870" cy="836" r="26"/><circle cx="902" cy="859" r="26"/><circle cx="890" cy="898" r="26"/><circle cx="850" cy="898" r="26"/><circle cx="838" cy="859" r="26"/></g>
<g id="centers" fill="#FFD166"><circle cx="130" cy="130" r="18"/><circle cx="870" cy="130" r="18"/><circle cx="130" cy="870" r="18"/><circle cx="870" cy="870" r="18"/></g>
<g id="dots" fill="#F4B6A0"><circle cx="300" cy="110" r="9"/><circle cx="300" cy="890" r="9"/><circle cx="110" cy="300" r="9"/><circle cx="890" cy="300" r="9"/><circle cx="400" cy="110" r="9"/><circle cx="400" cy="890" r="9"/><circle cx="110" cy="400" r="9"/><circle cx="890" cy="400" r="9"/><circle cx="500" cy="110" r="9"/><circle cx="500" cy="890" r="9"/><circle cx="110" cy="500" r="9"/><circle cx="890" cy="500" r="9"/><circle cx="600" cy="110" r="9"/><circle cx="600" cy="890" r="9"/><circle cx="110" cy="600" r="9"/><circle cx="890" cy="600" r="9"/><circle cx="700" cy="110" r="9"/><circle cx="700" cy="890" r="9"/><circle cx="110" cy="700" r="9"/><circle cx="890" cy="700" r="9"/></g>
</svg>`,
};

/** One line telling the model what to take from the example, so it never copies the subject. */
export const SVG_EXAMPLE_NOTES: Partial<Record<StyleId, string>> = {
  seamless_pattern: "how shapes crossing an edge are repeated on the opposite edge",
  frame: "a bold outer band with rich, symmetric decoration, and the central square left completely empty",
};
