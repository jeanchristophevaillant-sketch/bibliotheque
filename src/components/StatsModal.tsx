import React from 'react';
import { Book } from '../types';
import {
  X,
  PieChart,
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  Layers,
  Sparkles,
  Users,
  Bookmark,
} from 'lucide-react';
import { motion } from 'motion/react';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose, books }) => {
  if (!isOpen) return null;

  const total = books.length;
  const readCount = books.filter((b) => b.status === 'read' || b.status === 'favorite').length;
  const readingCount = books.filter((b) => b.status === 'reading').length;
  const toReadCount = books.filter((b) => b.status === 'to-read').length;
  const favCount = books.filter((b) => b.status === 'favorite').length;

  const readPercent = total > 0 ? Math.round((readCount / total) * 100) : 0;
  const totalPages = books.reduce((acc, b) => acc + (b.pages || 250), 0);

  // Category counts
  const categoryMap: { [cat: string]: number } = {};
  books.forEach((b) => {
    const cat = b.category || 'Autre';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });
  const sortedCategories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  // Top Authors
  const authorMap: { [auth: string]: number } = {};
  books.forEach((b) => {
    const auth = b.author || 'Inconnu';
    authorMap[auth] = (authorMap[auth] || 0) + 1;
  });
  const sortedAuthors = Object.entries(authorMap)
    .filter(([auth]) => auth !== 'Inconnu' && auth !== 'Auteur inconnu')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Shelves count
  const shelfMap: { [shelf: string]: number } = {};
  books.forEach((b) => {
    const s = b.shelf || 'Non classé';
    shelfMap[s] = (shelfMap[s] || 0) + 1;
  });

  return (
    <div
      id="stats-modal-backdrop"
      className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-950 to-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-title text-lg font-bold">
                Statistiques & Vue d'Ensemble
              </h3>
              <p className="text-xs text-amber-200/80">
                Analyse de votre collection de livres et progression de lecture
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80">
              <span className="text-stone-500 text-xs block mb-1">Total Ouvrages</span>
              <span className="font-serif-title font-bold text-2xl text-amber-950">{total}</span>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80">
              <span className="text-stone-500 text-xs block mb-1">Livres Lus</span>
              <span className="font-serif-title font-bold text-2xl text-emerald-900">{readCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/80">
              <span className="text-stone-500 text-xs block mb-1">En cours</span>
              <span className="font-serif-title font-bold text-2xl text-blue-900">{readingCount}</span>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200/80">
              <span className="text-stone-500 text-xs block mb-1">Coups de cœur</span>
              <span className="font-serif-title font-bold text-2xl text-rose-900">{favCount}</span>
            </div>
          </div>

          {/* Reading Progress Bar */}
          <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-800">
                Progression globale de la bibliothèque
              </span>
              <span className="font-bold text-amber-900">{readPercent}% lu</span>
            </div>
            <div className="w-full h-3 bg-stone-200 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-600 h-full transition-all duration-500"
                style={{ width: `${total > 0 ? (readCount / total) * 100 : 0}%` }}
                title={`Lus (${readCount})`}
              />
              <div
                className="bg-blue-500 h-full transition-all duration-500"
                style={{ width: `${total > 0 ? (readingCount / total) * 100 : 0}%` }}
                title={`En cours (${readingCount})`}
              />
              <div
                className="bg-amber-400 h-full transition-all duration-500"
                style={{ width: `${total > 0 ? (toReadCount / total) * 100 : 0}%` }}
                title={`À lire (${toReadCount})`}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-stone-500 pt-1">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block"></span> Lus ({readCount})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span> En cours ({readingCount})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span> À lire ({toReadCount})
              </span>
            </div>
          </div>

          {/* Categories Breakdown */}
          <div>
            <h4 className="font-serif-title font-semibold text-stone-900 text-sm mb-3">
              Répartition par Genre Littéraire
            </h4>
            <div className="space-y-2">
              {sortedCategories.map(([cat, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={cat} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-700">{cat}</span>
                      <span className="text-stone-500 font-semibold">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-800 h-full rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Authors */}
          {sortedAuthors.length > 0 && (
            <div>
              <h4 className="font-serif-title font-semibold text-stone-900 text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-stone-600" />
                Auteurs les plus représentés
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {sortedAuthors.map(([author, count]) => (
                  <div
                    key={author}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs"
                  >
                    <div className="font-semibold text-stone-800 truncate">{author}</div>
                    <div className="text-[11px] text-amber-900 font-medium">
                      {count} ouvrage{count > 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-semibold border border-stone-200 transition"
          >
            Fermer
          </button>
        </div>
      </motion.div>
    </div>
  );
};
