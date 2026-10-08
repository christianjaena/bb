import { NextResponse } from "next/server";
import { generateGeminiText } from "@/lib/gemini";

export const dynamic = "force-dynamic";

function makeFallbackQuestion() {
  const questions = [
    "What little win would you tell me about on our next call?",
    "What funny moment from today should I hear about?",
    "What snack are you saving room to tell me about?",
    "What small surprise would make tomorrow nicer?",
    "What tiny inconvenience deserves an dramatic retelling?",
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

export async function GET() {
  const generated = await generateGeminiText(
    "Write exactly one short, fresh question for a long-distance couple in Manila and Auckland to ask each other today. Make it affectionate, lightly witty, natural, and specific to everyday life. Avoid generic relationship-coach language, clichés, multiple questions, lists, and explicit content. Return only the question, ending with a question mark.",
  );
  const cleaned = generated?.replace(/[\r\n]+/g, " ").replace(/^['\"]|['\"]$/g, "").trim();
  const usedAi = Boolean(cleaned && cleaned.length <= 180 && cleaned.endsWith("?"));
  const question = usedAi ? cleaned : makeFallbackQuestion();

  return NextResponse.json(
    { question, source: usedAi ? "ai" : "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}