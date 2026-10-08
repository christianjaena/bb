import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DailyQuestions = {
  wouldYouRather: string;
  whoMoreLikely: string;
  truth: string;
  dare: string;
};

async function fetchQuestion(path: string) {
  try {
    const response = await fetch(`https://api.truthordarebot.xyz${path}`, {
      cache: "no-store",
      headers: { "User-Agent": "OurLittleWorld/1.0 (daily couple game)" },
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return "";
    const data = await response.json();
    const question = typeof data?.question === "string" ? data.question.replace(/\s+/g, " ").trim() : "";
    return question.length >= 12 && question.length <= 180 ? question : "";
  } catch {
    return "";
  }
}

function normalizeWouldYouRather(question: string) {
  const value = question.replace(/^would you rather\s*/i, "").replace(/[?!.]+$/, "").trim();
  const choices = value.split(/\s+or\s+/i);
  if (choices.length !== 2 || choices.some((choice) => choice.trim().length < 2)) return "";
  return `${choices[0].trim()}, or ${choices[1].trim()}?`;
}

export async function GET() {
  const [wouldYouRatherApi, truth, dare, whoMoreLikely] = await Promise.all([
    fetchQuestion("/api/wyr?rating=pg"),
    fetchQuestion("/v1/truth?rating=pg"),
    fetchQuestion("/api/dare?rating=pg"),
    fetchQuestion("/api/paranoia?rating=pg"),
  ]);
  const prompts: DailyQuestions = {
    wouldYouRather: normalizeWouldYouRather(wouldYouRatherApi),
    whoMoreLikely,
    truth,
    dare,
  };
  const hasQuestions = Object.values(prompts).some(Boolean);

  return NextResponse.json(
    { prompts, source: hasQuestions ? "daily-api" : "unavailable", date: new Date().toISOString().slice(0, 10) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
