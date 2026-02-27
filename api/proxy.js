// Proxy + static server for Render single-process deploy.
// - Serves built SPA from ../recofilms/dist when available.
// - Proxies /api/* to TMDB using server-side TMDB_API_KEY (kept secret in Render env).
// - Applies basic rate limiting.

import express from 'express';
const fetch = global.fetch; // Node 18+ provides built-in fetch
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Vercel serverless functions export the Express app directly; there is no
// listening port or manual startup.  The platform will handle incoming
// requests for us, so we drop the PORT and startServer boilerplate.
const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;

if (!TMDB_KEY) {
  console.error('Missing TMDB_API_KEY in environment. Set TMDB_API_KEY and restart.');
  // don't exit; allow the server to run in dev if direct client key used
}

const app = express();
app.use(cors());
app.use(express.json());                // parse JSON bodies for our POST endpoint

const windowMs = process.env.RATE_LIMIT_WINDOW_MS ? Number(process.env.RATE_LIMIT_WINDOW_MS) : 60 * 1000;
const max = process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 60;
const limiter = rateLimit({ windowMs, max, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

// route that merges recommendations and applies genre/director filtering
app.post('/api/recommend', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  try {
    // gather genre/director info and language frequencies from the selected movies
    const selectedGenres = new Set();
    const selectedDirectors = new Set();
    const selectedLanguages = {};

    await Promise.all(
      ids.map(async (id) => {
        try {
          // movie details contains genres and language; reuse for efficiency
          const details = await fetchTMDB(`/movie/${id}`).catch(() => ({}));
          (details.genres || []).forEach((g) => selectedGenres.add(g.id));
          if (details.original_language) {
            selectedLanguages[details.original_language] = (selectedLanguages[details.original_language] || 0) + 1;
          }
          // director id
          try {
            const dir = await getMovieDirector(id);
            if (dir) selectedDirectors.add(dir);
          } catch {
            // ignore
          }
        } catch {
          // ignore failures
        }
      })
    );

    // fetch TMDB recommendations for each selected id
    // if TMDB returns no recommendations for a given id, try fallbacks:
    // 1) top movies by the same director, 2) top movies by the same genre
    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetchTMDB(`/movie/${id}/recommendations`);
          if (!r.results || r.results.length === 0) {
            console.debug(`no TMDB recommendations for ${id}, attempting fallbacks`);
            // try director fallback
            try {
              const director = await getMovieDirector(id);
              if (director) {
                const dm = await getDirectorMovies(director, 8);
                if (dm && dm.length > 0) return { results: dm };
              }
            } catch (e) {
              console.debug('director fallback failed for', id, e);
            }
            // try genre fallback
            try {
              const genres = await getMovieGenres(id);
              if (genres && genres.length > 0) {
                const gm = await getTopMoviesByGenre(genres.slice(0, 3), 8);
                if (gm && gm.length > 0) return { results: gm };
              }
            } catch (e) {
              console.debug('genre fallback failed for', id, e);
            }
          }
          return r;
        } catch (e) {
          console.warn(`failed to fetch recommendations for ${id}:`, e);
          return { results: [] };
        }
      })
    );

    const counter = {};
    const directorCache = {};

    // language weighting multiplier: can be provided in request or via env
    const languageWeight = Number(req.body.languageWeight ?? process.env.LANGUAGE_WEIGHT ?? 0.5);

    // merge and filter
    for (const r of results) {
      for (const m of r.results || []) {
        if (ids.includes(m.id)) continue;

        const hasGenre = (m.genre_ids || []).some((g) => selectedGenres.has(g));
        let hasDirector = false;

        if (!hasGenre && selectedDirectors.size > 0) {
          let dir = directorCache[m.id];
          if (dir === undefined) {
            try {
              dir = await getMovieDirector(m.id);
            } catch {
              dir = null;
            }
            directorCache[m.id] = dir;
          }
          if (dir && selectedDirectors.has(dir)) {
            hasDirector = true;
          }
        }

        if (!hasGenre && !hasDirector) continue;

        const key = m.id;
        if (!counter[key]) counter[key] = { movie: m, count: 0, langScore: 0 };
        counter[key].count += 1;
        // add language score proportional to how many selected movies share this language
        const lang = m.original_language || m.originalLanguage || m.iso_639_1;
        if (lang && selectedLanguages[lang]) {
          counter[key].langScore += selectedLanguages[lang];
        }
      }
    }

    let scored = Object.values(counter).map((x) => ({
      movie: x.movie,
      score: (x.count || 0) + ((x.langScore || 0) * (isFinite(languageWeight) ? languageWeight : 0.5)),
      popularity: x.movie?.popularity || 0,
    }));

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.popularity - a.popularity;
    });

    let list = scored.map((s) => s.movie).slice(0, 20);

    if (list.length === 0) {
      console.debug('filtered list empty, falling back to raw union');
      const rawSet = {};
      results.forEach((r) => (r.results || []).forEach((m) => {
        if (ids.includes(m.id)) return;
        rawSet[m.id] = m;
      }));
      list = Object.values(rawSet).slice(0, 20);
    }

    // include debugging details when requested or in development
    const resp = { results: list };
    if (process.env.NODE_ENV !== 'production' || req.query.debug === 'true') {
      resp.debug = {
        requestedIds: ids,
        selectedGenres: Array.from(selectedGenres),
        selectedDirectors: Array.from(selectedDirectors),
        rawResults: results.map((r, i) => ({ id: ids[i], count: (r.results || []).length })),
      };
    }
    res.json(resp);
  } catch (err) {
    console.error('recommend error', err);
    res.status(500).json({ error: String(err) });
  }
});

// generic proxy handler for TMDB endpoints
app.use('/api/*', async (req, res) => {
  try {
    const apiPath = req.path.replace(/^\/api/, '');
    const url = new URL(`https://api.themoviedb.org/3${apiPath}`);
    Object.entries(req.query || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    url.searchParams.set('api_key', TMDB_KEY);
    const r = await fetch(url.toString());
    const body = await r.text();
    res.status(r.status).set('content-type', r.headers.get('content-type') || 'application/json').send(body);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

// helper that adds the API key and returns parsed JSON
async function fetchTMDB(path) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  url.searchParams.set('api_key', TMDB_KEY);
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}

// return genre ids for a movie
async function getMovieGenres(id) {
  const data = await fetchTMDB(`/movie/${id}`);
  return (data.genres || []).map((g) => g.id);
}

// return director id (if any) for a movie
async function getMovieDirector(id) {
  const credits = await fetchTMDB(`/movie/${id}/credits`);
  const director = (credits.crew || []).find((c) => c.job === 'Director');
  return director?.id;
}

// return director's directed movies (top by popularity)
async function getDirectorMovies(directorId, limit = 12) {
  const credits = await fetchTMDB(`/person/${directorId}/movie_credits`);
  const directed = (credits.crew || []).filter((c) => c.job === 'Director');
  // dedupe by id and sort by popularity
  const map = {};
  directed.forEach((m) => { if (m && m.id) map[m.id] = m; });
  const list = Object.values(map).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return list.slice(0, limit);
}

// return top movies for a set of genre ids
async function getTopMoviesByGenre(genreIds, limit = 12) {
  if (!genreIds || genreIds.length === 0) return [];
  const genres = Array.isArray(genreIds) ? genreIds.join(',') : String(genreIds);
  const data = await fetchTMDB(`/discover/movie?with_genres=${genres}&sort_by=popularity.desc&page=1`);
  return (data.results || []).slice(0, limit);
}



// In a serverless environment (like Vercel) there is no long-lived
// process and static assets are served by the platform.  We simply export
// the Express app and let the hosting provider handle routing to it.
//
// If you still want a health-check endpoint, you can uncomment the
// following:
// app.get('/', (req, res) => res.send('Proxy function running.'));

// export the Express application as the default export for Vercel
export default app;
