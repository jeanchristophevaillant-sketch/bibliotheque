import React, { useState, useEffect, useMemo } from 'react';
import { Book, FilterState, ViewMode } from './types';
import {
  getAllBooks,
  saveBook,
  saveBooksBatch,
  deleteBook,
  deleteBooks,
  clearAllBooks,
  INITIAL_SAMPLE_BOOKS,
} from './services/db';
import { normalizeText } from './utils/deduplication';
import { Navbar } from './components/Navbar';
import { OfflineBanner } from './components/OfflineBanner';
import { FilterBar } from './components/FilterBar';
import { BookShelfView } from './components/BookShelfView';
import { BookGridView } from './components/BookGridView';
import { BookListView } from './components/BookListView';
import { ScanModal } from './components/ScanModal';
import { BookDetailModal } from './components/BookDetailModal';
import { BookEditModal } from './components/BookEditModal';
import { BatchEditModal } from './components/BatchEditModal';
import { ExportImportModal } from './components/ExportImportModal';
import { StatsModal } from './components/StatsModal';
import {
  Trash2,
  CheckSquare,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock,
  Heart,
  RotateCcw,
  Layers,
  Edit,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('shelf');
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    status: 'all',
    shelf: '',
    author: '',
    rating: 0,
    sortBy: 'addedAt',
    sortOrder: 'desc',
  });

  // Modals state
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBatchEditModalOpen, setIsBatchEditModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [inspectedBook, setInspectedBook] = useState<Book | null>(null);
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);

  // Load books from IndexedDB / LocalStorage on mount
  const loadBooks = async () => {
    setLoading(true);
    try {
      const stored = await getAllBooks();
      setBooks(stored);
    } catch (e) {
      console.error('Failed to load books:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  // Compute unique categories & shelves for dropdown filters
  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.category) set.add(b.category);
    });
    return Array.from(set).sort();
  }, [books]);

  const shelves = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      if (b.shelf) set.add(b.shelf);
    });
    return Array.from(set).sort();
  }, [books]);

  // Filter & Sort Logic
  const filteredBooks = useMemo(() => {
    return books
      .filter((b) => {
        // Search
        if (filters.search) {
          const query = normalizeText(filters.search);
          const titleMatch = normalizeText(b.title).includes(query);
          const authorMatch = normalizeText(b.author).includes(query);
          const categoryMatch = normalizeText(b.category).includes(query);
          const notesMatch = b.notes ? normalizeText(b.notes).includes(query) : false;
          const tagsMatch = b.tags ? b.tags.some((t) => normalizeText(t).includes(query)) : false;
          if (!titleMatch && !authorMatch && !categoryMatch && !notesMatch && !tagsMatch) {
            return false;
          }
        }

        // Status
        if (filters.status !== 'all' && b.status !== filters.status) {
          return false;
        }

        // Category
        if (filters.category && b.category !== filters.category) {
          return false;
        }

        // Shelf
        if (filters.shelf && b.shelf !== filters.shelf) {
          return false;
        }

        // Rating
        if (filters.rating > 0 && b.rating < filters.rating) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (filters.sortBy === 'title') {
          comp = a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
        } else if (filters.sortBy === 'author') {
          comp = a.author.localeCompare(b.author, 'fr', { sensitivity: 'base' });
        } else if (filters.sortBy === 'rating') {
          comp = (a.rating || 0) - (b.rating || 0);
        } else if (filters.sortBy === 'year') {
          comp = (parseInt(a.year || '0') || 0) - (parseInt(b.year || '0') || 0);
        } else {
          // addedAt
          comp = new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
        }
        return filters.sortOrder === 'asc' ? comp : -comp;
      });
  }, [books, filters]);

  // Book Handlers
  const handleSaveBook = async (book: Book) => {
    const saved = await saveBook(book);
    setBooks((prev) => {
      const exists = prev.some((b) => b.id === saved.id);
      if (exists) {
        return prev.map((b) => (b.id === saved.id ? saved : b));
      }
      return [saved, ...prev];
    });
    if (inspectedBook?.id === saved.id) {
      setInspectedBook(saved);
    }
  };

  const handleImportScannedBooks = async (newBooks: Book[]) => {
    await saveBooksBatch(newBooks);
    setBooks((prev) => [...newBooks, ...prev]);
  };

  const handleDeleteBook = async (id: string) => {
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setSelectedBookIds((prev) => prev.filter((item) => item !== id));
    if (inspectedBook?.id === id) {
      setInspectedBook(null);
    }
  };

  const handleDeleteBatch = async () => {
    if (selectedBookIds.length === 0) return;
    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer les ${selectedBookIds.length} livres sélectionnés ?`
      )
    ) {
      await deleteBooks(selectedBookIds);
      setBooks((prev) => prev.filter((b) => !selectedBookIds.includes(b.id)));
      setSelectedBookIds([]);
    }
  };

  const handleBatchStatusChange = async (newStatus: Book['status']) => {
    if (selectedBookIds.length === 0) return;
    const updated = books.map((b) =>
      selectedBookIds.includes(b.id) ? { ...b, status: newStatus } : b
    );
    const affected = updated.filter((b) => selectedBookIds.includes(b.id));
    await saveBooksBatch(affected);
    setBooks(updated);
    setSelectedBookIds([]);
  };

  const handleApplyBatchEdit = async (updatedBooksList: Book[]) => {
    await saveBooksBatch(updatedBooksList);
    setBooks((prev) => {
      const map = new Map(updatedBooksList.map((b) => [b.id, b]));
      return prev.map((b) => map.get(b.id) || b);
    });
    setSelectedBookIds([]);
  };

  const selectedBooksObjects = useMemo(() => {
    return books.filter((b) => selectedBookIds.includes(b.id));
  }, [books, selectedBookIds]);

  const handleResetStarterData = async () => {
    if (confirm('Réinitialiser la bibliothèque avec les exemples de classiques ?')) {
      await clearAllBooks();
      await saveBooksBatch(INITIAL_SAMPLE_BOOKS);
      setBooks(INITIAL_SAMPLE_BOOKS);
      setSelectedBookIds([]);
    }
  };

  const handleToggleSelectBook = (id: string) => {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllFilteredSelected = useMemo(() => {
    if (filteredBooks.length === 0) return false;
    return filteredBooks.every((b) => selectedBookIds.includes(b.id));
  }, [filteredBooks, selectedBookIds]);

  const handleSelectAllFiltered = () => {
    if (filteredBooks.length === 0) return;
    if (isAllFilteredSelected) {
      setSelectedBookIds([]);
    } else {
      const allFilteredIds = filteredBooks.map((b) => b.id);
      setSelectedBookIds(allFilteredIds);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-sans selection:bg-amber-600 selection:text-white pb-20 sm:pb-12">
      {/* Offline Alert Banner */}
      <OfflineBanner />

      {/* Main App Navigation Bar */}
      <Navbar
        totalBooksCount={books.length}
        onOpenScanModal={() => setIsScanModalOpen(true)}
        onOpenAddModal={() => {
          setBookToEdit(null);
          setIsEditModalOpen(true);
        }}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenStatsModal={() => setIsStatsModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {/* Filter & View Switcher Bar */}
        <FilterBar
          filters={filters}
          onFilterChange={setFilters}
          categories={categories}
          shelves={shelves}
          totalBooksCount={books.length}
          filteredBooksCount={filteredBooks.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onSelectAll={handleSelectAllFiltered}
          isAllSelected={isAllFilteredSelected}
          selectedBooksCount={selectedBookIds.length}
        />

        {/* Batch Selection Action Floating Bar */}
        <AnimatePresence>
          {selectedBookIds.length > 0 && (
            <motion.div
              id="batch-actions-bar"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="sticky top-20 z-30 mb-6 bg-stone-900 text-stone-100 p-3 sm:p-4 rounded-2xl shadow-xl border border-stone-700 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
                  <CheckSquare className="w-4 h-4 text-amber-400" />
                  <span>
                    {selectedBookIds.length} livre{selectedBookIds.length > 1 ? 's' : ''} sélectionné{selectedBookIds.length > 1 ? 's' : ''}
                  </span>
                </div>

                {filteredBooks.length > 0 && (
                  <button
                    id="batch-bar-select-all-btn"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-amber-300 hover:text-amber-200 rounded-lg transition border border-stone-700 flex items-center gap-1 cursor-pointer font-medium"
                    title={isAllFilteredSelected ? "Tout désélectionner" : `Sélectionner la totalité des ${filteredBooks.length} livres affichés`}
                  >
                    {isAllFilteredSelected ? (
                      <span>Tout désélectionner</span>
                    ) : (
                      <span>Tout sélectionner ({filteredBooks.length})</span>
                    )}
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Batch Edit Modal button */}
                <button
                  id="open-batch-edit-modal-btn"
                  onClick={() => setIsBatchEditModalOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Modifier l'emplacement, le genre ou enrichir les livres sélectionnés"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Modifier par lot (Étagère, genre...)</span>
                </button>

                {/* Batch status buttons */}
                <button
                  onClick={() => handleBatchStatusChange('read')}
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl transition flex items-center gap-1 font-medium cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Marquer "Lu"
                </button>
                <button
                  onClick={() => handleBatchStatusChange('favorite')}
                  className="px-3 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded-xl transition flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-400" /> Coup de cœur
                </button>
                <button
                  onClick={() => handleBatchStatusChange('to-read')}
                  className="px-3 py-1.5 bg-amber-800 hover:bg-amber-700 text-white rounded-xl transition flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" /> À lire
                </button>
                <button
                  onClick={handleDeleteBatch}
                  className="px-3 py-1.5 bg-red-950 hover:bg-red-900 text-rose-300 rounded-xl transition flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
                <button
                  onClick={() => setSelectedBookIds([])}
                  className="px-2.5 py-1.5 text-stone-400 hover:text-white transition cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center text-stone-400 space-y-3">
            <div className="w-10 h-10 border-4 border-amber-800 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Chargement de votre bibliothèque locale...</p>
          </div>
        ) : (
          <>
            {/* View Render */}
            {viewMode === 'shelf' && (
              <BookShelfView
                books={filteredBooks}
                onSelectBook={(book) => setInspectedBook(book)}
                onOpenScanModal={() => setIsScanModalOpen(true)}
                onAddManual={() => {
                  setBookToEdit(null);
                  setIsEditModalOpen(true);
                }}
              />
            )}

            {viewMode === 'grid' && (
              <BookGridView
                books={filteredBooks}
                selectedBookIds={selectedBookIds}
                onToggleSelectBook={handleToggleSelectBook}
                onSelectBook={(book) => setInspectedBook(book)}
                onEditBook={(book) => {
                  setBookToEdit(book);
                  setIsEditModalOpen(true);
                }}
                onDeleteBook={handleDeleteBook}
                onChangeStatus={(book, status) => handleSaveBook({ ...book, status })}
              />
            )}

            {(viewMode === 'list' || viewMode === 'table') && (
              <BookListView
                books={filteredBooks}
                viewMode={viewMode}
                selectedBookIds={selectedBookIds}
                onToggleSelectBook={handleToggleSelectBook}
                onSelectBook={(book) => setInspectedBook(book)}
                onEditBook={(book) => {
                  setBookToEdit(book);
                  setIsEditModalOpen(true);
                }}
                onDeleteBook={handleDeleteBook}
                onChangeStatus={(book, status) => handleSaveBook({ ...book, status })}
                onSelectAll={handleSelectAllFiltered}
              />
            )}
          </>
        )}

        {/* Bottom utility footer bar */}
        <div className="mt-12 pt-6 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-400">
          <div>
            BiblioScan • Stockage 100% local (IndexedDB) • Déduplication automatique & Export JSON
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleResetStarterData}
              className="flex items-center gap-1 text-stone-500 hover:text-stone-700 transition"
              title="Réinitialiser avec les exemples"
            >
              <RotateCcw className="w-3 h-3" /> Exemples de démonstration
            </button>
            <button
              onClick={() => setIsExportModalOpen(true)}
              className="text-amber-800 hover:text-amber-900 font-semibold transition"
            >
              Exporter la sauvegarde (.json)
            </button>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {/* 1. Multi-Photo OCR Bookshelf Scanner Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        existingLibrary={books}
        onImportBooks={handleImportScannedBooks}
      />

      {/* 2. Book Detail Modal */}
      <BookDetailModal
        book={inspectedBook}
        isOpen={Boolean(inspectedBook)}
        onClose={() => setInspectedBook(null)}
        onEdit={(book) => {
          setInspectedBook(null);
          setBookToEdit(book);
          setIsEditModalOpen(true);
        }}
        onDelete={handleDeleteBook}
        onUpdateBook={handleSaveBook}
      />

      {/* 3. Manual Add / Edit Book Modal */}
      <BookEditModal
        isOpen={isEditModalOpen}
        bookToEdit={bookToEdit}
        onClose={() => {
          setIsEditModalOpen(false);
          setBookToEdit(null);
        }}
        onSave={handleSaveBook}
        existingCategories={categories}
        existingShelves={shelves}
      />

      {/* 4. Batch Edit Modal */}
      <BatchEditModal
        isOpen={isBatchEditModalOpen}
        selectedBooks={selectedBooksObjects}
        existingShelves={shelves}
        existingCategories={categories}
        onClose={() => setIsBatchEditModalOpen(false)}
        onApplyChanges={handleApplyBatchEdit}
      />

      {/* 5. Export & Import JSON Modal */}
      <ExportImportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        books={books}
        onLibraryReload={loadBooks}
      />

      {/* 6. Statistics Overview Modal */}
      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        books={books}
      />
    </div>
  );
}
