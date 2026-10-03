# Off Script

A personal Netflix (US) picker that works against the recommendation feed instead of with it.
Pick categories around one big **Hit me** button and get a random title from the full Netflix US catalog.
Then mark it **watching**, **watched**, **maybe later** or **not interested**. Each "not interested" reason
quietly lowers the odds of similar titles. Popularity and trending data are never used.

Live site: https://jkw2lo.github.io/off-script/

## How it works

- **Catalog** — `sync.mjs` pulls every title TMDB lists as streaming on Netflix US (films and series,
  with genres, keywords, countries, ratings, cast) into `catalog.json`. The page loads that file and
  does all picking in the browser, so no AI or API calls happen while you use it.
- **Picking** — titles matching your selected categories go into the draw. Within a group (Asia,
  Dark, Mood…) choices are OR'd; across groups they're AND'd, or switch to "Match any".
- **Taste profile** — "Not interested" reasons mark different traits (genre, themes, length, country…).
  Marked traits make similar titles less likely, never impossible, and fade by half every six months.
  A share of picks (20% by default) are wildcards that ignore the profile.
- **History** — saved to your Google account through Firebase when signed in, otherwise in the browser.
  Export and import from Settings.

## Files

| File | What it is |
| --- | --- |
| `off-script.html` | The app. Edit this one. |
| `index.html` | Generated from `off-script.html` by `node build.mjs`. |
| `catalog.json` | Netflix US catalog from TMDB. |
| `sync.mjs` | Refreshes `catalog.json`. Needs `TMDB_KEY` in `.env`. |
| `firebase-config.js` | Your Firebase web config (not secret). |
| `firestore.rules` | Off Script's Firestore rule, to add to the shared project's rules. |
| `.github/workflows/sync-catalog.yml` | Refreshes the catalog on the 1st of each month. Needs a `TMDB_KEY` repo secret. |

## Setup

### Refresh the catalog locally

```bash
echo "TMDB_KEY=your_tmdb_key" > .env
node sync.mjs
```

### Firebase (Google sign-in)

Uses the same Firebase project as Hanzi, Nihongo and Cantonese Quest (`hanzi-quest-3cf9c`),
which already has Google sign-in enabled and `jkw2lo.github.io` as an authorized domain.
Off Script's data lives under `offscript/<uid>/decisions/*` and `offscript/<uid>/settings/prefs`.

One-time step: in **Firestore → Rules**, add the block from `firestore.rules` next to the
existing `progress-*` blocks and publish. Don't replace the whole rules file.

### Monthly catalog refresh on GitHub

The workflow runs on the 1st of each month and commits a fresh `catalog.json` when Netflix's
lineup has changed. It needs the TMDB key as a repository secret (set once):

```bash
gh secret set TMDB_KEY --repo jkw2lo/off-script
```

Run it on demand from the Actions tab or with `gh workflow run sync-catalog.yml`.

Data from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.
