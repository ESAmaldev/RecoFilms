import React, { useEffect, useState } from 'react';
import { posterPath, fetchMovieDetails } from '../services/tmdb';

type Props = {
  movie: any;
  favorited?: boolean;
  onToggleFavorite?: (movie: any) => void;
  selectable?: boolean;
  checked?: boolean;
  onCheck?: (id: number, checked: boolean) => void;
};

export default function MovieCard({ movie, favorited, onToggleFavorite, selectable, checked, onCheck }: Props) {
  const [imdbId, setImdbId] = useState<string | undefined>(movie.imdb_id);

  useEffect(() => {
    if (!imdbId) {
      fetchMovieDetails(movie.id)
        .then(d => {
          if (d && d.imdb_id) setImdbId(d.imdb_id);
        })
        .catch(() => {});
    }
  }, [movie.id, imdbId]);

  return (
    <div className="movie-card">
      <div className="movie-poster-wrap">
        <img src={posterPath(movie.poster_path) ?? ''} alt={movie.title} className="movie-poster" />
      </div>
      <div className="movie-info">
        <div className="movie-title" title={movie.title}>
          <a href={`#/movie/${movie.id}`} onClick={() => { /* hash navigation */ }}>
            {movie.title}
          </a>
        </div>
        <div className="movie-year">{movie.release_date?.slice(0, 4)}</div>
        <div className="movie-actions">
          {onToggleFavorite && (
            <button className={`fav-btn ${favorited ? 'active' : ''}`} onClick={() => onToggleFavorite(movie)}>
              {favorited ? '★ Favorited' : '☆ Favorite'}
            </button>
          )}
        {imdbId && (
          <a href={`https://www.imdb.com/title/${imdbId}`} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
            IMDB
          </a>
        )}
          {selectable && onCheck && (
            <label style={{ marginLeft: 'auto' }}>
              <input type="checkbox" checked={checked} onChange={e => onCheck(movie.id, e.target.checked)} /> Select
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
