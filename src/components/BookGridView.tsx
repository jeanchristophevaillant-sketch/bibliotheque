import React from 'react';
import { Book } from '../types';
import { Star, Heart, BookOpen, CheckCircle2, Clock, MoreVertical, Edit2, Trash2, Tag, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

interface BookGridViewProps {
  books: Book[];
  selectedBookIds: string[];
  onToggleSelectBook: (id: string) => void;
  onSelectBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (id: string) => void;
  onChangeStatus: (book: Book, status: Book['status']) => void;
}

export const BookGridView: React.FC<BookGridViewProps> = ({
  books,
  selectedBookIds,
  onToggleSelectBook,
  onSelectBook,
  onEditBook,
  onDeleteBook,
  onChangeStatus,
}) => {
  const getStatusBadge = (status: Book['status']) => {
    switch (status) {
      case 'favorite':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700 border border-rose-200">
            <Heart className="w-2.5 h-2.5 fill-rose-500" /> Coup de cœur
          </span>
        );
      case 'read':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" /> Lu
          </span>
        );
      case 'reading':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <BookOpen className="w-2.5 h-2.5" /> En cours
          </span>
        );
      case 'to-read':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-2.5 h-2.5" /> À lire
          </span>
        );
    }
  };

  return (
    <div
      id="books-grid-container"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 my-4"
    >
      {books.map((book) => {
        const isSelected = selectedBookIds.includes(book.id);

        return (
          <motion.div
            key={book.id}
            id={`book-grid-card-${book.id}`}
            layout
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`group bg-white rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between overflow-hidden relative ${
              isSelected ? 'border-amber-600 ring-2 ring-amber-600/30' : 'border-stone-200/90 hover:border-stone-300'
            }`}
          >
            {/* Top Cover Banner */}
            <div
              className="relative p-5 text-white flex flex-col justify-between min-h-[140px] cursor-pointer overflow-hidden"
              style={{
                backgroundColor: book.spineColor || '#78350f',
                backgroundImage:
                  'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.15) 0%, transparent 80%), linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.4))',
              }}
              onClick={() => onSelectBook(book)}
            >
              {/* Spine edge effect */}
              <div className="absolute left-0 top-0 bottom-0 w-3.5 bg-gradient-to-r from-black/40 to-transparent border-r border-white/20" />

              {/* Checkbox and Favorite toggle */}
              <div className="flex items-center justify-between z-10">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSelectBook(book.id);
                  }}
                  className="w-4 h-4 rounded text-amber-800 bg-white/80 border-stone-300 focus:ring-amber-700 cursor-pointer"
                />

                <button
                  id={`quick-fav-${book.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeStatus(book, book.status === 'favorite' ? 'read' : 'favorite');
                  }}
                  className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 backdrop-blur-sm text-white transition"
                  title="Ajouter aux coups de cœur"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      book.status === 'favorite' ? 'fill-rose-500 text-rose-500' : 'text-white/80'
                    }`}
                  />
                </button>
              </div>

              {/* Title & Author on Cover */}
              <div className="z-10 pl-3 pt-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/90 drop-shadow">
                  {book.category}
                </span>
                <h3 className="font-serif-title font-bold text-base sm:text-lg text-white leading-tight line-clamp-2 drop-shadow-md">
                  {book.title}
                </h3>
                <p className="text-xs font-medium text-stone-200/95 mt-1 truncate drop-shadow">
                  {book.author}
                </p>
              </div>
            </div>

            {/* Book Metadata body */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                {/* Status & Rating */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  {getStatusBadge(book.status)}

                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3 h-3 ${
                          star <= book.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-stone-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Subtitle / Publisher / Shelf Info */}
                <div className="space-y-1 text-xs text-stone-500 mb-3">
                  {book.publisher && (
                    <div className="truncate">
                      <span className="font-medium text-stone-700">Éditeur :</span> {book.publisher}
                    </div>
                  )}
                  {book.shelf && (
                    <div className="truncate text-stone-600">
                      <span className="font-medium text-stone-700">Rangement :</span> {book.shelf}
                    </div>
                  )}
                  {book.year && (
                    <div className="flex items-center gap-1 text-stone-500 text-[11px]">
                      <Calendar className="w-3 h-3" /> {book.year} {book.pages ? `• ${book.pages} pages` : ''}
                    </div>
                  )}
                </div>

                {/* Notes preview if any */}
                {book.notes && (
                  <p className="text-xs text-stone-600 italic bg-stone-50 p-2 rounded-lg border border-stone-100 line-clamp-2 mb-2">
                    "{book.notes}"
                  </p>
                )}

                {/* Tags */}
                {book.tags && book.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {book.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-600 font-medium"
                      >
                        <Tag className="w-2.5 h-2.5 text-stone-400" />
                        {tag}
                      </span>
                    ))}
                    {book.tags.length > 3 && (
                      <span className="text-[10px] text-stone-400 font-medium self-center">
                        +{book.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Bottom Actions Bar */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  id={`inspect-book-${book.id}`}
                  onClick={() => onSelectBook(book)}
                  className="text-xs font-semibold text-amber-800 hover:text-amber-900 transition"
                >
                  Consulter la fiche →
                </button>

                <div className="flex items-center gap-1">
                  <button
                    id={`edit-book-btn-${book.id}`}
                    onClick={() => onEditBook(book)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition"
                    title="Modifier ce livre"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`delete-book-btn-${book.id}`}
                    onClick={() => onDeleteBook(book.id)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Supprimer ce livre"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
