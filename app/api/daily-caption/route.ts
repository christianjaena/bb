import { NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export const dynamic = "force-dynamic";

const FALLBACK_CAPTIONS = [
  "Saving you a seat for our next call.",
  "My favourite view is still you on the screen.",
  "Wish you were here. I saved you the good side.",
  "Same us, slightly inconvenient geography.",
  "Next call: you, me, and an unnecessary amount of snacks.",
];

export async function GET() {
  const generated = await generateGeminiText(
    "Write one short photo caption for a private long-distance couple's home page. It should feel personal, light, gently flirty, and natural, with a little wit. No clichés, no product language, no emojis, no quote from a song, and no more than 12 words. Return just the caption.",
  );
  const cleaned = generated?.replace(/[\r\n]+/g, " ").replace(/^['\"]|['\"]$/g, "").trim();
  const valid = Boolean(cleaned && cleaned.length <= 90 && cleaned.split(/\s+/).length <= 12);
  const caption = valid
    ? cleaned
    : FALLBACK_CAPTIONS[Math.floor(Math.random() * FALLBACK_CAPTIONS.length)];

  return NextResponse.json(
    { caption, source: valid ? "ai" : "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}