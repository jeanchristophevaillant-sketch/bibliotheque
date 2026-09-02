import React, { useState } from 'react';
import { Book, BookStatus } from '../types';
import {
  X,
  Heart,
  Star,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2,
  Sparkles,
  Calendar,
  Layers,
  Tag,
  Share2,
  Check,
  Globe,
  RotateCw,
} from 'lucide-react';
import { motion } from 'motion/react';

interface BookDetailModalProps {
  book: Book | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  onUpdateBook: (book: Book) => void;
}

export const BookDetailModal: React.FC<BookDetailModalProps> = ({
  book,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onUpdateBook,
}) => {
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichSuccess, setEnrichSuccess] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cleanOverwrite, setCleanOverwrite] = useState(true);

  if (!isOpen || !book) return null;

  const handleStatusChange = (newStatus: BookStatus) => {
    onUpdateBook({ ...book, status: newStatus });
  };

  const handleRatingChange = (newRating: number) => {
    onUpdateBook({ ...book, rating: newRating === book.rating ? 0 : newRating });
  };

  const handleClearNotes = () => {
    if (confirm(`Voulez-vous effacer le résumé et les notes actuelles de "${book.title}" pour repartir de zéro ?`)) {
      onUpdateBook({ ...book, notes: '' });
      setEnrichSuccess('🗑️ Résumé et notes réinitialisés à vide.');
      setTimeout(() => setEnrichSuccess(null), 3000);
    }
  };

  const handleEnrich = async (mode: 'public' | 'ai') => {
    setIsEnriching(true);
    setEnrichSuccess(null);
    setEnrichError(null);

    try {
      const res = await fetch('/api/enrich-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: book.title, author: book.author, mode }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Impossible d’enrichir les données.');
      }

      const data = await res.json();
      if (data.success && data.data) {
        const enriched = data.data;
        const newSynopsis = enriched.synopsis || '';
        
        // If cleanOverwrite is true, replace the summary completely with the new clean French synopsis
        const updatedNotes = cleanOverwrite
          ? newSynopsis
          : book.notes
          ? `${book.notes}\n\n${newSynopsis}`
          : newSynopsis;

        const updated: Book = {
          ...book,
          notes: updatedNotes,
          year: enriched.originalYear || book.year,
          pages: enriched.pagesEstimate || book.pages,
          category: enriched.genre || book.category,
          publisher: enriched.publisher || book.publisher,
          coverImage: enriched.coverUrl || book.coverImage,
          tags: enriched.tags && enriched.tags.length > 0 ? enriched.tags : book.tags,
        };
        onUpdateBook(updated);
        setEnrichSuccess(
          mode === 'public'
            ? `✅ Données et résumé réinitialisés proprement depuis ${data.source || 'la base publique'} !`
            : '✅ Fiche littéraire et résumé générés à neuf par IA !'
        );
        setTimeout(() => setEnrichSuccess(null), 4000);
      }
    } catch (e: any) {
      console.error('Enrich failed:', e);
      setEnrichError(e.message || 'Erreur lors de la recherche.');
      setTimeout(() => setEnrichError(null), 4500);
    } finally {
      setIsEnriching(false);
    }
  };

  const copyBookDetails = () => {
    const text = `📖 ${book.title} par ${book.author}
Genre: ${book.category}
Emplacement: ${book.shelf}
Statut: ${book.status} | Note: ${book.rating}/5
${book.notes ? `Notes & Résumé: ${book.notes}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="book-detail-modal-backdrop"
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
        {/* Header Cover Bar */}
        <div
          className="p-6 sm:p-8 text-white relative flex flex-col justify-between overflow-hidden shadow-inner"
          style={{
            backgroundColor: book.spineColor || '#78350f',
            backgroundImage:
              'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.2) 0%, transparent 80%), linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.5))',
          }}
        >
          {/* Spine effect border */}
          <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-black/40 to-transparent border-r border-white/20" />

          {/* Close & Share buttons */}
          <div className="flex items-center justify-between z-10 mb-4 pl-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/20 backdrop-blur-md text-amber-200 border border-white/20">
              {book.category}
            </span>
            <div className="flex items-center gap-2">
              <button
                id="copy-book-details-btn"
                onClick={copyBookDetails}
                className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition cursor-pointer"
                title="Copier les détails"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              </button>
              <button
                id="close-book-details-btn"
                onClick={onClose}
                className="p-2 rounded-full bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Book Title & Author */}
          <div className="z-10 pl-3">
            <h2 className="font-serif-title text-2xl sm:text-3xl font-bold tracking-tight mb-1 drop-shadow-md">
              {book.title}
            </h2>
            {book.subtitle && (
              <p className="text-sm sm:text-base text-amber-100 font-serif-title italic mb-2">
                {book.subtitle}
              </p>
            )}
            <p className="text-stone-200 font-medium text-sm sm:text-base">
              par <span className="font-semibold text-white">{book.author}</span>
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 text-stone-800">
          {/* Quick Actions & Status */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
            {/* Reading Status Selector */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                Statut de lecture
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'to-read', label: 'À lire', icon: Clock },
                  { id: 'reading', label: 'En cours', icon: BookOpen },
                  { id: 'read', label: 'Lu', icon: CheckCircle2 },
                  { id: 'favorite', label: 'Coup de cœur', icon: Heart },
                ].map((st) => {
                  const Icon = st.icon;
                  const isActive = book.status === st.id;
                  return (
                    <button
                      key={st.id}
                      onClick={() => handleStatusChange(st.id as BookStatus)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                        isActive
                          ? 'bg-amber-800 text-white border-amber-800 shadow-sm'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      <Icon
                        className={`w-3.5 h-3.5 ${
                          st.id === 'favorite' && isActive ? 'fill-white' : ''
                        }`}
                      />
                      <span>{st.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Star Rating */}
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">
                Ma Note
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRatingChange(star)}
                    className="p-1 hover:scale-110 transition cursor-pointer"
                    title={`Noter ${star}/5`}
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= (book.rating || 0)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-stone-200 hover:text-amber-200'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Édition / Collection</span>
              <span className="font-semibold text-stone-800">{book.publisher || 'Non précisé'}</span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Année de parution</span>
              <span className="font-semibold text-stone-800">{book.year || 'Non précisée'}</span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Nombre de pages</span>
              <span className="font-semibold text-stone-800">
                {book.pages ? `${book.pages} pages` : 'Non précisé'}
              </span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-amber-200 bg-amber-50/50">
              <span className="text-amber-800/80 block mb-0.5 font-medium">Localisation / Étagère</span>
              <span className="font-bold text-amber-950">{book.shelf || 'Bibliothèque principale'}</span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Genre littéraire</span>
              <span className="font-semibold text-stone-800">{book.category}</span>
            </div>
            <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
              <span className="text-stone-400 block mb-0.5">Ajouté le</span>
              <span className="font-semibold text-stone-800">
                {new Date(book.addedAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>

          {/* Notes & Summary with Free Public DB and AI options */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <h4 className="font-serif-title font-semibold text-stone-900 text-sm">
                  Notes, Citations & Résumé
                </h4>
                {book.notes && (
                  <button
                    id="clear-book-notes-btn"
                    type="button"
                    onClick={handleClearNotes}
                    className="flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 transition cursor-pointer"
                    title="Remettre le résumé à vide"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Vider le résumé</span>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-stone-600 cursor-pointer mr-1" title="Remplacer le texte existant au lieu de l'accumuler">
                  <input
                    type="checkbox"
                    checked={cleanOverwrite}
                    onChange={(e) => setCleanOverwrite(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-800 border-stone-300 focus:ring-amber-700"
                  />
                  <span>Remplacer à neuf</span>
                </label>
                <button
                  id="enrich-public-btn"
                  onClick={() => handleEnrich('public')}
                  disabled={isEnriching}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold border border-amber-200 transition disabled:opacity-50 cursor-pointer shadow-xs"
                  title="Enrichir via le Catalogue général de la BnF (Bibliothèque nationale de France) et bases publiques francophones"
                >
                  <Globe className="w-3.5 h-3.5 text-amber-700" />
                  <span>Catalogue BnF / Bases publiques</span>
                </button>
                <button
                  id="enrich-ai-btn"
                  onClick={() => handleEnrich('ai')}
                  disabled={isEnriching}
                  className="flex items-center gap-1 px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-semibold border border-stone-300 transition disabled:opacity-50 cursor-pointer"
                  title="Enrichir avec l'IA Gemini"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>IA Gemini</span>
                </button>
              </div>
            </div>

            {enrichSuccess && (
              <div className="p-2.5 mb-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{enrichSuccess}</span>
              </div>
            )}

            {enrichError && (
              <div className="p-2.5 mb-2 rounded-xl bg-rose-50 text-rose-800 text-xs border border-rose-200 flex items-center gap-1.5">
                <X className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{enrichError}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-xs leading-relaxed text-stone-700 whitespace-pre-line min-h-[80px]">
              {book.notes || (
                <span className="text-stone-400 italic">
                  Aucune note ou résumé. Cliquez sur "Base publique gratuite" ou "IA Gemini" pour obtenir automatiquement un résumé, ou sur "Modifier" pour écrire le vôtre.
                </span>
              )}
            </div>
          </div>

          {/* Tags */}
          {book.tags && book.tags.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">
                Étiquettes & Thèmes
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {book.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium border border-stone-200"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
          <button
            id="delete-book-detail-btn"
            onClick={() => {
              if (confirm(`Voulez-vous vraiment supprimer "${book.title}" ?`)) {
                onDelete(book.id);
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Supprimer le livre</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              id="edit-book-detail-btn"
              onClick={() => {
                onClose();
                onEdit(book);
              }}
              className="flex items-center gap-1.5 px-5 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Modifier la fiche</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
