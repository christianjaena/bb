'use client';

import { use, useEffect, useState } from "react";
import { decodeSharedPayload } from "@/lib/share";

type SharedLetter = {
  id: string;
  title: string;
  sender: string;
  body: string;
  createdAt: string;
  url: string;
};

export default function LetterPage({ params }: { params: Promise<{ payload: string }> }) {
  const { payload: encodedPayload } = use(params);
  const [letter, setLetter] = useState<SharedLetter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const payload = await decodeSharedPayload<Partial<SharedLetter>>(encodedPayload);
      if (cancelled) return;
      if (!payload) {
        setLetter(null);
        setLoading(false);
        return;
      }

      setLetter({
        id: payload.id ?? "shared-letter",
        title: payload.title ?? "A little note",
        sender: payload.sender ?? "You",
        body: payload.body ?? "",
        createdAt: payload.createdAt ?? new Date().toISOString(),
        url: payload.url ?? "",
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [encodedPayload]);

  if (loading) {
    return (
      <main className="page max-page">
        <div className="loading">Opening your letter…</div>
      </main>
    );
  }

  if (!letter) {
    return (
      <main className="page max-page">
        <div className="card empty">This letter seems to have wandered off. Try opening the link again.</div>
      </main>
    );
  }

  return (
    <main className="page max-page" style={{ paddingTop: 38 }}>
      <div className="letter-page" style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="eyebrow">A little letter</div>
        <div className="letter-hero">
          <span>✉️</span>
          <div>
            <p className="letter-sender">From {letter.sender}</p>
            <h1 className="page-title" style={{ fontSize: 38 }}>{letter.title || "A little note"}</h1>
          </div>
        </div>
        <div className="letter-body">
          {letter.body.split("\n").map((line, index) => (
            <p key={`${line}-${index}`}>{line || " "}</p>
          ))}
        </div>
        <div className="letter-actions">
          <a className="btn" href="/">Back to us</a>
        </div>
      </div>
    </main>
  );
}
