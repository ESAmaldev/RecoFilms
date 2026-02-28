const BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w342';

// default to using the proxy unless explicitly turned off.  This ensures the
// client doesn't accidentally hit TMDB without a key when the build variable
// is missing.
const USE_PROXY = import.meta.env.VITE_USE_PROXY !== 'false';

function buildUrl(path: string, params: Record<string, string | number | undefined> = {}) {
  if (USE_PROXY) {
    // Call the local proxy which will inject server-side API key
    const url = new URL(`/api${path}`, window.location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v));
    });
    return url.toString();
  }
  const key = import.meta.env.VITE_TMDB_API_KEY;
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', String(key ?? ''));
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

function api(path: string, params: Record<string, string | number | undefined> = {}) {
  const url = buildUrl(path, params);
  return fetch(url).then(res => {
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  });
}

export async function fetchPopular(page = 1) {
  return api('/movie/popular', { page });
}

export async function fetchTrending(time_window: 'day' | 'week' = 'week') {
  return api(`/trending/movie/${time_window}`);
}

export async function fetchSearch(query: string, page = 1) {
  const raw = (query || '').trim();
  if (!raw) return { results: [], page: 1, total_pages: 0 };

  // detect trailing year like "Amen 2011" or "Amen (2011)"
  const yearMatch = raw.match(/^(.*?)[\s,]*(?:\(|)?(\d{4})(?:\))?$/);
  let q = raw;
  let year: string | undefined;
  if (yearMatch) {
    // year present at end
    q = (yearMatch[1] || '').trim() || raw.replace(/\(?\d{4}\)?$/, '').trim();
    year = yearMatch[2];
  }

  // primary search: use query and optional year param
  const params: Record<string, string | number | undefined> = { query: q || raw, page };
  if (year) params.year = year;
  const res = await api('/search/movie', params);

  // fallback: if search yields no results but we extracted a year, try searching without year
  if ((res.results || []).length === 0 && year && q) {
    const retry = await api('/search/movie', { query: q, page });
    return retry;
  }

  return res;
}

export async function fetchMovieRecommendations(movieId: number, page = 1) {
  return api(`/movie/${movieId}/recommendations`, { page });
}

export async function fetchMovieDetails(movieId: number) {
  return api(`/movie/${movieId}`);
}

export async function fetchWatchProviders(movieId: number) {
  return api(`/movie/${movieId}/watch/providers`);
}

export function posterPath(path?: string) {
  return path ? IMG_BASE + path : undefined;
}

export default { fetchPopular, fetchMovieRecommendations, fetchSearch, fetchMovieDetails, fetchWatchProviders, posterPath };
