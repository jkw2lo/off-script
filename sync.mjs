// Pulls everything TMDB lists as streaming on Netflix (US) into catalog.json.
// Usage: put your key in .env as TMDB_KEY=... then `node sync.mjs`
// Accepts either a v3 API key or a v4 read access token (starts with "eyJ").
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const KEY = (process.env.TMDB_KEY || (env.match(/TMDB_KEY\s*=\s*(\S+)/) || [])[1] || "").trim();
if (!KEY) { console.error("No TMDB_KEY found in .env or environment."); process.exit(1); }

const REGION = process.env.REGION || "US";
const NETFLIX = 8;
const BASE = "https://api.themoviedb.org/3";
const bearer = KEY.startsWith("eyJ");

async function api(path, params = {}, tries = 5) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (!bearer) u.searchParams.set("api_key", KEY);
  for (let i = 0; i < tries; i++) {
    const res = await fetch(u, { headers: bearer ? { Authorization: "Bearer " + KEY } : {} });
    if (res.ok) return res.json();
    if (res.status === 401) throw new Error("TMDB rejected the key (401). Check it in .env.");
    if (res.status === 404) return null;
    await new Promise(r => setTimeout(r, 400 * (i + 1) + (res.status === 429 ? 1500 : 0)));
  }
  throw new Error("Gave up on " + path);
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let next = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      try { out[i] = await fn(items[i]); } catch (e) { console.warn(" skip", items[i], e.message); }
      if (++done % 250 === 0) console.log(`  details ${done}/${items.length}`);
    }
  }));
  return out;
}

async function discoverAll(kind) {
  const ids = new Set();
  const q = { with_watch_providers: NETFLIX, watch_region: REGION, with_watch_monetization_types: "flatrate", sort_by: "primary_release_date.desc", include_adult: "false" };
  if (kind === "tv") q.sort_by = "first_air_date.desc";
  const first = await api(`/discover/${kind}`, { ...q, page: 1 });
  first.results.forEach(r => ids.add(r.id));
  const pages = Math.min(first.total_pages, 500);
  console.log(`${kind}: ${first.total_results} results over ${pages} pages`);
  const rest = Array.from({ length: pages - 1 }, (_, i) => i + 2);
  await pool(rest, 8, async p => (await api(`/discover/${kind}`, { ...q, page: p })).results.forEach(r => ids.add(r.id)));
  return [...ids];
}

const genres = {}, keywords = {}, companies = {};
const yearOf = d => (d ? +d.slice(0, 4) : null);

function compact(kind, d) {
  if (!d) return null;
  (d.genres || []).forEach(g => (genres[g.id] = g.name));
  const kws = (kind === "movie" ? d.keywords?.keywords : d.keywords?.results) || [];
  kws.forEach(k => (keywords[k.id] = k.name));
  const crew = d.credits?.crew || [];
  const people = kind === "movie"
    ? crew.filter(c => c.job === "Director").map(c => c.name)
    : (d.created_by || []).map(c => c.name);
  let cert = "";
  if (kind === "movie") {
    const us = (d.release_dates?.results || []).find(r => r.iso_3166_1 === "US");
    cert = (us?.release_dates || []).map(r => r.certification).find(Boolean) || "";
  } else {
    cert = (d.content_ratings?.results || []).find(r => r.iso_3166_1 === "US")?.rating || "";
  }
  const countries = d.origin_country?.length ? d.origin_country : (d.production_countries || []).map(c => c.iso_3166_1);
  const rec = {
    i: d.id, t: kind === "movie" ? "m" : "t",
    n: d.title || d.name,
    y: yearOf(d.release_date || d.first_air_date),
    ov: d.overview || "",
    r: Math.round((d.vote_average || 0) * 10) / 10,
    v: d.vote_count || 0,
    g: (d.genres || []).map(g => g.id),
    k: kws.slice(0, 24).map(k => k.id),
    c: [...new Set(countries)].slice(0, 4),
    l: d.original_language,
  };
  const orig = d.original_title || d.original_name;
  if (orig && orig !== rec.n) rec.o = orig;
  if (d.tagline) rec.tg = d.tagline;
  if (kind === "movie") rec.rt = d.runtime || 0;
  else {
    rec.rt = (d.episode_run_time || [])[0] || d.last_episode_to_air?.runtime || 0;
    rec.s = d.number_of_seasons || 0; rec.e = d.number_of_episodes || 0;
    if (d.status) rec.st = d.status;
    if (d.last_air_date) rec.ly = yearOf(d.last_air_date);
  }
  if (people.length) rec.d = people.slice(0, 3);
  const cast = (d.credits?.cast || []).slice(0, 4).map(c => c.name);
  if (cast.length) rec.ca = cast;
  if (cert) rec.cr = cert;
  if (d.external_ids?.imdb_id) rec.im = d.external_ids.imdb_id;
  if (d.poster_path) rec.p = d.poster_path;
  // Production companies (for anime, the animation studio): used by the "art style" reason.
  const pcs = (d.production_companies || []).slice(0, 3);
  pcs.forEach(c => (companies[c.id] = c.name));
  if (pcs.length) rec.pc = pcs.map(c => c.id);
  return rec;
}

const t0 = Date.now();
const titles = [];
for (const kind of ["movie", "tv"]) {
  const ids = await discoverAll(kind);
  const append = kind === "movie" ? "keywords,credits,external_ids,release_dates" : "keywords,credits,external_ids,content_ratings";
  const recs = await pool(ids, 16, id => api(`/${kind}/${id}`, { append_to_response: append }).then(d => compact(kind, d)));
  titles.push(...recs.filter(Boolean));
}

// Keep only keyword names we actually reference.
const used = new Set(titles.flatMap(t => t.k));
const kw = {}; for (const id of used) kw[id] = keywords[id];

const out = { region: REGION, provider: "Netflix", synced: new Date().toISOString(), genres, keywords: kw, companies, titles };
writeFileSync("catalog.json", JSON.stringify(out));
const mb = (Buffer.byteLength(JSON.stringify(out)) / 1e6).toFixed(1);
console.log(`Done: ${titles.length} titles (${titles.filter(t => t.t === "m").length} films, ${titles.filter(t => t.t === "t").length} series), ${mb} MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
