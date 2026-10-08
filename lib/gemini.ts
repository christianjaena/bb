export type GeminiTextResult = {
  text: string | null;
  reason: "missing_key" | "upstream_error" | "empty_response" | "request_error" | null;
  status?: number;
  detail?: string;
};

export async function generateGeminiTextDetailed(
  prompt: string,
  options: { responseMimeType?: "application/json" } = {},
): Promise<GeminiTextResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) return { text: null, reason: "missing_key" };

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          ...(options.responseMimeType ? { generationConfig: { responseMimeType: options.responseMimeType } } : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!response.ok) {
      let detail = "Gemini rejected the request.";
      try {
        const data = await response.json();
        const message = data?.error?.message;
        if (typeof message === "string") detail = message.slice(0, 300);
      } catch {
        // Keep the safe generic detail if Google returned a non-JSON response.
      }
      const safeDetail = detail.split(apiKey).join("[redacted]");
      console.error(`[Gemini] ${model} returned HTTP ${response.status}: ${safeDetail}`);
      return { text: null, reason: "upstream_error", status: response.status, detail: safeDetail };
    }
    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.filter((part) => typeof part?.text === "string" && !part.thought).map((part) => part.text).join("")
      : "";
    if (typeof text === "string" && text.trim()) return { text: text.trim(), reason: null };
    const blockReason = data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason;
    const detail = typeof blockReason === "string" ? blockReason : "The response contained no text.";
    console.error(`[Gemini] ${model} returned no text: ${detail}`);
    return { text: null, reason: "empty_response", detail };
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`[Gemini] ${model} request failed (${errorName}).`);
    return { text: null, reason: "request_error", detail: errorName };
  }
}

export async function generateGeminiText(prompt: string) {
  return (await generateGeminiTextDetailed(prompt)).text;
}

export function hasGeminiApiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}
