export type BookStatus = 'to-read' | 'reading' | 'read' | 'favorite';

export interface Book {
  id: string;
  title: string;
  author: string;
  subtitle?: string;
  publisher?: string;
  series?: string;
  year?: string;
  pages?: number;
  category: string;
  shelf?: string;
  status: BookStatus;
  rating: number; // 0 to 5
  notes?: string;
  tags?: string[];
  spineColor: string; // Hex color (e.g. #7c2d12)
  coverImage?: string; // Optional cover thumbnail data or URL
  ocrConfidence?: number; // 0 to 1
  photoCrop?: string; // Crop snippet if available
  addedAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface ScanDetectedBook {
  tempId: string;
  title: string;
  author: string;
  subtitle?: string;
  publisher?: string;
  series?: string;
  category: string;
  spineColor?: string;
  confidence: number;
  shortDescription?: string;
  box2d?: number[]; // [ymin, xmin, ymax, xmax]
  photoIndex?: number;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  duplicateOfTitle?: string;
  duplicateConfidence?: number;
  duplicateReason?: string;
  selectedForImport: boolean;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  existingBook?: Book;
  matchScore: number;
  reason?: string;
}

export interface LibraryExportData {
  appName: string;
  version: string;
  exportedAt: string;
  totalBooks: number;
  shelves: string[];
  categories: string[];
  books: Book[];
}

export type ViewMode = 'shelf' | 'grid' | 'list' | 'table';

export interface FilterState {
  search: string;
  category: string;
  status: string; // 'all' | BookStatus
  shelf: string;
  author: string;
  rating: number; // 0 means all
  sortBy: 'addedAt' | 'title' | 'author' | 'rating' | 'year';
  sortOrder: 'asc' | 'desc';
}

export interface OfflineQueueItem {
  id: string;
  timestamp: string;
  imagePreviews: string[];
  status: 'pending' | 'processing' | 'error';
  errorMessage?: string;
}
