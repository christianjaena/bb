import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FALLBACK_CAPTIONS = [
  "Saving you a seat for our next call.",
  "My favourite view is still you on the screen.",
  "Wish you were here. I saved you the good side.",
  "Same us, slightly inconvenient geography.",
  "Next call: you, me, and an unnecessary amount of snacks.",
];

function dateForToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

function pickOfDay<T>(items: T[], date: string) {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return items[((day % items.length) + items.length) % items.length];
}

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : dateForToday();

  try {
    const response = await fetch("https://dumbapis.com/compliment", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    console.info(`[Daily caption] DumbAPIs /compliment request: HTTP ${response.status}.`);
    if (!response.ok) throw new Error(`http_${response.status}`);

    const result = await response.json();
    if (typeof result?.compliment !== "string" || !result.compliment.trim()) {
      throw new Error("empty_or_invalid_data");
    }

    return NextResponse.json(
      { caption: result.compliment.trim(), author: "", source: "dumbapis", date },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const debugReason = error instanceof Error ? error.message : String(error);
    console.warn(`[Daily caption] DumbAPIs /compliment unavailable (${debugReason}); using a local caption.`);
    return NextResponse.json(
      { caption: pickOfDay(FALLBACK_CAPTIONS, date), author: "", source: "local", date, debugReason },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
