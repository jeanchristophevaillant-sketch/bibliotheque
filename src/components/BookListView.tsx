import React from 'react';
import { Book, ViewMode } from '../types';
import {
  Star,
  Heart,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Tag,
  Calendar,
  Layers,
} from 'lucide-react';

interface BookListViewProps {
  books: Book[];
  viewMode: ViewMode;
  selectedBookIds: string[];
  onToggleSelectBook: (id: string) => void;
  onSelectBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onChangeStatus: (book: Book, status: Book['status']) => void;
  onSelectAll?: () => void;
}

export const BookListView: React.FC<BookListViewProps> = ({
  books,
  viewMode,
  selectedBookIds,
  onToggleSelectBook,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onChangeStatus,
  onSelectAll,
}) => {
  const isAllSelected = books.length > 0 && books.every((b) => selectedBookIds.includes(b.id));
  const isPartiallySelected = books.some((b) => selectedBookIds.includes(b.id)) && !isAllSelected;

  const getStatusBadge = (status: Book['status']) => {
    switch (status) {
      case 'favorite':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            <Heart className="w-3 h-3 fill-rose-500" /> Coup de cœur
          </span>
        );
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Lu
          </span>
        );
      case 'reading':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <BookOpen className="w-3 h-3" /> En cours
          </span>
        );
      case 'to-read':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" /> À lire
          </span>
        );
    }
  };

  // If table mode
  if (viewMode === 'table') {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden my-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-600">
            <thead className="bg-stone-50 border-b border-stone-200 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="p-3.5 w-8">
                  {onSelectAll && books.length > 0 && (
                    <input
                      id="table-master-select-all"
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = isPartiallySelected;
                        }
                      }}
                      onChange={onSelectAll}
                      className="w-4 h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700 cursor-pointer"
                      title={isAllSelected ? "Tout désélectionner" : "Tout sélectionner"}
                    />
                  )}
                </th>
                <th className="p-3.5">Titre</th>
                <th className="p-3.5">Auteur</th>
                <th className="p-3.5">Genre</th>
                <th className="p-3.5">Éditeur / Année</th>
                <th className="p-3.5">Statut</th>
                <th className="p-3.5">Note</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-sans">
              {books.map((book) => {
                const isSelected = selectedBookIds.includes(book.id);
                return (
                  <tr
                    key={book.id}
                    className={`hover:bg-stone-50/80 transition cursor-pointer ${
                      isSelected ? 'bg-amber-50/50' : ''
                    }`}
                    onClick={() => onSelectBook(book)}
                  >
                    <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectBook(book.id)}
                        className="w-4 h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700 cursor-pointer"
                      />
                    </td>
                    <td className="p-3.5 font-medium text-stone-900">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-6 rounded-sm shadow-sm flex-shrink-0"
                          style={{ backgroundColor: book.spineColor || '#78350f' }}
                        />
                        <div>
                          <div className="font-serif-title font-semibold text-sm text-stone-900">
                            {book.title}
                          </div>
                          {book.subtitle && (
                            <div className="text-[10px] text-stone-400">{book.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3.5 font-medium text-stone-700">{book.author}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 text-stone-700 font-medium">
                        {book.category}
                      </span>
                    </td>
                    <td className="p-3.5 text-stone-500">
                      {book.publisher || '—'} {book.year ? `(${book.year})` : ''}
                    </td>
                    <td className="p-3.5">{getStatusBadge(book.status)}</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-0.5">
                        {book.rating > 0 ? (
                          <>
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span className="font-bold text-stone-700">{book.rating}/5</span>
                          </>
                        ) : (
                          <span className="text-stone-300">—</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditBook(book)}
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
                          title="Modifier"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteBook(book.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Detailed List View
  return (
    <div id="books-list-container" className="space-y-3 my-4">
      {books.map((book) => {
        const isSelected = selectedBookIds.includes(book.id);

        return (
          <div
            key={book.id}
            id={`book-list-item-${book.id}`}
            onClick={() => onSelectBook(book)}
            className={`bg-white rounded-2xl border transition p-4 sm:p-5 shadow-sm hover:shadow-md cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              isSelected ? 'border-amber-600 ring-2 ring-amber-600/30' : 'border-stone-200 hover:border-stone-300'
            }`}
          >
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              {/* Checkbox */}
              <div className="pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelectBook(book.id)}
                  className="w-4 h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700 cursor-pointer"
                />
              </div>

              {/* Book Spine Thumbnail */}
              <div
                className="w-4 sm:w-5 h-16 sm:h-20 rounded-md shadow-sm border-l border-white/30 border-r border-black/20 flex-shrink-0 relative overflow-hidden"
                style={{ backgroundColor: book.spineColor || '#78350f' }}
              >
                <div className="absolute top-1 left-0 right-0 h-[1px] bg-amber-300/60" />
                <div className="absolute bottom-1 left-0 right-0 h-[1px] bg-amber-300/60" />
              </div>

              {/* Book Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700">
                    {book.category}
                  </span>
                  {getStatusBadge(book.status)}
                  {book.shelf && (
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> {book.shelf}
                    </span>
                  )}
                </div>

                <h3 className="font-serif-title font-bold text-base sm:text-lg text-stone-900 leading-snug">
                  {book.title}
                </h3>
                <p className="text-xs sm:text-sm font-medium text-stone-600 mt-0.5">
                  {book.author}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-stone-400 mt-1.5">
                  {book.publisher && <span>Édition : {book.publisher}</span>}
                  {book.year && <span>Année : {book.year}</span>}
                  {book.pages && <span>{book.pages} pages</span>}
                  {book.notes && (
                    <span className="italic text-stone-500 truncate max-w-xs">
                      "{book.notes}"
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Rating + Action Buttons */}
            <div
              className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Rating stars */}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= book.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-200'
                    }`}
                  />
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button
                  id={`list-fav-${book.id}`}
                  onClick={() => onChangeStatus(book, book.status === 'favorite' ? 'read' : 'favorite')}
                  className="p-2 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition"
                  title="Coup de cœur"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      book.status === 'favorite' ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
                <button
                  id={`list-edit-${book.id}`}
                  onClick={() => onEditBook(book)}
                  className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition"
                  title="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  id={`list-delete-${book.id}`}
                  onClick={() => onDeleteBook(book.id)}
                  className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
