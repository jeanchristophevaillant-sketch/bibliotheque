import React, { useState } from 'react';
import { Book, BookStatus } from '../types';
import {
  X,
  CheckSquare,
  MapPin,
  Tag,
  BookOpen,
  Star,
  CheckCircle2,
  Clock,
  Heart,
  Save,
  Sparkles,
  Library,
  FileText,
  Layers,
  Search,
  Check,
  RotateCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BatchEditModalProps {
  isOpen: boolean;
  selectedBooks: Book[];
  existingShelves: string[];
  existingCategories: string[];
  onClose: () => void;
  onApplyChanges: (updatedBooks: Book[]) => void;
}

export const BatchEditModal: React.FC<BatchEditModalProps> = ({
  isOpen,
  selectedBooks,
  existingShelves,
  existingCategories,
  onClose,
  onApplyChanges,
}) => {
  // Enabled fields toggles
  const [updateShelf, setUpdateShelf] = useState(true);
  const [shelfValue, setShelfValue] = useState(existingShelves[0] || 'Salon - Étagère Principale');
  const [customShelf, setCustomShelf] = useState('');
  const [isCustomShelf, setIsCustomShelf] = useState(false);

  const [updateCategory, setUpdateCategory] = useState(false);
  const [categoryValue, setCategoryValue] = useState(existingCategories[0] || 'Roman');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const [updateStatus, setUpdateStatus] = useState(false);
  const [statusValue, setStatusValue] = useState<BookStatus>('read');

  const [updateRating, setUpdateRating] = useState(false);
  const [ratingValue, setRatingValue] = useState<number>(5);

  const [updateTags, setUpdateTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tagMode, setTagMode] = useState<'append' | 'replace'>('append');

  const [updateNotes, setUpdateNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesMode, setNotesMode] = useState<'append' | 'replace' | 'clear'>('append');

  // Batch enrichment state
  const [isEnrichingBatch, setIsEnrichingBatch] = useState(false);
  const [batchOverwrite, setBatchOverwrite] = useState(true);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [enrichSummary, setEnrichSummary] = useState<string | null>(null);

  if (!isOpen || selectedBooks.length === 0) return null;

  const finalShelf = isCustomShelf ? customShelf.trim() : shelfValue;
  const finalCategory = isCustomCategory ? customCategory.trim() : categoryValue;

  const handleApply = () => {
    const newTags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const updated = selectedBooks.map((book) => {
      let b = { ...book };

      if (updateShelf && finalShelf) {
        b.shelf = finalShelf;
      }

      if (updateCategory && finalCategory) {
        b.category = finalCategory;
      }

      if (updateStatus) {
        b.status = statusValue;
      }

      if (updateRating) {
        b.rating = ratingValue;
      }

      if (updateTags && newTags.length > 0) {
        if (tagMode === 'append') {
          b.tags = Array.from(new Set([...(b.tags || []), ...newTags]));
        } else {
          b.tags = newTags;
        }
      }

      if (updateNotes) {
        if (notesMode === 'clear') {
          b.notes = '';
        } else if (notesValue.trim()) {
          if (notesMode === 'append') {
            b.notes = b.notes ? `${b.notes}\n${notesValue.trim()}` : notesValue.trim();
          } else {
            b.notes = notesValue.trim();
          }
        }
      }

      b.updatedAt = new Date().toISOString();
      return b;
    });

    onApplyChanges(updated);
    onClose();
  };

  // Launch public database batch enrichment
  const handleBatchEnrichPublic = async () => {
    setIsEnrichingBatch(true);
    setEnrichProgress({ current: 0, total: selectedBooks.length });
    setEnrichSummary(null);

    try {
      const payload = selectedBooks.map((b) => ({
        id: b.id,
        title: b.title,
        author: b.author,
      }));

      const res = await fetch('/api/batch-enrich-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ books: payload }),
      });

      if (!res.ok) {
        throw new Error('Erreur lors de la récupération des données publiques.');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        let enrichedCount = 0;
        const updatedList: Book[] = [];

        selectedBooks.forEach((book) => {
          const match = data.results.find((r: any) => r.id === book.id);
          if (match && match.success && match.data) {
            enrichedCount++;
            const d = match.data;
            const newSynopsis = d.synopsis || '';
            const finalNotes = batchOverwrite
              ? newSynopsis
              : book.notes
              ? `${book.notes}\n\n${newSynopsis}`
              : newSynopsis;

            updatedList.push({
              ...book,
              notes: finalNotes,
              year: d.originalYear || book.year,
              pages: d.pagesEstimate || book.pages,
              category: d.genre || book.category,
              publisher: d.publisher || book.publisher,
              coverImage: d.coverUrl || book.coverImage,
              tags: d.tags && d.tags.length > 0 ? d.tags : book.tags,
              updatedAt: new Date().toISOString(),
            });
          } else {
            updatedList.push(book);
          }
        });

        onApplyChanges(updatedList);
        setEnrichSummary(
          `✅ ${enrichedCount} livre${enrichedCount > 1 ? 's ont été enrichis et réinitialisés proprement' : ' a été enrichi et réinitialisé proprement'} depuis les bases publiques gratuites !`
        );
      }
    } catch (err: any) {
      console.error('Batch enrich error:', err);
      setEnrichSummary(`Erreur : ${err.message || 'Impossible d’enrichir les données.'}`);
    } finally {
      setIsEnrichingBatch(false);
      setEnrichProgress(null);
    }
  };

  return (
    <div
      id="batch-edit-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/70 backdrop-blur-sm overflow-y-auto"
    >
      <motion.div
        id="batch-edit-modal-card"
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 overflow-hidden my-auto max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white flex items-center justify-between border-b border-stone-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif-title font-bold text-white">
                Modification par lot
              </h2>
              <p className="text-xs text-stone-300">
                Appliquer des modifications simultanées sur{' '}
                <span className="font-semibold text-amber-300">
                  {selectedBooks.length} livre{selectedBooks.length > 1 ? 's' : ''}
                </span>
              </p>
            </div>
          </div>
          <button
            id="close-batch-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-stone-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Books Preview Strip */}
        <div className="px-6 py-3 bg-stone-50 border-b border-stone-200/80 flex items-center gap-2 overflow-x-auto text-xs text-stone-600">
          <span className="font-semibold text-stone-700 flex-shrink-0">Sélection :</span>
          <div className="flex items-center gap-1.5 flex-nowrap">
            {selectedBooks.map((b) => (
              <span
                key={b.id}
                className="px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-stone-700 font-medium whitespace-nowrap shadow-2xs"
              >
                {b.title}
              </span>
            ))}
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800">
          {/* 1. Public DB Quick Batch Enrichment Tool */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/60 border border-amber-200/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-amber-950 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Enrichir depuis le Catalogue général de la BnF & Bases publiques</span>
                </div>
                <p className="text-xs text-amber-800/90 mt-0.5">
                  Interroge la Bibliothèque nationale de France (BnF), data.bnf.fr et Wikipédia FR pour récupérer métadonnées officielles, synopsis en français et pages exactes.
                </p>
                <label className="flex items-center gap-1.5 text-xs text-amber-950 font-medium mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={batchOverwrite}
                    onChange={(e) => setBatchOverwrite(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-800 border-amber-300 focus:ring-amber-700"
                  />
                  <span>Remplacer et nettoyer à neuf les anciens résumés (recommandé)</span>
                </label>
              </div>
              <button
                id="batch-enrich-public-btn"
                type="button"
                onClick={handleBatchEnrichPublic}
                disabled={isEnrichingBatch}
                className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer disabled:opacity-60"
              >
                {isEnrichingBatch ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Recherche en cours...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Enrichir les {selectedBooks.length} livres</span>
                  </>
                )}
              </button>
            </div>

            {enrichSummary && (
              <div className="mt-3 p-2.5 rounded-xl bg-white border border-amber-300/80 text-xs text-stone-800 font-medium flex items-center gap-2">
                <span>{enrichSummary}</span>
              </div>
            )}
          </div>

          {/* 2. Location / Shelf Editing */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              updateShelf
                ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-stone-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2.5 font-bold text-sm text-stone-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateShelf}
                  onChange={(e) => setUpdateShelf(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800 accent-amber-800"
                />
                <MapPin className="w-4 h-4 text-amber-700" />
                <span>Modifier la localisation / Étagère</span>
              </label>
              {updateShelf && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Activé
                </span>
              )}
            </div>

            {updateShelf && (
              <div className="space-y-3 pl-6 sm:pl-7">
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="shelfChoice"
                      checked={!isCustomShelf}
                      onChange={() => setIsCustomShelf(false)}
                      className="accent-amber-800"
                    />
                    <span>Choisir une étagère existante</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="shelfChoice"
                      checked={isCustomShelf}
                      onChange={() => setIsCustomShelf(true)}
                      className="accent-amber-800"
                    />
                    <span>Créer un nouvel emplacement</span>
                  </label>
                </div>

                {!isCustomShelf ? (
                  <select
                    id="batch-shelf-select"
                    value={shelfValue}
                    onChange={(e) => setShelfValue(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-800"
                  >
                    {existingShelves.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    {existingShelves.length === 0 && (
                      <option value="Salon - Étagère Principale">Salon - Étagère Principale</option>
                    )}
                  </select>
                ) : (
                  <input
                    id="batch-shelf-custom-input"
                    type="text"
                    placeholder="Ex: Bibliothèque Bureau - Rayon 3, Carton BD, Chambre..."
                    value={customShelf}
                    onChange={(e) => setCustomShelf(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-800"
                  />
                )}
              </div>
            )}
          </div>

          {/* 3. Category / Genre Editing */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              updateCategory
                ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-stone-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2.5 font-bold text-sm text-stone-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateCategory}
                  onChange={(e) => setUpdateCategory(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800 accent-amber-800"
                />
                <BookOpen className="w-4 h-4 text-amber-700" />
                <span>Modifier le genre / catégorie</span>
              </label>
              {updateCategory && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Activé
                </span>
              )}
            </div>

            {updateCategory && (
              <div className="space-y-3 pl-6 sm:pl-7">
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="catChoice"
                      checked={!isCustomCategory}
                      onChange={() => setIsCustomCategory(false)}
                      className="accent-amber-800"
                    />
                    <span>Genre existant</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="catChoice"
                      checked={isCustomCategory}
                      onChange={() => setIsCustomCategory(true)}
                      className="accent-amber-800"
                    />
                    <span>Nouveau genre personnalisé</span>
                  </label>
                </div>

                {!isCustomCategory ? (
                  <select
                    id="batch-category-select"
                    value={categoryValue}
                    onChange={(e) => setCategoryValue(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-800"
                  >
                    {existingCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="batch-category-custom-input"
                    type="text"
                    placeholder="Ex: Roman historique, Essai politique, Manga Shōnen..."
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-800"
                  />
                )}
              </div>
            )}
          </div>

          {/* 4. Reading Status Editing */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              updateStatus
                ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-stone-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2.5 font-bold text-sm text-stone-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800 accent-amber-800"
                />
                <CheckCircle2 className="w-4 h-4 text-amber-700" />
                <span>Modifier le statut de lecture</span>
              </label>
              {updateStatus && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Activé
                </span>
              )}
            </div>

            {updateStatus && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6 sm:pl-7">
                {[
                  { id: 'to-read', label: 'À lire', icon: <Clock className="w-4 h-4" /> },
                  { id: 'reading', label: 'En cours', icon: <BookOpen className="w-4 h-4" /> },
                  { id: 'read', label: 'Lu', icon: <CheckCircle2 className="w-4 h-4" /> },
                  { id: 'favorite', label: 'Coup de cœur', icon: <Heart className="w-4 h-4" /> },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusValue(st.id as BookStatus)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      statusValue === st.id
                        ? 'bg-amber-800 text-white border-amber-800 shadow-sm'
                        : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {st.icon}
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5. Rating Editing */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              updateRating
                ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-stone-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2.5 font-bold text-sm text-stone-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateRating}
                  onChange={(e) => setUpdateRating(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800 accent-amber-800"
                />
                <Star className="w-4 h-4 text-amber-700" />
                <span>Attribuer une note commune</span>
              </label>
              {updateRating && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Activé
                </span>
              )}
            </div>

            {updateRating && (
              <div className="flex items-center gap-2 pl-6 sm:pl-7">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingValue(star)}
                    className="p-1 hover:scale-110 transition"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= ratingValue
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-stone-300'
                      }`}
                    />
                  </button>
                ))}
                <span className="text-xs text-stone-500 font-medium ml-2">
                  {ratingValue > 0 ? `${ratingValue} / 5 étoiles` : 'Aucune note'}
                </span>
              </div>
            )}
          </div>

          {/* 6. Tags Editing */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              updateTags
                ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-stone-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2.5 font-bold text-sm text-stone-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateTags}
                  onChange={(e) => setUpdateTags(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800 accent-amber-800"
                />
                <Tag className="w-4 h-4 text-amber-700" />
                <span>Ajouter ou remplacer des tags</span>
              </label>
              {updateTags && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Activé
                </span>
              )}
            </div>

            {updateTags && (
              <div className="space-y-2 pl-6 sm:pl-7">
                <div className="flex items-center gap-4 text-xs mb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tagMode"
                      checked={tagMode === 'append'}
                      onChange={() => setTagMode('append')}
                      className="accent-amber-800"
                    />
                    <span>Ajouter aux tags existants</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="tagMode"
                      checked={tagMode === 'replace'}
                      onChange={() => setTagMode('replace')}
                      className="accent-amber-800"
                    />
                    <span>Remplacer tous les tags</span>
                  </label>
                </div>
                <input
                  id="batch-tags-input"
                  type="text"
                  placeholder="Ex: Classique, À relire, Cadeau (séparés par des virgules)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-800"
                />
              </div>
            )}
          </div>

          {/* 7. Common Notes / Location Details */}
          <div
            className={`p-4 rounded-2xl border transition-all ${
              updateNotes
                ? 'bg-amber-50/30 border-amber-300 ring-1 ring-amber-300/50'
                : 'bg-white border-stone-200 opacity-80'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2.5 font-bold text-sm text-stone-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateNotes}
                  onChange={(e) => setUpdateNotes(e.target.checked)}
                  className="w-4 h-4 text-amber-800 rounded border-stone-300 focus:ring-amber-800 accent-amber-800"
                />
                <FileText className="w-4 h-4 text-amber-700" />
                <span>Ajouter une mention ou note commune</span>
              </label>
              {updateNotes && (
                <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                  Activé
                </span>
              )}
            </div>

            {updateNotes && (
              <div className="space-y-2 pl-6 sm:pl-7">
                <div className="flex flex-wrap items-center gap-4 text-xs mb-1">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="notesMode"
                      checked={notesMode === 'append'}
                      onChange={() => setNotesMode('append')}
                      className="accent-amber-800"
                    />
                    <span>Ajouter à la fin des notes</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="notesMode"
                      checked={notesMode === 'replace'}
                      onChange={() => setNotesMode('replace')}
                      className="accent-amber-800"
                    />
                    <span>Remplacer par un nouveau texte</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-rose-700 font-semibold">
                    <input
                      type="radio"
                      name="notesMode"
                      checked={notesMode === 'clear'}
                      onChange={() => setNotesMode('clear')}
                      className="accent-rose-600"
                    />
                    <span>Vider / effacer tous les résumés et notes</span>
                  </label>
                </div>
                {notesMode !== 'clear' ? (
                  <textarea
                    id="batch-notes-textarea"
                    rows={2}
                    placeholder="Ex: Livres prêtés à la famille en août 2026..."
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-800 resize-none"
                  />
                ) : (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium">
                    ⚠️ Les champs de résumé et notes de tous les {selectedBooks.length} livres sélectionnés seront réinitialisés à vide.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex items-center justify-between gap-3">
          <button
            id="cancel-batch-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 text-xs font-semibold transition"
          >
            Annuler
          </button>

          <button
            id="apply-batch-btn"
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Appliquer les modifications aux {selectedBooks.length} livres</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
