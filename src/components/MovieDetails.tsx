import React, { useEffect, useState } from 'react';
import { fetchMovieDetails, fetchWatchProviders, posterPath } from '../services/tmdb';

type Props = {
  movieId: number;
  onClose: () => void;
};

export default function MovieDetails({ movieId, onClose }: Props) {
  const [details, setDetails] = useState<any | null>(null);
  const [providers, setProviders] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetchMovieDetails(movieId);
        if (!alive) return;
        setDetails(d);
      } catch (err) {
        console.error(err);
      }
    })();
    (async () => {
      try {
        const p = await fetchWatchProviders(movieId);
        if (!alive) return;
        setProviders(p || null);
      } catch (err) {
        // non-fatal
      }
    })();
    return () => { alive = false; };
  }, [movieId]);

  if (!details) return <div className="panel">Loading details…</div>;

  const imdb = details.imdb_id ? `https://www.imdb.com/title/${details.imdb_id}` : null;
  const tmdb = `https://www.themoviedb.org/movie/${details.id}`;

  // pick a country entry if available (prefer US)
  const countryKey = providers?.results ? (providers.results['US'] ? 'US' : Object.keys(providers.results)[0]) : null;
  const countryProviders = countryKey ? providers.results[countryKey] : null;

  return (
    <div className="panel movie-details">
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn" onClick={onClose}>Back</button>
        <h2 style={{ margin: 0 }}>{details.title}</h2>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        {details.poster_path && (
          <img src={posterPath(details.poster_path)} alt={details.title} style={{ width: 200, borderRadius: 6 }} />
        )}
        <div>
          <p style={{ marginTop: 0 }}>{details.overview}</p>
          <p><strong>Release:</strong> {details.release_date} • <strong>Runtime:</strong> {details.runtime ?? 'N/A'} mins</p>
          <p><strong>Genres:</strong> {(details.genres || []).map((g: any) => g.name).join(', ')}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {imdb && <a href={imdb} target="_blank" rel="noopener noreferrer" className="btn">Open on IMDB</a>}
            <a href={tmdb} target="_blank" rel="noopener noreferrer" className="btn">Open on TMDB</a>
            {countryProviders && (
              <a href={tmdb + '/watch'} target="_blank" rel="noopener noreferrer" className="btn">Watch options ({countryKey})</a>
            )}
          </div>
          {countryProviders && (
            <div style={{ marginTop: 12 }}>
              <strong>Providers ({countryKey}):</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {['flatrate', 'rent', 'buy'].map(key => (
                  (countryProviders[key] || []).map((p: any) => (
                    <div key={p.provider_id} style={{ padding: '6px 8px', border: '1px solid var(--muted)', borderRadius: 6 }}>{p.provider_name}</div>
                  ))
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
