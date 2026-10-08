import { NextResponse } from "next/server";
import { generateGeminiTextDetailed } from "@/lib/gemini";

export const dynamic = "force-dynamic";

type GamePrompts = {
  wouldYouRather: string[];
  whoMoreLikely: string[];
  truthOrDare: string[];
  howWellDoYouKnowMe: string[];
};

function parsePrompts(text: string): GamePrompts | null {
  try {
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    const value = JSON.parse(json);
    const validList = (items: unknown, requireOr = false) =>
      Array.isArray(items) && items.length >= 5 && items.length <= 8 && items.every((item) =>
        typeof item === "string" && item.trim().length >= 12 && item.trim().length <= 180 &&
        (!requireOr || item.split(/,\s+or\s+/i).length === 2),
      );

    if (
      !validList(value?.wouldYouRather, true) ||
      !validList(value?.whoMoreLikely) ||
      !validList(value?.truthOrDare) ||
      !validList(value?.howWellDoYouKnowMe)
    ) return null;

    return value as GamePrompts;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "today";
  const generation = await generateGeminiTextDetailed(
    `Write a fresh set of playful, kind, non-explicit questions for a long-distance couple to play on ${date} (Asia/Manila). Return only JSON with four arrays, each with exactly 5 string questions: wouldYouRather (each item must have exactly one comma followed by "or" separating two short choices), whoMoreLikely, truthOrDare (alternate Truth and Dare, keep dares safe and doable over a video call), howWellDoYouKnowMe. Keep every question natural, specific, warm, and under 20 words. Avoid repeating generic questions. Shape: {"wouldYouRather":["..."],"whoMoreLikely":["..."],"truthOrDare":["..."],"howWellDoYouKnowMe":["..."]}`,
    { responseMimeType: "application/json" },
  );
  const prompts = generation.text ? parsePrompts(generation.text) : null;

  if (!prompts) {
    console.error(`[Daily games] Generation failed (${generation.reason ?? "invalid_generated_json"}).`);
    return NextResponse.json(
      { error: "Fresh game prompts are unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json({ prompts, source: "ai", date }, { headers: { "Cache-Control": "no-store" } });
}
