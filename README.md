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
| `firestore.rules` | Firestore security rules: each user reads and writes only their own data. |
| `.github/workflows/sync-catalog.yml` | Refreshes the catalog on the 1st of each month. Needs a `TMDB_KEY` repo secret. |

## Setup

### Refresh the catalog locally

```bash
echo "TMDB_KEY=your_tmdb_key" > .env
node sync.mjs
```

### Firebase (Google sign-in)

1. Create a project at https://console.firebase.google.com (Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.**
3. **Authentication → Settings → Authorized domains → Add domain:** `jkw2lo.github.io`.
4. **Build → Firestore Database → Create database** (production mode, any US location).
   Then open the **Rules** tab, paste the contents of `firestore.rules`, and publish.
5. **Project settings → General → Your apps → Web (`</>`)**, register an app, and copy the
   `firebaseConfig` values into `firebase-config.js`. Commit and push.

### Monthly catalog refresh on GitHub

```bash
gh secret set TMDB_KEY
```

Data from [TMDB](https://www.themoviedb.org). This product uses the TMDB API but is not endorsed or certified by TMDB.
