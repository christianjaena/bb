import type { InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";
import { OPEN_WHEN_PROMPTS, type OpenWhenFeeling } from "@/lib/open-when-prompts";

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export type OpenWhenLoadingProgress = { text: string; progress: number | null };

let enginePromise: Promise<MLCEngineInterface> | null = null;
let modelWorker: Worker | null = null;

function hasRepeatedPhrase(text: string) {
  const words = text.toLowerCase().match(/[a-z0-9']+/g) ?? [];
  for (let length = 5; length <= Math.min(9, Math.floor(words.length / 2)); length += 1) {
    const phrases = new Set<string>();
    for (let start = 0; start <= words.length - length; start += 1) {
      const phrase = words.slice(start, start + length).join(" ");
      if (phrases.has(phrase)) return true;
      phrases.add(phrase);
    }
  }
  return false;
}

function loadEngine(onProgress: (report: InitProgressReport) => void) {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (!("gpu" in navigator)) {
        throw new Error("This browser does not support WebGPU.");
      }

      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
      modelWorker = new Worker(new URL("./open-when.worker.ts", import.meta.url), { type: "module" });
      return CreateWebWorkerMLCEngine(modelWorker, MODEL_ID, { initProgressCallback: onProgress });
    })().catch((error: unknown) => {
      modelWorker?.terminate();
      modelWorker = null;
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

export async function generateOpenWhenMessage(
  feeling: OpenWhenFeeling,
  onProgress: (report: OpenWhenLoadingProgress) => void,
) {
  const engine = await loadEngine((report) => onProgress({ text: report.text, progress: report.progress }));
  onProgress({ progress: null, text: "Writing your note on this device…" });
  const prompt = OPEN_WHEN_PROMPTS[feeling].context;
  const result = await engine.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "Write a short note from a loving long-distance partner directly to the person reading. Match their feeling with warmth and care; never minimize it or give a list of advice. Write exactly 2 concise sentences, 20 to 40 words total. Do not repeat an idea, phrase, or sentence. Avoid clichés, emojis, song lyrics, and quotation marks. Return only the note.",
      },
      { role: "user", content: `Write a comforting message for this moment: ${prompt}` },
    ],
    temperature: 0.85,
    top_p: 0.9,
    max_tokens: 72,
  });

  const message = (result.choices[0]?.message.content ?? "").replace(/^\s*["“']|["”']\s*$/g, "").trim();
  const wordCount = message.split(/\s+/).filter(Boolean).length;
  const sentenceCount = message.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.filter((sentence) => sentence.trim()).length ?? 0;
  if (!message || message.length > 360 || wordCount < 12 || wordCount > 48 || sentenceCount !== 2 || hasRepeatedPhrase(message)) {
    throw new Error("The on-device model returned an unusable message.");
  }
  return message;
}
