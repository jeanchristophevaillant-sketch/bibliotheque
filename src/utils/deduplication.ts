import { Book, ScanDetectedBook, DuplicateDetectionResult } from '../types';

/**
 * Normalize text for robust comparison:
 * - strips accents (é -> e, etc.)
 * - converts to lowercase
 * - strips leading articles (le, la, les, un, une, the, a, an, l', d')
 * - strips non-alphanumeric punctuation
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/^(le|la|les|un|une|des|the|a|an|l'|d')\s+/i, '') // strip common articles
    .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ') // collapse multi-spaces
    .trim();
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

/**
 * Similarity ratio between 0 and 1
 */
export function stringSimilarity(s1: string, s2: string): number {
  const norm1 = normalizeText(s1);
  const norm2 = normalizeText(s2);

  if (norm1 === norm2) return 1.0;
  if (norm1.length === 0 || norm2.length === 0) return 0.0;

  // Direct containment check (e.g. "Dune" vs "Dune - Tome 1")
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    if (minLen / maxLen > 0.6) {
      return 0.9;
    }
  }

  // Token Jaccard overlap
  const tokens1 = new Set(norm1.split(' ').filter(Boolean));
  const tokens2 = new Set(norm2.split(' ').filter(Boolean));
  let intersection = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) intersection++;
  });
  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Levenshtein similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  const levDist = levenshteinDistance(norm1, norm2);
  const levSim = 1.0 - levDist / maxLen;

  return Math.max(jaccard, levSim);
}

/**
 * Check if an author name matches another (handling "Victor Hugo" vs "Hugo, Victor")
 */
export function isAuthorMatch(author1: string, author2: string): number {
  const a1 = normalizeText(author1);
  const a2 = normalizeText(author2);

  if (!a1 || !a2 || a1 === 'inconnu' || a2 === 'inconnu') {
    // If author is unknown, we give a neutral score
    return 0.5;
  }

  if (a1 === a2) return 1.0;

  const tokens1 = a1.split(' ').sort().join(' ');
  const tokens2 = a2.split(' ').sort().join(' ');
  if (tokens1 === tokens2) return 0.98;

  return stringSimilarity(tokens1, tokens2);
}

/**
 * Evaluate if a candidate book is a duplicate of an existing book
 */
export function checkDuplicateWithBook(
  candidate: { title: string; author: string; series?: string },
  existing: Book
): DuplicateDetectionResult {
  const titleSim = stringSimilarity(candidate.title, existing.title);
  const authorSim = isAuthorMatch(candidate.author, existing.author);

  // If title is an exact match
  if (titleSim >= 0.95 && authorSim >= 0.6) {
    return {
      isDuplicate: true,
      existingBook: existing,
      matchScore: 0.95 * titleSim,
      reason: `Titre identique ("${existing.title}") et auteur correspondant ("${existing.author}")`,
    };
  }

  // If title is very close and author matches well
  if (titleSim >= 0.82 && authorSim >= 0.7) {
    return {
      isDuplicate: true,
      existingBook: existing,
      matchScore: titleSim * 0.7 + authorSim * 0.3,
      reason: `Titre très similaire ("${existing.title}") et auteur similaire`,
    };
  }

  // If title is identical even if author is slightly different
  if (titleSim >= 0.92 && candidate.title.length > 5) {
    return {
      isDuplicate: true,
      existingBook: existing,
      matchScore: 0.85,
      reason: `Titre identique ("${existing.title}") déjà présent dans votre bibliothèque`,
    };
  }

  return {
    isDuplicate: false,
    existingBook: undefined,
    matchScore: Math.max(titleSim, authorSim),
  };
}

/**
 * Filter and mark duplicates across an array of newly scanned books against:
 * 1. The existing library
 * 2. Other books in the current batch (intra-batch deduplication)
 */
export function detectAndFlagDuplicates(
  scannedBooks: Omit<ScanDetectedBook, 'isDuplicate' | 'selectedForImport'>[],
  existingLibrary: Book[],
  autoDeselectDuplicates = true
): ScanDetectedBook[] {
  const result: ScanDetectedBook[] = [];
  const processedBatchKeys: { [key: string]: ScanDetectedBook } = {};

  for (const raw of scannedBooks) {
    let isDuplicate = false;
    let duplicateOfId: string | undefined;
    let duplicateOfTitle: string | undefined;
    let duplicateConfidence = 0;
    let duplicateReason: string | undefined;

    // 1. Check against existing library in DB
    for (const existing of existingLibrary) {
      const match = checkDuplicateWithBook(raw, existing);
      if (match.isDuplicate && match.matchScore > duplicateConfidence) {
        isDuplicate = true;
        duplicateOfId = existing.id;
        duplicateOfTitle = `${existing.title} (${existing.author})`;
        duplicateConfidence = match.matchScore;
        duplicateReason = match.reason;
      }
    }

    // 2. Check against already processed books in this same scan batch
    if (!isDuplicate) {
      for (const batchKey in processedBatchKeys) {
        const batchBook = processedBatchKeys[batchKey];
        const titleSim = stringSimilarity(raw.title, batchBook.title);
        const authorSim = isAuthorMatch(raw.author, batchBook.author);

        if (titleSim >= 0.85 && authorSim >= 0.6) {
          isDuplicate = true;
          duplicateOfId = batchBook.tempId;
          duplicateOfTitle = `${batchBook.title} (${batchBook.author}) [Détecté sur une autre photo]`;
          duplicateConfidence = 0.95;
          duplicateReason = `Doublon présent plusieurs fois dans vos photos de scan`;
          break;
        }
      }
    }

    const flaggedBook: ScanDetectedBook = {
      ...raw,
      isDuplicate,
      duplicateOfId,
      duplicateOfTitle,
      duplicateConfidence,
      duplicateReason,
      // If it's a duplicate and auto-deselect is active, uncheck it by default
      selectedForImport: autoDeselectDuplicates ? !isDuplicate : true,
    };

    result.push(flaggedBook);

    if (!isDuplicate) {
      const key = `${normalizeText(raw.title)}___${normalizeText(raw.author)}`;
      processedBatchKeys[key] = flaggedBook;
    }
  }

  return result;
}
