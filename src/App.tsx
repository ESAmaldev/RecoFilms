import React, { useEffect, useState } from 'react';
import { fetchPopular, fetchSearch, fetchTrending } from './services/tmdb';
import MovieList from './components/MovieList';
import FavoritesPanel from './components/FavoritesPanel';
import RecommendationPanel from './components/RecommendationPanel';
import MovieDetails from './components/MovieDetails';

const STORAGE_KEY = 'rf_favorites';

export default function App() {
  const [movies, setMovies] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<any[]>([]);
  const [languageFilter, setLanguageFilter] = useState('all');
  const [favMap, setFavMap] = useState<Record<number, any>>({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);

  useEffect(() => {
    // Default to trending movies on the home page
    (async () => {
      try {
        const data = await fetchTrending('week');
        setMovies(data.results || []);
        setPage(Number(data.page || 1));
        setTotalPages(Number(data.total_pages || 1));
      } catch (err) {
        console.error(err);
        loadPage(1, '');
      }
    })();
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    setFavorites(parsed);
    setFavMap(Object.fromEntries(parsed.map((m: any) => [m.id, m])));
  }, []);

  useEffect(() => {
    function handleHash() {
      const h = window.location.hash || '';
      const m = h.match(/^#\/movie\/(\d+)/);
      if (m) setSelectedMovieId(Number(m[1])); else setSelectedMovieId(null);
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  function persist(favs: any[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  }

  async function loadPage(p = 1, q = '') {
    try {
      const trimmed = q?.trim() || '';
      const data = trimmed ? await fetchSearch(trimmed, p) : await fetchPopular(p);
      setMovies(data.results || []);
      setPage(Number(data.page || p));
      setTotalPages(Number(data.total_pages || 1));
    } catch (err) {
      console.error(err);
    }
  }

  function toggleFavorite(movie: any) {
    const exists = favMap[movie.id];
    let next: any[];
    if (exists) {
      next = favorites.filter(f => f.id !== movie.id);
    } else {
      next = [movie, ...favorites];
    }
    setFavorites(next);
    const nextMap = Object.fromEntries(next.map((m: any) => [m.id, m]));
    setFavMap(nextMap);
    persist(next);
  }

  function onCheck(id: number, checked: boolean) {
    const next = new Set(selectedIds);
    if (checked) next.add(id); else next.delete(id);
    setSelectedIds(next);
  }

  function doSearch() {
    const q = (query || '').trim();
    setSelectedIds(new Set());
    setRecommendations([]);
    if (!q) {
      // reset to trending
      (async () => {
        try {
          const data = await fetchTrending('week');
          setMovies(data.results || []);
          setPage(Number(data.page || 1));
          setTotalPages(Number(data.total_pages || 1));
        } catch (err) {
          console.error(err);
        }
      })();
      return;
    }
    loadPage(1, q);
  }

  function gotoPage(p: number) {
    if (p < 1 || p > totalPages) return;
    loadPage(p, query);
  }

  async function recommend() {
    if (selectedIds.size === 0) return alert('Select at least one favorite');
    setLoading(true);
    try {
      const ids = Array.from(selectedIds);
      // ask the server to merge & filter by genre/director
      const r = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!r.ok) {
        const text = await r.text().catch(() => '<no body>');
        console.error('recommend request failed', r.status, text);
        throw new Error('recommend request failed');
      }
      const data = await r.json();
      const list = data.results || [];
      if (list.length === 0) {
        console.warn('recommend response empty', data);
        alert('No recommendations available for those selections');
      }
      setRecommendations(list);
    } catch (err) {
      console.error(err);
      alert('Unable to get recommendations');
    } finally {
      setLoading(false);
    }
  }

  function resetFavorites() {
    if (!window.confirm('Are you sure you want to reset all your favorites?')) return;
    setFavorites([]);
    setFavMap({});
    persist([]);
    setSelectedIds(new Set());
  }

  return (
    <div className="app-container">
      <h1 className="app-title">RecoFilms<span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginLeft: 16, fontWeight: 500 }}>Movie recommender</span></h1>
      <div className="main-layout">
        <div className="content-area">
          {selectedMovieId ? (
            <MovieDetails movieId={selectedMovieId!} onClose={() => { window.location.hash = ''; }} />
          ) : (
            <>
          <div className="search-bar">
            <input type="text" placeholder="Search movies by title" value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1 }} />
            <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)} style={{ marginLeft: 12 }}>
              <option value="all">All languages</option>
              {Array.from(new Set(movies.map(m => m.original_language).filter(Boolean))).sort().map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={doSearch}>Search</button>
            <button className="btn-danger" onClick={() => { setQuery(''); loadPage(1, ''); }}>Clear</button>
          </div>
          <h2 className="section-title">{query ? `Search results for "${query}"` : 'Trending Movies'}</h2>
          {(() => {
            const filtered = languageFilter === 'all' ? movies : movies.filter(m => m.original_language === languageFilter);
            return <MovieList movies={filtered} favorites={favMap} onToggleFavorite={toggleFavorite} />;
          })()}
          <div className="pagination">
            <button onClick={() => gotoPage(page - 1)} disabled={page <= 1}>Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => gotoPage(page + 1)} disabled={page >= totalPages}>Next</button>
          </div>
            </>
          )}
        </div>
        <div className="sidebar">
          <FavoritesPanel favorites={favorites} onToggleFavorite={toggleFavorite} selectedIds={selectedIds} onCheck={onCheck} onReset={resetFavorites} />
          <div className="panel" style={{ marginTop: 24 }}>
            <div className="action-bar">
              <button className="btn-primary" style={{ flex: 1 }} onClick={recommend} disabled={loading}>{loading ? 'Finding...' : 'Recommend from selected'}</button>
              <button className="btn-danger" onClick={() => { setSelectedIds(new Set()); setRecommendations([]); }}>Clear</button>
            </div>
            <RecommendationPanel recommendations={recommendations} onToggleFavorite={toggleFavorite} favoritesMap={favMap} />
          </div>
        </div>
      </div>
    </div>
  );
}
