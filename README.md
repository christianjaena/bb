# Our Little World

A private, homey LDR website for two people. The visual direction is inspired by the warmth, simplicity, editorial layouts, and activity-first feel of Angie (getangie.com), but the implementation, copy, and relationship content are original.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

The home page gets its daily caption from DumbAPIs `/compliment` endpoint, with local couple-themed captions as a fallback. Its Daily Joke section uses DumbAPIs `/daily/joke` endpoint and falls back to `/joke`; the shared joke is cached in the browser by UTC date. Daily song picks cycle through `public/playlist.txt` by Manila date and link to YouTube Music search. Apple Search supplies album artwork where available, and LRCLIB supplies a short lyric highlight when available. Movie picks span several genres and require an Apple rating of at least 4.2/5 from 500 or more ratings; otherwise, a rotating list of well-known films is used. Series picks require at least a 7.5/10 TVmaze rating and a popularity weight of 40 or more, with a curated fallback list. These sources do not require an API key. Recommendations and captions are cached in the browser. TVmaze data is CC BY-SA and is attributed in the app.

Open When messages are generated in the browser with WebLLM and WebGPU. The first use downloads the model, and the browser can cache it for later visits; a tailored local message is shown if the device cannot run it. Gemini remains optional for daily question generation. Play fetches its daily Would You Rather, Truth, Dare, and Who's More Likely questions from the keyless Truth or Dare API and caches that day's set in the browser. Play does not show locally stored question prompts when the API is unavailable. Daily recommendations use the most recently cached picks or an offline set if public catalogs are unavailable.

## Deploy

Push to GitHub and import the repo into Vercel. Add any desired API keys in the Vercel project environment settings.

## Current stack

- Next.js + TypeScript
- Tailwind CSS
- Browser localStorage for memories/check-ins and daily recommendation caching
- DumbAPIs compliment and daily joke endpoints, with a local caption fallback
- Local playlist text file, Apple Search, LRCLIB, and YouTube Music search links for daily songs
- iTunes Search API and TVmaze for rated, popular movie and series picks
- WebLLM for on-device Open When message generation
- Optional Gemini text generation for daily questions
- Truth or Dare API for daily game prompts

## Design direction

- Warm paper background
- Editorial serif + clean sans typography
- Rounded, tactile cards
- Soft rose/sage accents
- Large emotional hero
- Mobile bottom navigation
- Personal rather than SaaS-like language

## Notes

The home hero currently uses an external Unsplash image URL for visual atmosphere. Replace it with one of your own photos later for a much more personal result.
