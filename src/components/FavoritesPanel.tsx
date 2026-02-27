import React from 'react';
import MovieCard from './MovieCard';

type Props = {
  favorites: any[];
  onToggleFavorite: (m: any) => void;
  selectedIds: Set<number>;
  onCheck: (id: number, checked: boolean) => void;
  onReset?: () => void;
};

export default function FavoritesPanel({ favorites, onToggleFavorite, selectedIds, onCheck, onReset }: Props) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Your Favorites ({favorites.length})</h3>
        {onReset && <button className="btn-danger" onClick={onReset}>Reset All</button>}
      </div>
      {favorites.length === 0 ? (
        <div className="empty-state">No favorites yet. Explore movies and click "Favorite" to add them here!</div>
      ) : (
        <div className="movie-grid">
          {favorites.map(m => (
            <MovieCard key={m.id} movie={m} favorited onToggleFavorite={onToggleFavorite} selectable checked={selectedIds.has(m.id)} onCheck={onCheck} />
          ))}
        </div>
      )}
    </div>
  );
}
