# Our Little World

A private, homey LDR website for two people. The visual direction is inspired by the warmth, simplicity, editorial layouts, and activity-first feel of Angie (getangie.com), but the implementation, copy, and relationship content are original.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

The home page gets its daily caption from DumbAPIs `/compliment` endpoint, with local couple-themed captions as a fallback. Its Daily Joke section uses Gemini for a Tagalog joke when configured and local Tagalog jokes otherwise. Daily song picks cycle through `public/playlist.txt` by Manila date and link to YouTube Music search. Apple Search supplies album artwork where available, and LRCLIB supplies a short lyric highlight when available. Movie and series recommendations come from a curated list for Netflix, Prime Video, Disney+, Hulu, and Apple TV+, in Filipino, English, Japanese, and Korean; each link opens that service's search for region-specific availability. Recommendations and captions are cached in the browser.

Open When messages are generated in the browser with WebLLM and WebGPU. The first use downloads the model, and the browser can cache it for later visits; a tailored local message is shown if the device cannot run it. Gemini remains optional for daily question generation. Play fetches its daily Would You Rather, Truth, Dare, and Who's More Likely questions from the keyless Truth or Dare API and caches that day's set in the browser. Play does not show locally stored question prompts when the API is unavailable. Daily recommendations use the most recently cached picks or an offline set if public catalogs are unavailable.

## Deploy

Push to GitHub and import the repo into Vercel. Add any desired API keys in the Vercel project environment settings.

## Current stack

- Next.js + TypeScript
- Tailwind CSS
- Browser localStorage for memories/check-ins and daily recommendation caching
- DumbAPIs compliment and daily joke endpoints, with a local caption fallback
- Local playlist text file, Apple Search, LRCLIB, and YouTube Music search links for daily songs
- Curated movie and series picks across five streaming services with region-aware search links
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
