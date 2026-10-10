import type { InitProgressReport, MLCEngineInterface } from "@mlc-ai/web-llm";
import { OPEN_WHEN_PROMPTS, type OpenWhenFeeling } from "@/lib/open-when-prompts";

const MODEL_ID = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export type OpenWhenLoadingProgress = { text: string; progress: number | null };

let enginePromise: Promise<MLCEngineInterface> | null = null;
let modelWorker: Worker | null = null;
const progressListeners = new Set<(report: OpenWhenLoadingProgress) => void>();
let lastProgress: OpenWhenLoadingProgress | null = null;

function publishProgress(report: InitProgressReport | OpenWhenLoadingProgress) {
  lastProgress = { text: report.text, progress: report.progress };
  progressListeners.forEach((listener) => listener(lastProgress!));
}

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

function loadEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (!("gpu" in navigator)) {
        throw new Error("This browser does not support WebGPU.");
      }

      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");
      modelWorker = new Worker(new URL("./open-when.worker.ts", import.meta.url), { type: "module" });
      return CreateWebWorkerMLCEngine(modelWorker, MODEL_ID, { initProgressCallback: publishProgress });
    })().catch((error: unknown) => {
      modelWorker?.terminate();
      modelWorker = null;
      enginePromise = null;
      lastProgress = null;
      throw error;
    });
  }
  return enginePromise;
}

async function loadEngineWithProgress(onProgress?: (report: OpenWhenLoadingProgress) => void) {
  if (onProgress) {
    progressListeners.add(onProgress);
    if (lastProgress) onProgress(lastProgress);
  }
  try {
    const engine = await loadEngine();
    publishProgress({ text: "Model ready on this device.", progress: 1 });
    return engine;
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

export async function preloadOpenWhenModel(onProgress?: (report: OpenWhenLoadingProgress) => void) {
  try {
    await loadEngineWithProgress(onProgress);
    return true;
  } catch {
    // Preloading is best-effort; the existing local fallbacks handle unsupported devices.
    return false;
  }
}

export async function generateOpenWhenMessage(
  feeling: OpenWhenFeeling,
  onProgress: (report: OpenWhenLoadingProgress) => void,
) {
  const engine = await loadEngineWithProgress(onProgress);
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

export async function generateModernPoem(
  onProgress: (report: OpenWhenLoadingProgress) => void,
) {
  const engine = await loadEngineWithProgress(onProgress);
  onProgress({ progress: null, text: "Writing a poem on this device..." });
  let rawPoem = "";
  let words: string[] = [];

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) onProgress({ progress: null, text: "Trying once more for a complete poem..." });
    const result = await engine.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Write an original, tender contemporary love poem in English about two people who are far apart but close in ordinary daily moments. Use specific modern images. Return 8 to 12 short lines of free verse, with one blank line between stanzas. No title or explanation.",
        },
        {
          role: "user",
          content: attempt === 0
            ? "Write a fresh poem about a small everyday moment that makes someone feel close to their long-distance partner, and looking forward to seeing them again."
            : "Write the poem now. Make it at least 6 short lines with concrete images. Return only the poem.",
        },
      ],
      temperature: 0.85,
      top_p: 0.9,
      max_tokens: 220,
    });

    rawPoem = (result.choices[0]?.message.content ?? "")
      .replace(/\x60{3}[\w-]*\s*|\x60{3}/g, "")
      .replace(/^\s*(?:poem|today's poem)\s*:?\s*/i, "")
      .trim();
    words = rawPoem.split(/\s+/).filter(Boolean);
    if (words.length >= 12 || (attempt === 1 && words.length >= 4)) break;
  }

  if (!rawPoem || words.length < 4) {
    throw new Error("The on-device model returned no usable poem after retrying.");
  }

  let lines = rawPoem.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  // Keep the model's words, but shape paragraph-style output into readable verse.
  if (lines.length < 4) {
    const sentences = rawPoem.split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
    lines = sentences.length >= 4 ? sentences : [];
  }
  if (lines.length < 4) {
    lines = [];
    const lineLength = Math.max(2, Math.min(8, Math.ceil(words.length / 8)));
    for (let index = 0; index < words.length; index += lineLength) {
      lines.push(words.slice(index, index + lineLength).join(" "));
    }
  }
  if (lines.length > 16) {
    const tail = lines.slice(15).join(" ");
    lines = lines.slice(0, 15);
    lines[14] = lines[14].replace(/[.,;:!?]+$/, "") + " " + tail;
  }
  return lines.map((line, index) => index === 4 ? "\n" + line : line).join("\n");
}
