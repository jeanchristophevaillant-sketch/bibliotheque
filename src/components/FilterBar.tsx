import React from 'react';
import { FilterState, BookStatus, ViewMode } from '../types';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  LayoutGrid,
  Library,
  List,
  Table as TableIcon,
  X,
  CheckSquare,
  Square,
  MinusSquare,
} from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  categories: string[];
  shelves: string[];
  totalBooksCount: number;
  filteredBooksCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  selectedBooksCount?: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  categories,
  shelves,
  totalBooksCount,
  filteredBooksCount,
  viewMode,
  onViewModeChange,
  onSelectAll,
  isAllSelected = false,
  selectedBooksCount = 0,
}) => {
  const statusOptions: { id: string; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'all', label: 'Tous les livres', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'bg-stone-100 text-stone-700 hover:bg-stone-200' },
    { id: 'to-read', label: 'À lire', icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
    { id: 'reading', label: 'En cours', icon: <BookOpen className="w-3.5 h-3.5" />, color: 'bg-blue-100 text-blue-800 hover:bg-blue-200' },
    { id: 'read', label: 'Lus', icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' },
    { id: 'favorite', label: 'Coups de cœur', icon: <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />, color: 'bg-rose-100 text-rose-800 hover:bg-rose-200' },
  ];

  const hasActiveFilters =
    filters.search ||
    filters.category ||
    filters.status !== 'all' ||
    filters.shelf ||
    filters.rating > 0;

  const resetFilters = () => {
    onFilterChange({
      ...filters,
      search: '',
      category: '',
      status: 'all',
      shelf: '',
      author: '',
      rating: 0,
    });
  };

  return (
    <div id="filter-bar-container" className="bg-white rounded-2xl shadow-sm border border-stone-200/80 p-4 mb-6 transition-all">
      {/* Top row: Search input + View Switcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-3.5">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            id="book-search-input"
            type="text"
            placeholder="Rechercher par titre, auteur, genre, note ou tag..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-10 py-2 bg-stone-50 hover:bg-stone-100/70 focus:bg-white text-stone-800 placeholder-stone-400 text-sm rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-700/30 focus:border-amber-700 transition"
          />
          {filters.search && (
            <button
              id="clear-search-btn"
              onClick={() => onFilterChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* View Mode Toggle Switcher */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/80 self-start md:self-auto">
          <button
            id="view-shelf-btn"
            title="Vue Étagère Réaliste"
            onClick={() => onViewModeChange('shelf')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'shelf'
                ? 'bg-amber-800 text-amber-50 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <Library className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Étagère</span>
          </button>
          <button
            id="view-grid-btn"
            title="Vue Grille de Couvertures"
            onClick={() => onViewModeChange('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'grid'
                ? 'bg-amber-800 text-amber-50 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grille</span>
          </button>
          <button
            id="view-list-btn"
            title="Vue Liste Détaillée"
            onClick={() => onViewModeChange('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'list'
                ? 'bg-amber-800 text-amber-50 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Liste</span>
          </button>
          <button
            id="view-table-btn"
            title="Vue Tableau Compact"
            onClick={() => onViewModeChange('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              viewMode === 'table'
                ? 'bg-amber-800 text-amber-50 shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/60'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tableau</span>
          </button>
        </div>
      </div>

      {/* Middle row: Status Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {statusOptions.map((opt) => {
          const isActive = filters.status === opt.id;
          return (
            <button
              key={opt.id}
              id={`filter-status-${opt.id}`}
              onClick={() => onFilterChange({ ...filters, status: opt.id })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition border ${
                isActive
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Bottom row: Dropdowns for Category, Shelf, Sorting & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-stone-100 text-xs text-stone-600">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category dropdown */}
          <select
            id="filter-category-select"
            value={filters.category}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className="px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 text-stone-700 text-xs focus:outline-none focus:ring-1 focus:ring-amber-700"
          >
            <option value="">Tous les genres ({categories.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Shelf dropdown */}
          {shelves.length > 0 && (
            <select
              id="filter-shelf-select"
              value={filters.shelf}
              onChange={(e) => onFilterChange({ ...filters, shelf: e.target.value })}
              className="px-2.5 py-1.5 bg-stone-50 hover:bg-stone-100 rounded-lg border border-stone-200 text-stone-700 text-xs focus:outline-none focus:ring-1 focus:ring-amber-700"
            >
              <option value="">Tous les rangements ({shelves.length})</option>
              {shelves.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1 bg-stone-50 rounded-lg border border-stone-200 px-2 py-1">
            <ArrowUpDown className="w-3 h-3 text-stone-400" />
            <select
              id="sort-by-select"
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as [any, any];
                onFilterChange({ ...filters, sortBy, sortOrder });
              }}
              className="bg-transparent text-stone-700 text-xs focus:outline-none cursor-pointer"
            >
              <option value="addedAt-desc">Ajoutés récemment</option>
              <option value="addedAt-asc">Plus anciens d'abord</option>
              <option value="title-asc">Titre (A → Z)</option>
              <option value="title-desc">Titre (Z → A)</option>
              <option value="author-asc">Auteur (A → Z)</option>
              <option value="rating-desc">Meilleures notes (★)</option>
              <option value="year-desc">Année (Récent → Ancien)</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {hasActiveFilters && (
            <button
              id="reset-filters-btn"
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1 text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-lg font-medium transition"
            >
              <X className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          )}
        </div>

        {/* Book counts & Select All button */}
        <div className="flex items-center gap-3">
          {onSelectAll && filteredBooksCount > 0 && (
            <button
              id="select-all-filtered-btn"
              type="button"
              onClick={onSelectAll}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition border cursor-pointer ${
                isAllSelected
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : selectedBooksCount > 0
                  ? 'bg-stone-100 text-stone-800 border-stone-300 hover:bg-stone-200'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
              }`}
              title={isAllSelected ? "Tout désélectionner" : "Sélectionner tous les livres affichés en un clic"}
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-amber-700" />
              ) : selectedBooksCount > 0 ? (
                <MinusSquare className="w-3.5 h-3.5 text-stone-600" />
              ) : (
                <Square className="w-3.5 h-3.5 text-stone-400" />
              )}
              <span>
                {isAllSelected
                  ? `Tout désélectionner (${selectedBooksCount})`
                  : selectedBooksCount > 0
                  ? `Tout sélectionner (${filteredBooksCount})`
                  : `Tout sélectionner (${filteredBooksCount})`}
              </span>
            </button>
          )}

          <div className="text-xs text-stone-500 font-medium">
            Affichage : <span className="font-semibold text-stone-800">{filteredBooksCount}</span> sur {totalBooksCount} livre{totalBooksCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};
