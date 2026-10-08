'use client';

import { useEffect, useState } from "react";
import { decodePayload } from "@/lib/share";
import { readSavedThings, saveSavedThing, type SavedThing } from "@/lib/storage";

export default function ThingPage({ params }: { params: { payload: string } }) {
  const [thing, setThing] = useState<SavedThing | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const payload = decodePayload<SavedThing>(params.payload);
    if (!payload) {
      setThing(null);
      return;
    }

    setThing({
      id: payload.id ?? crypto.randomUUID(),
      kind: payload.kind ?? "Little thing",
      emoji: payload.emoji ?? "♡",
      message: payload.message ?? "I’m thinking of you",
      createdAt: payload.createdAt ?? new Date().toISOString(),
      url: payload.url ?? "",
    });
  }, [params.payload]);

  useEffect(() => {
    if (!thing) return;
    void (async () => {
      const records = await readSavedThings();
      setSaved(records.some((item) => item.message === thing.message && item.kind === thing.kind));
    })();
  }, [thing]);

  const saveThing = async () => {
    if (!thing) return;
    await saveSavedThing(thing);
    setSaved(true);
  };

  if (!thing) {
    return (
      <main className="page max-page">
        <div className="card empty">This little thing has wandered off. Try the original link again.</div>
      </main>
    );
  }

  return (
    <main className="page max-page" style={{ paddingTop: 36 }}>
      <div className="card" style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
        <div className="eyebrow">A little gesture</div>
        <div style={{ fontSize: 56, margin: "18px 0 10px" }}>{thing.emoji}</div>
        <h1 className="page-title" style={{ fontSize: 38 }}>{thing.kind}</h1>
        <p className="answer-copy" style={{ fontSize: 18 }}>{thing.message}</p>
        <div className="letter-actions" style={{ justifyContent: "center" }}>
          <button className="btn primary" onClick={() => void saveThing()} disabled={saved}>
            {saved ? "Saved" : "Save this little thing"}
          </button>
          <a className="btn" href="/">Back to us</a>
        </div>
      </div>
    </main>
  );
}
