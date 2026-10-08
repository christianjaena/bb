# Our Little World

A private, homey LDR website for two people. The visual direction is inspired by the warmth, simplicity, editorial layouts, and activity-first feel of Angie (getangie.com), but the implementation, copy, and relationship content are original.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

To enable Gemini generated daily recommendations and captions, copy
`.env.example` to `.env.local`, add your `GEMINI_API_KEY`, then restart the dev
server. For a deployment, configure the same variable in its environment
settings. Daily song, movie, and series picks are generated once per Manila day
and cached in the browser. The Play tab also fetches a fresh set of games once
per day. If generation fails, the app uses the most recently cached picks or a
small offline recommendation set, and built-in game questions keep Play usable.

## Deploy

Push to GitHub and import the repo into Vercel.

## Current stack

- Next.js + TypeScript
- Tailwind CSS
- Browser localStorage for memories/check-ins
- No database required
- Optional Gemini text generation for daily captions, recommendations, and games

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
