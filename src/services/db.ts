import { Book, LibraryExportData, OfflineQueueItem } from '../types';
import { detectAndFlagDuplicates, stringSimilarity } from '../utils/deduplication';

const DB_NAME = 'BibliothequeNumeriqueDB';
const DB_VERSION = 1;
const STORE_BOOKS = 'books';
const STORE_QUEUE = 'offline_queue';
const LOCALSTORAGE_KEY = 'biblioscan_books_fallback_v1';

// Starter demo books for instant preview if database is brand new
export const INITIAL_SAMPLE_BOOKS: Book[] = [
  {
    id: 'sample-1',
    title: 'Le Petit Prince',
    author: 'Antoine de Saint-Exupéry',
    publisher: 'Gallimard / Folio',
    category: 'Roman & Conte',
    status: 'favorite',
    rating: 5,
    pages: 96,
    year: '1943',
    shelf: 'Salon - Étagère Principale',
    spineColor: '#b45309',
    notes: 'Un classique intemporel lu et relu. Édition originale illustrée.',
    tags: ['Classique', 'Philosophie', 'Poésie'],
    addedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    title: 'Dune',
    author: 'Frank Herbert',
    subtitle: 'Cycle de Dune - Tome 1',
    publisher: 'Robert Laffont / Pocket',
    category: 'Science-Fiction & Fantasy',
    status: 'read',
    rating: 5,
    pages: 832,
    year: '1965',
    shelf: 'Bureau - SF & Imaginaire',
    spineColor: '#d97706',
    notes: 'Chef d’œuvre absolu du space-opera et de l’écologie politique.',
    tags: ['SF', 'Cycle', 'Space-Opera'],
    addedAt: new Date(Date.now() - 86400000 * 8).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    title: "L'Étranger",
    author: 'Albert Camus',
    publisher: 'Folio',
    category: 'Roman',
    status: 'read',
    rating: 4,
    pages: 184,
    year: '1942',
    shelf: 'Salon - Étagère Principale',
    spineColor: '#1e3a8a',
    notes: 'Aujourd’hui, maman est morte. Ou peut-être hier...',
    tags: ['Existentialisme', 'Prix Nobel', 'XXe siècle'],
    addedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-4',
    title: 'Les Misérables',
    author: 'Victor Hugo',
    publisher: 'Le Livre de Poche',
    category: 'Roman',
    status: 'reading',
    rating: 5,
    pages: 1488,
    year: '1862',
    shelf: 'Salon - Étagère Principale',
    spineColor: '#78350f',
    notes: 'Lecture en cours du Tome 2 (Cosette). Une fresque magistrale.',
    tags: ['Historique', 'Classique', 'France'],
    addedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'sample-5',
    title: '1984',
    author: 'George Orwell',
    publisher: 'Gallimard',
    category: 'Science-Fiction & Dystopie',
    status: 'to-read',
    rating: 0,
    pages: 376,
    year: '1949',
    shelf: 'Chambre - Table de chevet',
    spineColor: '#374151',
    notes: 'À lire absolument après La Ferme des Animaux.',
    tags: ['Dystopie', 'Politique', 'Culte'],
    addedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * Open IndexedDB database with schema creation
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB non supporté'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        const bookStore = db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        bookStore.createIndex('title', 'title', { unique: false });
        bookStore.createIndex('author', 'author', { unique: false });
        bookStore.createIndex('category', 'category', { unique: false });
        bookStore.createIndex('status', 'status', { unique: false });
        bookStore.createIndex('addedAt', 'addedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// LocalStorage helpers for fallback
function getLocalStorageBooks(): Book[] {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return INITIAL_SAMPLE_BOOKS;
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_SAMPLE_BOOKS;
  }
}

function setLocalStorageBooks(books: Book[]): void {
  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(books));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}

/**
 * Get all books from local database
 */
export async function getAllBooks(): Promise<Book[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.getAll();

      req.onsuccess = () => {
        const result: Book[] = req.result || [];
        if (result.length === 0) {
          // If completely empty on first visit, seed starter sample
          saveBooksBatch(INITIAL_SAMPLE_BOOKS).catch(console.error);
          resolve(INITIAL_SAMPLE_BOOKS);
        } else {
          resolve(result);
        }
      };

      req.onerror = () => {
        resolve(getLocalStorageBooks());
      };
    });
  } catch (e) {
    return getLocalStorageBooks();
  }
}

/**
 * Save or update a single book
 */
export async function saveBook(book: Book): Promise<Book> {
  const updatedBook: Book = {
    ...book,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.put(updatedBook);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const existing = getLocalStorageBooks().filter((b) => b.id !== book.id);
    setLocalStorageBooks([updatedBook, ...existing]);
  }

  return updatedBook;
}

/**
 * Save a batch of books
 */
export async function saveBooksBatch(books: Book[]): Promise<number> {
  if (books.length === 0) return 0;

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      for (const book of books) {
        store.put(book);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return books.length;
  } catch (e) {
    const current = getLocalStorageBooks();
    const map = new Map<string, Book>();
    current.forEach((b) => map.set(b.id, b));
    books.forEach((b) => map.set(b.id, b));
    setLocalStorageBooks(Array.from(map.values()));
    return books.length;
  }
}

/**
 * Delete a book by ID
 */
export async function deleteBook(id: string): Promise<boolean> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    const current = getLocalStorageBooks().filter((b) => b.id !== id);
    setLocalStorageBooks(current);
  }
  return true;
}

/**
 * Delete multiple books
 */
export async function deleteBooks(ids: string[]): Promise<number> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    const idSet = new Set(ids);
    const current = getLocalStorageBooks().filter((b) => !idSet.has(b.id));
    setLocalStorageBooks(current);
  }
  return ids.length;
}

/**
 * Clear all books from the library
 */
export async function clearAllBooks(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_BOOKS, 'readwrite');
      const store = tx.objectStore(STORE_BOOKS);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    setLocalStorageBooks([]);
  }
}

/**
 * Export entire library to JSON format
 */
export async function exportLibraryJson(): Promise<LibraryExportData> {
  const books = await getAllBooks();
  const shelves = Array.from(new Set(books.map((b) => b.shelf).filter(Boolean))) as string[];
  const categories = Array.from(new Set(books.map((b) => b.category).filter(Boolean))) as string[];

  return {
    appName: 'BiblioScan - Bibliothèque Numérique',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    totalBooks: books.length,
    shelves,
    categories,
    books,
  };
}

/**
 * Import library from JSON with automatic duplicate handling
 */
export async function importLibraryJson(
  jsonData: any,
  deduplicationMode: 'auto-skip' | 'auto-replace' | 'keep-all' = 'auto-skip'
): Promise<{ added: number; skipped: number; replaced: number; totalImported: number }> {
  let booksToImport: any[] = [];

  if (Array.isArray(jsonData)) {
    booksToImport = jsonData;
  } else if (jsonData && Array.isArray(jsonData.books)) {
    booksToImport = jsonData.books;
  } else {
    throw new Error('Format de fichier JSON invalide. Une liste de livres est attendue.');
  }

  const existingBooks = await getAllBooks();
  const existingMap = new Map<string, Book>();
  existingBooks.forEach((b) => existingMap.set(b.id, b));

  let added = 0;
  let skipped = 0;
  let replaced = 0;
  const toSave: Book[] = [];

  for (const raw of booksToImport) {
    if (!raw.title) continue;

    const bookTitle = String(raw.title).trim();
    const bookAuthor = String(raw.author || 'Auteur inconnu').trim();

    // Check if it's a duplicate of existing library
    let duplicateExisting: Book | undefined;
    for (const ex of existingBooks) {
      const simTitle = stringSimilarity(bookTitle, ex.title);
      if (simTitle >= 0.88) {
        duplicateExisting = ex;
        break;
      }
    }

    if (duplicateExisting) {
      if (deduplicationMode === 'auto-skip') {
        skipped++;
        continue;
      } else if (deduplicationMode === 'auto-replace') {
        const updated: Book = {
          ...duplicateExisting,
          ...raw,
          id: duplicateExisting.id,
          updatedAt: new Date().toISOString(),
        };
        toSave.push(updated);
        replaced++;
        continue;
      }
    }

    // New book
    const newBook: Book = {
      id: raw.id || `book-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: bookTitle,
      author: bookAuthor,
      subtitle: raw.subtitle || '',
      publisher: raw.publisher || '',
      series: raw.series || '',
      year: raw.year || '',
      pages: typeof raw.pages === 'number' ? raw.pages : undefined,
      category: raw.category || 'Roman',
      shelf: raw.shelf || 'Bibliothèque principale',
      status: (['to-read', 'reading', 'read', 'favorite'].includes(raw.status) ? raw.status : 'to-read') as any,
      rating: typeof raw.rating === 'number' ? Math.min(5, Math.max(0, raw.rating)) : 0,
      notes: raw.notes || '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      spineColor: raw.spineColor || '#78350f',
      addedAt: raw.addedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    toSave.push(newBook);
    added++;
  }

  if (toSave.length > 0) {
    await saveBooksBatch(toSave);
  }

  return { added, skipped, replaced, totalImported: toSave.length };
}

/**
 * Generate sample bookshelf demo photos with base64 for immediate testing
 */
export function getDemoBookshelfImages(): { name: string; url: string; description: string }[] {
  return [
    {
      name: 'Bibliothèque Romans & Classiques',
      description: 'Étagère avec tranches colorées (Camus, Hugo, Zola, Proust, Saint-Exupéry...)',
      url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1000&q=80',
    },
    {
      name: 'Rayonnage Science-Fiction & Fantasy',
      description: 'Poche et grands formats (Dune, Asimov, Tolkien, Philip K. Dick...)',
      url: 'https://images.unsplash.com/photo-1507842229451-9f01079ca4b5?auto=format&fit=crop&w=1000&q=80',
    },
    {
      name: 'Bibliothèque Moderne Bois Massif',
      description: 'Livres d’art, essais, philosophie et romans récents',
      url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1000&q=80',
    },
  ];
}
