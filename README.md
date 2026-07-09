# Flip — flashcard study app

Plain vanilla HTML/CSS/JS. No build step, no backend, no database.
Everything a user creates is saved in their own browser (localStorage).

## 1. Host it (free, permanent — unlike Replit's 28-day limit)

**Vercel (recommended):**
1. Go to vercel.com, sign up free with GitHub.
2. Create a new GitHub repo, upload this whole `flip` folder to it.
3. In Vercel, click "New Project" → import that repo → Deploy.
4. Framework preset: choose "Other" (it's just static files). No build command needed.
5. You'll get a URL like `flip-yourname.vercel.app` — free forever, no 28-day expiry.

## 2. Turn on AI-generated flashcards (free Gemini API)

The "Generate with AI" box (in Edit deck) calls a small server function at
`api/generate.js` — it talks to Gemini, not your browser, so your API key
is never exposed to visitors.

1. Get a free key at aistudio.google.com/apikey (sign in with Google).
2. In Vercel: Project → Settings → Environment Variables → add
   `GEMINI_API_KEY` = your key → Save.
3. Redeploy (Vercel does this automatically on save, or push any small change).
4. That's it — paste notes or a topic into the box, pick a card count, hit Generate.

This only works once deployed to Vercel (or anywhere that runs the `api/` folder
as a serverless function) — opening `index.html` directly on your computer
won't have anywhere to send the request.

Free tier note: Google's free Gemini tier has a daily/per-minute request limit.
Fine for one person's app early on; if you get real traffic you may eventually
hit that limit and see an error from the Generate button.

## 3. Add Google AdSense (how the money works)

- Sign up at adsense.google.com with the live URL from step 1.
- Google reviews your site (can take a few days to weeks). You need real content and some traffic — a totally empty new site sometimes gets rejected at first. Keep the site live and try again if so.
- Once approved, you get a **publisher ID** (`ca-pub-XXXXXXXXXXXXXXXX`) and, per ad slot, a **slot ID**.
- Open `index.html`, find the two commented-out blocks (search for "ADSENSE" and "ad-slot"), uncomment them, and paste in your real IDs. Remove the `<div class="ad-placeholder">` lines once real ads are wired in.
- **How you actually get paid:** advertisers pay Google, Google pays you a share, mostly based on **impressions** (views, small amount per 1,000) and **clicks** (bigger amount per click, but rare — often under 1-2% of visitors click). Realistically this means it earns very little until you have real, regular traffic. Payout happens once your balance hits $100, sent to your bank monthly. It's a slow-burn, traffic-driven income, not a quick payout.

## 4. Package it as an app (PWABuilder — same tool you used before)

1. Deploy to Vercel first (step 1) — PWABuilder needs a live URL.
2. Go to pwabuilder.com, paste in your Vercel URL.
3. It'll detect `manifest.json` and `service-worker.js` (already included here) and score your site as installable.
4. Click "Package for stores" → Android → download the `.aab` file.
5. Upload that `.aab` to Google Play Console like you did before (same $25 one-time developer fee, no new cost).

## What's inside

- `index.html` / `style.css` / `app.js` — the whole app
- `api/generate.js` — serverless function that calls Gemini (keeps your key private)
- `manifest.json` + `service-worker.js` — makes it installable / packageable
- `icons/` — placeholder app icons (swap these for your own logo anytime — just keep the same filenames and sizes)

## Features

- Create decks, add/remove cards (front + back) manually
- Generate cards from notes or a topic with AI (Gemini, free tier)
- Study mode: tap to flip, mark "Knew it" / "Didn't know it," missed cards re-queue automatically
- Streak tracker + total cards reviewed, all local to the device
- Ad slots already placed (top banner + in-page) — just blank boxes until you add your AdSense IDs
