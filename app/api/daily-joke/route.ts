import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let debugReason = "unknown_error";

  for (const [label, url] of [
    ["daily", "https://dumbapis.com/daily/joke"],
    ["random", "https://dumbapis.com/joke"],
  ] as const) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      console.info(`[Daily joke] DumbAPIs /${label === "daily" ? "daily/joke" : "joke"} request: HTTP ${response.status}.`);
      if (!response.ok) {
        debugReason = `http_${response.status}`;
        continue;
      }

      const result = await response.json();
      if (typeof result?.joke !== "string" || !result.joke.trim()) {
        debugReason = "empty_or_invalid_data";
        continue;
      }

      return NextResponse.json(
        { joke: result.joke.trim(), date: result.date ?? new Date().toISOString().slice(0, 10), source: "dumbapis" },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      debugReason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`[Daily joke] DumbAPIs /${label === "daily" ? "daily/joke" : "joke"} request failed (${debugReason}).`);
    }
  }

  return NextResponse.json({ error: "Daily joke is unavailable right now.", debugReason }, { status: 503 });
}
