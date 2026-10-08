# Our Little World

A private, homey LDR website for two people. The visual direction is inspired by the warmth, simplicity, editorial layouts, and activity-first feel of Angie (getangie.com), but the implementation, copy, and relationship content are original.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

Song and movie picks come from the public iTunes Search API, with a SampleAPIs comedy catalog backup and a rotating local backup list. Series picks come from TVmaze. Short lyric highlights are looked up through LRCLIB and link back to their source. These sources do not require an API key. Recommendations are selected once per Manila day and cached in the browser. TVmaze data is CC BY-SA and is attributed in the app.

Gemini remains optional for daily captions. Play fetches its daily Would You Rather, Truth, Dare, and Who's More Likely questions from the keyless Truth or Dare API and caches that day's set in the browser. Play does not show locally stored question prompts when the API is unavailable. Daily recommendations use the most recently cached picks or an offline set if public catalogs are unavailable.

## Deploy

Push to GitHub and import the repo into Vercel. Add any desired API keys in the Vercel project environment settings.

## Current stack

- Next.js + TypeScript
- Tailwind CSS
- Browser localStorage for memories/check-ins and daily recommendation caching
- iTunes Search API, SampleAPIs, and TVmaze for public media catalogs
- LRCLIB for short linked lyric highlights
- Optional Gemini text generation for daily captions
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
