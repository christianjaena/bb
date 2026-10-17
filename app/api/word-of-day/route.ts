import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RandomWordEntry = { word?: unknown; pronunciation?: unknown; definition?: unknown };

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date");
  const date = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
    ? requestedDate
    : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  try {
    const response = await fetch("https://random-words-api.vercel.app/word/english/vocabulary", {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "OurLittleWorld/1.0 (daily word)" },
    });
    if (!response.ok) throw new Error(`Random Words API returned HTTP ${response.status}`);
    const payload = await response.json() as unknown;
    const entry = Array.isArray(payload) ? payload[0] : payload;
    if (!entry || typeof entry !== "object") {
      throw new Error("Random Words API returned an invalid entry");
    }
    const wordEntry = entry as RandomWordEntry;
    if (typeof wordEntry.word !== "string" || typeof wordEntry.definition !== "string") {
      throw new Error("Random Words API returned an incomplete entry");
    }
    return NextResponse.json({
      word: wordEntry.word,
      pronunciation: typeof wordEntry.pronunciation === "string" ? wordEntry.pronunciation : "",
      meaning: wordEntry.definition.trim(),
      source: "random-words-api.vercel.app",
      date,
    }, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } });
  } catch (error) {
    console.warn("[Word of the day] Random Words API request failed.", error);
    return NextResponse.json({ error: "Word lookup is unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
