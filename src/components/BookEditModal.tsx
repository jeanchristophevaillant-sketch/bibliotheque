import React, { useState, useEffect } from 'react';
import { Book, BookStatus } from '../types';
import { X, Save, Palette, Plus, Tag, Search, RotateCw, Sparkles, Check, Globe, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';

interface BookEditModalProps {
  isOpen: boolean;
  bookToEdit: Book | null;
  onClose: () => void;
  onSave: (book: Book) => void;
  existingCategories: string[];
  existingShelves: string[];
}

const SPINE_PALETTE = [
  '#78350f', // Warm Amber Wood
  '#1e3a8a', // Deep Royal Blue
  '#14532d', // Forest Emerald
  '#881337', // Crimson Ruby
  '#312e81', // Indigo Night
  '#4c1d95', // Royal Purple
  '#7c2d12', // Terracotta Rust
  '#1f2937', // Charcoal Black
  '#b45309', // Classic Leather
  '#0f766e', // Teal Vintage
];

const DEFAULT_CATEGORIES = [
  'Roman',
  'Science-Fiction & Fantasy',
  'Policier & Thriller',
  'Bande Dessinée & Manga',
  'Histoire & Biographie',
  'Philosophie & Essais',
  'Développement Personnel',
  'Art & Beaux Livres',
  'Jeunesse',
  'Sciences & Nature',
];

export const BookEditModal: React.FC<BookEditModalProps> = ({
  isOpen,
  bookToEdit,
  onClose,
  onSave,
  existingCategories,
  existingShelves,
}) => {
  const [formData, setFormData] = useState<Partial<Book>>({
    title: '',
    author: '',
    subtitle: '',
    publisher: '',
    series: '',
    year: '',
    pages: undefined,
    category: 'Roman',
    shelf: 'Salon - Étagère Principale',
    status: 'to-read',
    rating: 0,
    spineColor: '#78350f',
    notes: '',
    tags: [],
  });

  const [tagInput, setTagInput] = useState('');
  const [isSearchingPublic, setIsSearchingPublic] = useState(false);
  const [publicSearchStatus, setPublicSearchStatus] = useState<string | null>(null);

  useEffect(() => {
    if (bookToEdit) {
      setFormData(bookToEdit);
      setTagInput(bookToEdit.tags ? bookToEdit.tags.join(', ') : '');
    } else {
      setFormData({
        title: '',
        author: '',
        subtitle: '',
        publisher: '',
        series: '',
        year: '',
        pages: undefined,
        category: 'Roman',
        shelf: existingShelves[0] || 'Salon - Étagère Principale',
        status: 'to-read',
        rating: 0,
        spineColor: SPINE_PALETTE[Math.floor(Math.random() * SPINE_PALETTE.length)],
        notes: '',
        tags: [],
      });
      setTagInput('');
    }
    setPublicSearchStatus(null);
  }, [bookToEdit, isOpen]);

  const handleLookupPublicData = async () => {
    if (!formData.title?.trim()) {
      alert('Veuillez saisir au moins le titre du livre avant de lancer la recherche.');
      return;
    }

    setIsSearchingPublic(true);
    setPublicSearchStatus(null);

    try {
      const res = await fetch('/api/public-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: formData.title, author: formData.author }),
      });

      const data = await res.json();
      if (data.success && data.data) {
        const d = data.data;
        setFormData((prev) => ({
          ...prev,
          author: prev.author && prev.author !== 'Auteur inconnu' ? prev.author : d.canonicalAuthor || prev.author,
          publisher: d.publisher || prev.publisher,
          year: d.originalYear || prev.year,
          pages: d.pagesEstimate || prev.pages,
          category: d.genre || prev.category,
          notes: d.synopsis || '', // Cleanly replaces with fresh synopsis without concatenating stale data
          coverImage: d.coverUrl || prev.coverImage,
        }));

        if (d.tags && d.tags.length > 0) {
          setTagInput(d.tags.join(', '));
        }

        setPublicSearchStatus(`✅ Données et résumé mis à jour à neuf via ${d.source || 'base publique'} !`);
      } else {
        setPublicSearchStatus('ℹ️ Aucun résumé trouvé dans les bases publiques gratuites pour ce titre exact.');
      }
    } catch (err: any) {
      console.error('Public lookup error:', err);
      setPublicSearchStatus('⚠️ Erreur lors de la recherche publique.');
    } finally {
      setIsSearchingPublic(false);
      setTimeout(() => setPublicSearchStatus(null), 5000);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      alert('Veuillez renseigner le titre du livre.');
      return;
    }

    const tagsArray = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const savedBook: Book = {
      id: bookToEdit ? bookToEdit.id : `book-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: formData.title.trim(),
      author: formData.author?.trim() || 'Auteur inconnu',
      subtitle: formData.subtitle?.trim(),
      publisher: formData.publisher?.trim(),
      series: formData.series?.trim(),
      year: formData.year?.trim(),
      pages: formData.pages ? Number(formData.pages) : undefined,
      category: formData.category || 'Roman',
      shelf: formData.shelf || 'Bibliothèque principale',
      status: formData.status || 'to-read',
      rating: formData.rating || 0,
      spineColor: formData.spineColor || '#78350f',
      notes: formData.notes?.trim(),
      tags: tagsArray,
      coverImage: formData.coverImage,
      addedAt: bookToEdit ? bookToEdit.addedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(savedBook);
    onClose();
  };

  const categoriesList = Array.from(new Set([...DEFAULT_CATEGORIES, ...existingCategories]));

  return (
    <div
      id="book-edit-modal-backdrop"
      className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-950 to-stone-900 text-white flex items-center justify-between">
          <h3 className="font-serif-title text-lg font-bold">
            {bookToEdit ? 'Modifier le livre' : 'Ajouter un livre manuellement'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs sm:text-sm">
          {/* Public search helper button */}
          <div className="flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
            <div className="flex items-center gap-2 text-xs text-amber-900">
              <Globe className="w-4 h-4 text-amber-700 flex-shrink-0" />
              <span>Auto-remplissage gratuit (Catalogue BnF & Bases publiques)</span>
            </div>
            <button
              type="button"
              id="lookup-public-info-btn"
              onClick={handleLookupPublicData}
              disabled={isSearchingPublic}
              className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              {isSearchingPublic ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Recherche...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Remplir les infos</span>
                </>
              )}
            </button>
          </div>

          {publicSearchStatus && (
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-800 font-medium">
              {publicSearchStatus}
            </div>
          )}

          {/* Title & Subtitle */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Titre de l'ouvrage *
            </label>
            <input
              id="edit-book-title"
              type="text"
              required
              value={formData.title || ''}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Le Comte de Monte-Cristo"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900 font-serif-title font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Auteur(s) *
              </label>
              <input
                id="edit-book-author"
                type="text"
                required
                value={formData.author || ''}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Ex: Alexandre Dumas"
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Sous-titre / Tome (optionnel)
              </label>
              <input
                id="edit-book-subtitle"
                type="text"
                value={formData.subtitle || ''}
                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                placeholder="Ex: Tome 1"
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900"
              />
            </div>
          </div>

          {/* Category & Shelf */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Genre / Catégorie
              </label>
              <select
                id="edit-book-category"
                value={formData.category || 'Roman'}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Rangement / Étagère (Localisation)
              </label>
              <input
                id="edit-book-shelf"
                type="text"
                value={formData.shelf || ''}
                onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                placeholder="Ex: Salon - Rayon 2"
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900"
              />
            </div>
          </div>

          {/* Publisher, Year, Pages */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Éditeur
              </label>
              <input
                id="edit-book-publisher"
                type="text"
                value={formData.publisher || ''}
                onChange={(e) => setFormData({ ...formData, publisher: e.target.value })}
                placeholder="Ex: Folio"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Année
              </label>
              <input
                id="edit-book-year"
                type="text"
                value={formData.year || ''}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="Ex: 1844"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Pages
              </label>
              <input
                id="edit-book-pages"
                type="number"
                value={formData.pages || ''}
                onChange={(e) => setFormData({ ...formData, pages: parseInt(e.target.value) || undefined })}
                placeholder="Ex: 650"
                className="w-full px-3 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900 text-xs"
              />
            </div>
          </div>

          {/* Status & Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Statut de lecture
              </label>
              <select
                id="edit-book-status"
                value={formData.status || 'to-read'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BookStatus })}
                className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900"
              >
                <option value="to-read">À lire</option>
                <option value="reading">En cours de lecture</option>
                <option value="read">Lu</option>
                <option value="favorite">Coup de cœur ❤️</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                Note ({formData.rating || 0}/5 étoiles)
              </label>
              <input
                id="edit-book-rating"
                type="range"
                min="0"
                max="5"
                step="1"
                value={formData.rating || 0}
                onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-800 mt-2"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
              Tags / Mots-clés (séparés par des virgules)
            </label>
            <input
              id="edit-book-tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Ex: Classique, Aventure, Vengeance, XIXe siècle"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900"
            />
          </div>

          {/* Spine Color Selection */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
              Couleur de la tranche pour l'étagère virtuelle
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {SPINE_PALETTE.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, spineColor: color })}
                  className={`w-7 h-7 rounded-full transition-transform border-2 ${
                    formData.spineColor === color ? 'scale-125 border-stone-900 shadow-md ring-2 ring-amber-500' : 'border-white'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Notes & Summary */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Résumé & Notes personnelles
              </label>
              {formData.notes && (
                <button
                  id="edit-modal-clear-notes-btn"
                  type="button"
                  onClick={() => setFormData({ ...formData, notes: '' })}
                  className="text-[11px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Vider le résumé</span>
                </button>
              )}
            </div>
            <textarea
              id="edit-book-notes"
              rows={3}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Résumé du livre, avis personnel, annotations, citations favorites..."
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 border border-stone-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 text-stone-900 resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
            <button
              id="edit-book-cancel-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-medium transition"
            >
              Annuler
            </button>
            <button
              id="edit-book-save-btn"
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-amber-800 hover:bg-amber-900 text-white font-medium shadow-md transition flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer le livre</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
