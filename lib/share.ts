export type EncodablePayload = Record<string, unknown>;

function base64UrlEncode(value: string) {
  if (typeof window !== "undefined" && typeof btoa === "function") {
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  if (typeof window !== "undefined" && typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodePayload(payload: EncodablePayload) {
  return base64UrlEncode(JSON.stringify(payload));
}

function encodeBytes(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function encodeCompactPayload(payload: EncodablePayload) {
  if (typeof CompressionStream === "undefined") return encodePayload(payload);
  const stream = new Blob([JSON.stringify(payload)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return `z${encodeBytes(compressed)}`;
}

export async function decodeSharedPayload<T = Record<string, unknown>>(value: string): Promise<T | null> {
  if (!value.startsWith("z")) return decodePayload<T>(value);
  if (typeof DecompressionStream === "undefined") return decodePayload<T>(value);

  try {
    const compressed = decodeBytes(value.slice(1));
    const stream = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));
    const json = await new Response(stream).text();
    return JSON.parse(json) as T;
  } catch {
    // Plain base64url payloads can also begin with "z". Try the legacy format
    // if this value wasn't a valid compressed payload.
    return decodePayload<T>(value);
  }
}

export function decodePayload<T = Record<string, unknown>>(value: string): T | null {
  try {
    const decoded = base64UrlDecode(value);
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function createShareableUrl(payload: EncodablePayload, slug: "letter" | "thing" | "play") {
  if (typeof window === "undefined") {
    return `/${slug}/${encodePayload(payload)}`;
  }

  return `${window.location.origin}/${slug}/${encodePayload(payload)}`;
}

export async function createCompactShareableUrl(payload: EncodablePayload, slug: "letter" | "thing" | "play") {
  const encoded = await encodeCompactPayload(payload);
  if (typeof window === "undefined") return `/${slug}/${encoded}`;
  return `${window.location.origin}/${slug}/${encoded}`;
}
