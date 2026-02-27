import React from 'react';
import MovieCard from './MovieCard';

type Props = {
  recommendations: any[];
  onToggleFavorite?: (m: any) => void;
  favoritesMap?: Record<number, any>;
};

export default function RecommendationPanel({ recommendations, onToggleFavorite, favoritesMap = {} }: Props) {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }
  return (
    <div>
      <h3 className="section-title">Recommendations ({recommendations.length})</h3>
      <div className="movie-grid">
        {recommendations.map(m => (
          <MovieCard key={m.id} movie={m} favorited={!!favoritesMap[m.id]} onToggleFavorite={onToggleFavorite} />
        ))}
      </div>
    </div>
  );
}
