import React, { useState } from 'react';
import { Book } from '../types';
import { BookOpen, Heart, Star, Sparkles, Plus, Eye } from 'lucide-react';
import { motion } from 'motion/react';

interface BookShelfViewProps {
  books: Book[];
  onSelectBook: (book: Book) => void;
  onOpenScanModal: () => void;
  onAddManual: () => void;
}

export const BookShelfView: React.FC<BookShelfViewProps> = ({
  books,
  onSelectBook,
  onOpenScanModal,
  onAddManual,
}) => {
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);

  if (books.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200/80 shadow-sm my-6 max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-amber-800 border border-amber-200">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-serif-title font-semibold text-stone-900 mb-2">
          Aucun livre sur cette étagère
        </h3>
        <p className="text-stone-500 text-sm mb-6 max-w-md mx-auto">
          Prenez une photo de votre bibliothèque physique pour ajouter automatiquement tous vos livres grâce à l'OCR par IA !
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            id="empty-shelf-scan-btn"
            onClick={onOpenScanModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-medium text-sm shadow-sm transition"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Scanner ma bibliothèque (Photos)</span>
          </button>
          <button
            id="empty-shelf-manual-btn"
            onClick={onAddManual}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium text-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter manuellement</span>
          </button>
        </div>
      </div>
    );
  }

  // Split books into realistic shelves of ~12-16 books per shelf level
  const BOOKS_PER_SHELF = 14;
  const shelfRows: Book[][] = [];
  for (let i = 0; i < books.length; i += BOOKS_PER_SHELF) {
    shelfRows.push(books.slice(i, i + BOOKS_PER_SHELF));
  }

  return (
    <div id="bookshelf-view-container" className="space-y-10 my-4">
      {shelfRows.map((row, shelfIndex) => (
        <div key={shelfIndex} className="relative group">
          {/* Top shelf header / label */}
          <div className="flex items-center justify-between px-3 mb-2 text-xs font-semibold tracking-wider text-amber-950 uppercase opacity-80">
            <span className="flex items-center gap-1.5 font-cinzel">
              <span className="w-2 h-2 rounded-full bg-amber-700 inline-block"></span>
              Rayon N°{shelfIndex + 1} ({row.length} ouvrages)
            </span>
            <span className="text-[11px] text-stone-400 font-normal">
              Cliquez sur un livre pour l'inspecter
            </span>
          </div>

          {/* Wooden Shelf Container with Depth Shadow */}
          <div className="relative bg-gradient-to-b from-stone-900/10 via-stone-800/5 to-amber-950/20 rounded-2xl p-4 sm:p-6 border border-amber-950/20 shadow-inner">
            {/* Shelf Backing texture */}
            <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-40 rounded-2xl pointer-events-none" />

            {/* Books Row */}
            <div className="relative z-10 flex items-end justify-start gap-1.5 sm:gap-2.5 overflow-x-auto pt-8 pb-1 px-2 scrollbar-none min-h-[260px]">
              {row.map((book, bIndex) => {
                // Calculate dynamic spine dimensions based on pages & pseudo-seed
                const pageCount = book.pages || 280;
                const widthPx = Math.min(52, Math.max(34, Math.floor(pageCount / 18)));
                const heightPx = 180 + ((book.title.length * 7 + bIndex * 13) % 45); // Height variance between 180px and 225px
                const isHovered = hoveredBookId === book.id;

                const spineBg = book.spineColor || '#78350f';

                return (
                  <motion.div
                    key={book.id}
                    id={`shelf-book-${book.id}`}
                    whileHover={{ y: -16, scale: 1.04 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 20 }}
                    onMouseEnter={() => setHoveredBookId(book.id)}
                    onMouseLeave={() => setHoveredBookId(null)}
                    onClick={() => onSelectBook(book)}
                    className="relative cursor-pointer flex-shrink-0 group/book select-none"
                    style={{
                      width: `${widthPx}px`,
                      height: `${heightPx}px`,
                    }}
                  >
                    {/* Spine Body */}
                    <div
                      className="w-full h-full rounded-t-sm rounded-b-none flex flex-col justify-between items-center py-2 px-1 text-center shadow-md relative overflow-hidden transition-all duration-200 border-l border-white/20 border-r border-black/30"
                      style={{
                        backgroundColor: spineBg,
                        boxShadow: isHovered
                          ? '0 18px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)'
                          : '0 4px 6px -1px rgba(0, 0, 0, 0.25)',
                      }}
                    >
                      {/* Spine top golden ribbing */}
                      <div className="w-full border-t border-b border-amber-300/40 py-0.5 mb-1 flex flex-col items-center">
                        <div className="w-3/4 h-[1px] bg-amber-200/50"></div>
                      </div>

                      {/* Vertical Title & Author container */}
                      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden w-full px-0.5">
                        <div
                          className="text-amber-100 font-serif-title font-medium text-[11px] leading-tight tracking-wide transform -rotate-90 whitespace-nowrap overflow-hidden text-ellipsis max-w-[140px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]"
                          title={book.title}
                        >
                          {book.title}
                        </div>
                      </div>

                      {/* Author on spine bottom */}
                      <div className="w-full mt-auto pt-1 flex flex-col items-center border-t border-white/10">
                        <span className="text-amber-200/80 text-[8px] font-sans font-semibold truncate max-w-full tracking-wider uppercase">
                          {book.author.split(' ').pop() || book.author}
                        </span>
                        {/* Golden bottom ribbing */}
                        <div className="w-2/3 h-[1px] bg-amber-300/40 mt-1"></div>
                      </div>

                      {/* Status Bookmark Ribbon */}
                      {book.status === 'favorite' && (
                        <div className="absolute -top-1 right-1 text-rose-300 drop-shadow">
                          <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                        </div>
                      )}
                      {book.status === 'reading' && (
                        <div className="absolute top-0 right-0 w-2 h-4 bg-blue-500 shadow-sm"></div>
                      )}
                      {book.status === 'read' && (
                        <div className="absolute top-0 right-0 w-2 h-4 bg-emerald-500 shadow-sm"></div>
                      )}
                    </div>

                    {/* Hover Floating Details Tooltip */}
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 p-3 bg-stone-900/95 backdrop-blur-md text-stone-100 rounded-xl shadow-2xl z-50 text-left border border-stone-700 pointer-events-none"
                      >
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                            {book.category}
                          </span>
                          {book.rating > 0 && (
                            <span className="flex items-center text-amber-400 text-xs font-bold">
                              <Star className="w-3 h-3 fill-amber-400 mr-0.5" />
                              {book.rating}
                            </span>
                          )}
                        </div>
                        <h4 className="font-serif-title font-semibold text-sm leading-snug text-white line-clamp-2 mb-0.5">
                          {book.title}
                        </h4>
                        <p className="text-xs text-stone-300 font-medium mb-1.5">
                          {book.author}
                        </p>
                        {book.publisher && (
                          <div className="text-[10px] text-stone-400 mb-1">
                            Édition : {book.publisher} {book.year ? `(${book.year})` : ''}
                          </div>
                        )}
                        <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[10px] text-amber-300 font-medium">
                          <span>
                            {book.status === 'favorite' ? '★ Coup de cœur' : book.status === 'read' ? '✓ Lu' : book.status === 'reading' ? '📖 En cours' : '⏳ À lire'}
                          </span>
                          <span className="flex items-center gap-1 text-stone-400">
                            <Eye className="w-3 h-3" /> Ouvrir la fiche
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Solid Wood Shelf Base Layer */}
            <div className="relative -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 mt-0">
              {/* Shelf Top Edge bevel */}
              <div className="h-3 bg-gradient-to-r from-amber-800 via-amber-700 to-amber-800 border-t border-amber-600/60 shadow-sm" />
              {/* Shelf Plinth wood block */}
              <div className="h-6 bg-gradient-to-r from-amber-950 via-stone-900 to-amber-950 rounded-b-2xl flex items-center justify-between px-6 border-b border-stone-800 shadow-md">
                <span className="text-[10px] font-cinzel text-amber-500/70 tracking-widest uppercase">
                  Bois de Chêne Doré
                </span>
                <span className="text-[10px] text-amber-200/50">
                  Étagère N°{shelfIndex + 1}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
