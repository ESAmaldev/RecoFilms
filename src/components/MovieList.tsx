import React from 'react';
import MovieCard from './MovieCard';

type Props = {
  movies: any[];
  favorites: Record<number, any>;
  onToggleFavorite: (m: any) => void;
};

export default function MovieList({ movies, favorites, onToggleFavorite }: Props) {
  if (!movies || movies.length === 0) {
    return <div className="empty-state" style={{ marginTop: 32 }}>No movies found. Try a different search!</div>;
  }
  return (
    <div className="movie-grid">
      {movies.map(m => (
        <MovieCard key={m.id} movie={m} favorited={!!favorites[m.id]} onToggleFavorite={onToggleFavorite} />
      ))}
    </div>
  );
}
