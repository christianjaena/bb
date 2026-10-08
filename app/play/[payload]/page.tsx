'use client';

import { useEffect, useState } from "react";
import { decodePayload } from "@/lib/share";

type SharedGame = {
  type: string;
  prompt: string;
  choice: string;
  createdAt: string;
};

export default function PlayPage({ params }: { params: { payload: string } }) {
  const [game, setGame] = useState<SharedGame | null>(null);

  useEffect(() => {
    const payload = decodePayload<SharedGame>(params.payload);
    setGame(payload ?? null);
  }, [params.payload]);

  if (!game) {
    return (
      <main className="page max-page">
        <div className="card empty">This game prompt could not be decoded.</div>
      </main>
    );
  }

  return (
    <main className="page max-page" style={{ paddingTop: 36 }}>
      <div className="card" style={{ maxWidth: 620, margin: "0 auto" }}>
        <div className="eyebrow">{game.type}</div>
        <h1 className="page-title" style={{ fontSize: 36 }}>{game.prompt}</h1>
        <div className="status-pill">Choice saved: {game.choice}</div>
        <div className="letter-actions">
          <a className="btn primary" href="/">Back to us</a>
        </div>
      </div>
    </main>
  );
}
