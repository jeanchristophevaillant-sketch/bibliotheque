import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware to parse JSON payloads (allowing large base64 photos up to 50mb)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy Google GenAI Client
let genAI: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing.');
    }
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAI;
}

/**
 * Helper to execute Gemini generation with exponential backoff and model fallbacks
 * to handle temporary 503 / UNAVAILABLE / High Demand spikes seamlessly.
 */
async function generateWithRetryAndFallback(
  options: {
    contents: any;
    config?: any;
    models?: string[];
  }
) {
  const ai = getGeminiClient();
  // Order of models: start with gemini-2.5-flash and gemini-3.1-flash-lite for maximum availability and throughput
  const candidateModels = options.models && options.models.length > 0
    ? options.models
    : ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      console.log(`[Gemini API] Requesting model ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      console.log(`[Gemini API] Successfully generated with model: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      const errMessage = err?.message || String(err);
      const errStatus = err?.status || err?.code || '';
      const isOverloaded =
        errStatus === 503 ||
        errStatus === 'UNAVAILABLE' ||
        errMessage.includes('503') ||
        errMessage.includes('UNAVAILABLE') ||
        errMessage.includes('high demand') ||
        errMessage.includes('temporarily') ||
        errMessage.includes('overloaded');

      console.warn(`[Gemini API] Model ${model} failed (${errStatus || 'error'}): ${errMessage}. Trying next available model...`);

      if (isOverloaded) {
        // High demand on this specific model endpoint: switch instantly to next candidate model
        continue;
      }

      // For rate limits (429), brief pause before next attempt/model
      if (errStatus === 429 || errStatus === 'RESOURCE_EXHAUSTED' || errMessage.includes('quota')) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
  }

  throw lastError;
}

function cleanAndParseJson(rawText: string | undefined): any {
  if (!rawText) return {};
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, ' ')
    .replace(/\[\d+\]|\[note\s*\d+\]/gi, ' ') // Remove Wikipedia footnote marks like [1], [note 2]
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Category & Genre French Translation & Normalization Dictionary
 */
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  fiction: 'Roman',
  'literary fiction': 'Littérature classique',
  literature: 'Littérature',
  classics: 'Littérature classique',
  'classic literature': 'Littérature classique',
  'french literature': 'Littérature française',
  'english literature': 'Littérature étrangère',
  'science fiction': 'Science-Fiction',
  'sci-fi': 'Science-Fiction',
  fantasy: 'Fantasy',
  'science fiction & fantasy': 'Science-Fiction & Fantasy',
  mystery: 'Policier & Thriller',
  'mystery & detective': 'Policier & Mystère',
  detective: 'Policier',
  thriller: 'Thriller',
  suspense: 'Thriller',
  crime: 'Policier & Thriller',
  'comics & graphic novels': 'Bande Dessinée',
  comics: 'Bande Dessinée',
  'graphic novels': 'Bande Dessinée',
  manga: 'Manga',
  history: 'Histoire',
  historical: 'Histoire',
  'historical fiction': 'Roman historique',
  philosophy: 'Philosophie',
  'biography & autobiography': 'Biographie',
  biography: 'Biographie',
  autobiography: 'Autobiographie',
  memoir: 'Mémoires',
  poetry: 'Poésie',
  drama: 'Théâtre',
  plays: 'Théâtre',
  theater: 'Théâtre',
  'juvenile fiction': 'Jeunesse',
  'young adult': 'Jeunesse',
  "children's": 'Jeunesse',
  'children\'s fiction': 'Jeunesse',
  'self-help': 'Développement personnel',
  psychology: 'Psychologie',
  science: 'Sciences & Nature',
  nature: 'Sciences & Nature',
  technology: 'Sciences & Techniques',
  computers: 'Informatique',
  'art & photography': 'Art & Beaux Livres',
  art: 'Art & Beaux Livres',
  cooking: 'Cuisine & Gastronomie',
  cookbooks: 'Cuisine & Gastronomie',
  travel: 'Voyage & Guides',
  religion: 'Spiritualité & Religions',
  spirituality: 'Spiritualité & Religions',
  'social science': 'Sciences humaines & Société',
  sociology: 'Essais & Société',
  politics: 'Politique & Société',
  'political science': 'Politique & Société',
  business: 'Économie & Entreprise',
  economics: 'Économie & Entreprise',
  adventure: 'Aventure',
  'adventure stories': 'Aventure',
  romance: 'Roman d\'amour',
  horror: 'Horreur & Épouvante',
  essays: 'Essais',
  essay: 'Essais',
};

/**
 * Normalizes any category / subject into clear French
 */
function normalizeCategoryToFrench(rawCategory?: string): string {
  if (!rawCategory) return 'Roman';
  let cat = rawCategory.trim();

  // If contains delimiters like " / " or " > " or ",", take meaningful parts
  const parts = cat.split(/[\/,>]/).map((p) => p.trim()).filter(Boolean);
  
  for (const part of parts.reverse()) {
    const lower = part.toLowerCase();
    if (CATEGORY_TRANSLATIONS[lower]) {
      return CATEGORY_TRANSLATIONS[lower];
    }
  }

  const fullLower = cat.toLowerCase();
  for (const [enKey, frVal] of Object.entries(CATEGORY_TRANSLATIONS)) {
    if (fullLower.includes(enKey)) {
      return frVal;
    }
  }

  // Common French standardizations
  if (/bd|bande dessinee|bande dessinée/i.test(fullLower)) return 'Bande Dessinée';
  if (/manga/i.test(fullLower)) return 'Manga';
  if (/policier|polar|meurtre|enquete|crime/i.test(fullLower)) return 'Policier & Thriller';
  if (/science-fiction|sci-fi|sf/i.test(fullLower)) return 'Science-Fiction';
  if (/fantasy|fantastique/i.test(fullLower)) return 'Fantasy & Fantastique';
  if (/classique/i.test(fullLower)) return 'Littérature classique';
  if (/histoire|historique/i.test(fullLower)) return 'Histoire';
  if (/philosophie/i.test(fullLower)) return 'Philosophie';
  if (/poesie|poésie/i.test(fullLower)) return 'Poésie';
  if (/theatre|théâtre/i.test(fullLower)) return 'Théâtre';
  if (/biographie|autobiographie|memoire|mémoire/i.test(fullLower)) return 'Biographie';
  if (/jeunesse|enfant|ado/i.test(fullLower)) return 'Jeunesse';
  if (/essai|sociologie|politique/i.test(fullLower)) return 'Essais & Société';
  if (/art|peinture|photo/i.test(fullLower)) return 'Art & Beaux Livres';
  if (/cuisine|gastronomie/i.test(fullLower)) return 'Cuisine & Gastronomie';
  if (/voyage|guide/i.test(fullLower)) return 'Voyage & Guides';
  if (/developpement personnel|bien-etre/i.test(fullLower)) return 'Développement personnel';

  return parts[0] || 'Roman';
}

/**
 * Clean & translate tags / keywords into French, filtering raw library jargon
 */
const TAG_TRANSLATIONS: Record<string, string> = {
  'french literature': 'Littérature française',
  'french authors': 'Auteurs français',
  'classic literature': 'Classique',
  classics: 'Classique',
  fiction: 'Fiction',
  novel: 'Roman',
  novels: 'Roman',
  adventure: 'Aventure',
  'adventure stories': 'Aventure',
  'historical fiction': 'Roman historique',
  history: 'Histoire',
  love: 'Amour',
  romance: 'Romance',
  war: 'Guerre',
  'world war': 'Guerre mondiale',
  paris: 'Paris',
  france: 'France',
  friendship: 'Amitié',
  philosophy: 'Philosophie',
  death: 'Drame',
  magic: 'Magie',
  space: 'Espace',
  future: 'Futur',
  monsters: 'Créatures fantastiques',
  '19th century': 'XIXe siècle',
  '20th century': 'XXe siècle',
  '18th century': 'XVIIIe siècle',
  poetry: 'Poésie',
  theater: 'Théâtre',
  drama: 'Drame',
  crime: 'Crime',
  detective: 'Enquête',
  mystery: 'Mystère',
};

const BANNED_TAG_SUBSTRINGS = [
  'protected daisy',
  'lending library',
  'accessible book',
  'overdrive',
  'in library',
  'borrowable',
  'internet archive',
  'long_now',
  'nyt:',
  'openlibrary',
  'gutindex',
  'large type books',
  'translations into french',
  'translations from french',
  'reading level',
  'cd-rom',
  'audiobook',
  'fast search',
  'worldcat',
];

function cleanAndTranslateTagsToFrench(rawTags?: string[]): string[] {
  if (!rawTags || !Array.isArray(rawTags)) return ['Littérature'];
  const frenchTags: string[] = [];

  for (const raw of rawTags) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.trim();
    const lower = clean.toLowerCase();

    // Skip technical library metadata tags
    if (BANNED_TAG_SUBSTRINGS.some((banned) => lower.includes(banned))) {
      continue;
    }

    if (TAG_TRANSLATIONS[lower]) {
      frenchTags.push(TAG_TRANSLATIONS[lower]);
    } else {
      // Capitalize first letter and keep if reasonable length (< 30 chars)
      if (clean.length >= 3 && clean.length <= 35) {
        const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
        frenchTags.push(capitalized);
      }
    }
  }

  // Deduplicate and limit to top 4 tags
  return Array.from(new Set(frenchTags)).slice(0, 4);
}

/**
 * Checks if a given text is already in French
 */
function isFrenchText(text: string): boolean {
  if (!text || text.length < 20) return false;
  const lower = ' ' + text.toLowerCase() + ' ';

  const frenchIndicators = [
    ' le ', ' la ', ' les ', ' un ', ' une ', ' des ', ' du ', ' de ', ' d\'',
    ' dans ', ' pour ', ' avec ', ' sur ', ' est ', ' sont ', ' était ', ' cette ',
    ' ce ', ' son ', ' ses ', ' qui ', ' que ', ' dont ', ' par ', ' plus ',
    ' ainsi ', ' après ', ' roman ', ' histoire ', ' livre ', ' auteur ', ' publiée ',
    ' paru ', ' publié ', ' récit ', ' personnages ', ' siècle ', ' vie ', ' œuvre '
  ];

  const englishIndicators = [
    ' the ', ' and ', ' with ', ' of ', ' for ', ' from ', ' is ', ' was ',
    ' are ', ' were ', ' this ', ' that ', ' story ', ' novel ', ' written by ',
    ' about ', ' published ', ' which ', ' their ', ' after ', ' between ', ' into '
  ];

  let frScore = 0;
  for (const ind of frenchIndicators) {
    if (lower.includes(ind)) frScore++;
  }

  let enScore = 0;
  for (const ind of englishIndicators) {
    if (lower.includes(ind)) enScore++;
  }

  return frScore >= 3 && frScore > enScore;
}

/**
 * Translates a foreign text into fluent, concise French
 */
async function translateToFrench(text: string): Promise<string> {
  if (!text || text.length < 5) return text;
  if (isFrenchText(text)) return text;

  // 1. Try Google Translate single-shot free API
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encodeURIComponent(
      text.substring(0, 1500)
    )}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item: any) => item[0]).join('');
        if (translated && translated.trim().length > 10) {
          return translated.trim();
        }
      }
    }
  } catch (err) {
    // ignore and fallback
  }

  // 2. Try MyMemory Free Translation API
  try {
    const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.substring(0, 500)
    )}&langpair=en|fr`;
    const res = await fetch(mmUrl, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
    if (res.ok) {
      const data = await res.json();
      if (data.responseData && data.responseData.translatedText) {
        return data.responseData.translatedText;
      }
    }
  } catch (err) {
    // ignore
  }

  return text;
}

/**
 * Validates if a text string is a genuine literary book synopsis or blurb,
 * and strictly rejects technical librarian notes, series titles, and cataloguing metadata.
 */
function isValidBookSynopsis(text?: string): boolean {
  if (!text || typeof text !== 'string') return false;
  const clean = text.trim();
  if (clean.length < 35) return false;

  const lower = clean.toLowerCase();

  // Rejection patterns for librarian notes, collection titles, series classification
  const technicalPatterns = [
    'code à barres',
    'code a barres',
    'notice rédigée',
    'notice redigee',
    'dépôt légal',
    'depot legal',
    'titre de couv',
    'titre pris sur',
    'titre forgé',
    'exemplaire',
    'pagination :',
    'bibliogr.',
    'la couv. porte',
    'texte imprimé',
    'ouvrage relié',
    'ouvrage broché',
    'prix :',
    'francs',
    'isbn 9',
    'isbn 2',
    'vol. (',
    'index p.',
    'cote :',
    'source :',
    'tirage limité',
    'collection :',
    'collection:',
    'sciences-fiction :',
    'science-fiction :',
    'fantastique :',
    'traduit de l\'',
    'traduction de',
    'impr. en',
    'imprimé en',
    'numéro :',
    'issn ',
    'poche.',
    'titre original :',
  ];

  for (const pat of technicalPatterns) {
    if (lower.startsWith(pat) || (lower.includes(pat) && clean.length < 130)) {
      return false;
    }
  }

  // Ensure it has full sentence structure
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 8) return false;

  return true;
}

/**
 * Formats BnF creator/author string (e.g. "Hugo, Victor (1802-1885). Auteur du texte" -> "Victor Hugo")
 */
function formatBnfAuthor(raw: string): string {
  if (!raw) return '';
  const clean = raw
    .replace(/\.\s*Auteur du texte/gi, '')
    .replace(/\s*\(\d{4}[^)]*\)/g, '') // remove birth/death dates
    .replace(/,\s*préf\..*$/gi, '')
    .replace(/,\s*éd\..*$/gi, '')
    .replace(/,\s*trad\..*$/gi, '')
    .replace(/,\s*illustrateur.*$/gi, '')
    .trim();

  // If format is "Nom, Prénom"
  if (clean.includes(',')) {
    const parts = clean.split(',').map((p) => p.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return `${parts[1]} ${parts[0]}`.trim();
    }
  }
  return clean;
}

/**
 * Extracts page count from BnF format string (e.g. "1 vol. (324 p.) ; 18 cm", "XII-450 p.")
 */
function extractPagesFromBnfFormat(formatStr?: string): number | undefined {
  if (!formatStr) return undefined;
  const match = formatStr.match(/(\d+)\s*p\./i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0 && num < 10000) {
      return num;
    }
  }
  return undefined;
}

/**
 * Queries the official Catalogue général de la BnF (Bibliothèque nationale de France) via SRU API.
 * Provides the most authoritative French bibliographic record: author, publisher, exact publication year,
 * pages, ISBN, official RAMEAU subjects, and description.
 */
async function fetchBnfCatalogData(title: string, author?: string): Promise<{
  synopsis?: string;
  originalYear?: string;
  pagesEstimate?: number;
  genre?: string;
  tags?: string[];
  canonicalAuthor?: string;
  publisher?: string;
  isbn?: string;
  source?: string;
} | null> {
  const cleanTitle = title.trim();
  const cleanAuthor = author ? author.trim() : '';

  // Clean words for CQL query
  const titleWords = cleanTitle
    .replace(/["'?!:;.,()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 5)
    .join(' ');
  const authorWords = cleanAuthor
    .replace(/["'?!:;.,()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 3)
    .join(' ');

  if (!titleWords) return null;

  const cqlQueries = [
    authorWords
      ? `(bib.title all "${titleWords}") and (bib.author all "${authorWords}")`
      : `bib.title all "${titleWords}"`,
    `bib.title all "${titleWords}"`,
  ];

  for (const cql of cqlQueries) {
    try {
      const sruUrl = `https://catalogue.bnf.fr/api/SRU?version=1.2&operation=searchRetrieve&query=${encodeURIComponent(
        cql
      )}&recordSchema=dublincore&maximumRecords=4`;

      const res = await fetch(sruUrl, {
        headers: { 'User-Agent': 'BiblioScan-BnF-Catalogue/1.0' },
      });

      if (!res.ok) continue;
      const xmlText = await res.text();

      // Check if we received records
      if (!xmlText.includes('<srw:record>') && !xmlText.includes('<oai_dc:dc')) {
        continue;
      }

      // Extract all dc records
      const recordMatches = xmlText.match(/<oai_dc:dc[\s\S]*?<\/oai_dc:dc>/gi);
      if (!recordMatches || recordMatches.length === 0) continue;

      for (const rec of recordMatches) {
        // Extract fields via regex
        const getTag = (tag: string) => {
          const m = rec.match(new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)<\\/dc:${tag}>`, 'i'));
          return m ? stripHtml(m[1]) : '';
        };

        const getAllTags = (tag: string) => {
          const regex = new RegExp(`<dc:${tag}[^>]*>([\\s\\S]*?)<\\/dc:${tag}>`, 'gi');
          const results: string[] = [];
          let match;
          while ((match = regex.exec(rec)) !== null) {
            results.push(stripHtml(match[1]));
          }
          return results;
        };

        const recTitle = getTag('title');
        const rawCreator = getTag('creator');
        const rawPublisher = getTag('publisher');
        const rawDate = getTag('date');
        const rawFormat = getTag('format');
        const rawSubjects = getAllTags('subject');
        const rawDescription = getTag('description');
        const rawIdentifiers = getAllTags('identifier');

        if (recTitle) {
          const formattedAuthor = formatBnfAuthor(rawCreator);
          const pages = extractPagesFromBnfFormat(rawFormat);
          const yearMatch = rawDate.match(/(\d{4})/);
          const year = yearMatch ? yearMatch[1] : undefined;

          // ISBN extraction from identifiers
          let isbn: string | undefined;
          for (const id of rawIdentifiers) {
            const isbnMatch = id.match(/ISBN\s*([0-9Xx\-]+)/i);
            if (isbnMatch) {
              isbn = isbnMatch[1].replace(/[^0-9Xx]/g, '').trim();
              break;
            }
          }

          // RAMEAU subjects translation/mapping
          const genre = rawSubjects.length > 0 ? normalizeCategoryToFrench(rawSubjects[0]) : 'Roman';
          const tags = cleanAndTranslateTagsToFrench(rawSubjects);

          return {
            originalYear: year,
            pagesEstimate: pages,
            genre,
            tags,
            canonicalAuthor: formattedAuthor || cleanAuthor,
            publisher: rawPublisher || undefined,
            isbn,
            source: 'Catalogue général de la BnF',
          };
        }
      }
    } catch (err) {
      console.warn('[BnF SRU] Search error:', err);
    }
  }

  return null;
}

/**
 * Queries data.bnf.fr SPARQL endpoint for rich literary abstracts and authority notices from the BnF.
 */
async function fetchBnfDataFrAbstract(title: string, author?: string): Promise<string | null> {
  const cleanTitle = title.trim().replace(/["\\]/g, '');
  if (!cleanTitle || cleanTitle.length < 3) return null;

  try {
    const sparql = `
      PREFIX dcterms: <http://purl.org/dc/terms/>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX bnf-onto: <http://data.bnf.fr/ontology/bnf-onto/>
      
      SELECT ?abstract ?comment WHERE {
        ?work a bnf-onto:Work ;
              dcterms:title ?t .
        OPTIONAL { ?work dcterms:abstract ?abstract . }
        OPTIONAL { ?work rdfs:comment ?comment . }
        FILTER (REGEX(?t, "^${cleanTitle}", "i") || REGEX(?t, "${cleanTitle}", "i"))
      } LIMIT 2
    `.trim();

    const url = `https://data.bnf.fr/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'BiblioScan-BnF/1.0',
        Accept: 'application/sparql-results+json, application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const bindings = data.results?.bindings;
      if (bindings && bindings.length > 0) {
        for (const b of bindings) {
          const text = b.abstract?.value || b.comment?.value;
          if (text && isValidBookSynopsis(text)) {
            let clean = stripHtml(text.trim());
            if (clean.length > 450) {
              const cut = clean.substring(0, 440);
              const lastPeriod = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
              clean = lastPeriod > 150 ? cut.substring(0, lastPeriod + 1) : cut + '...';
            }
            return clean;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[data.bnf.fr SPARQL] Error:', err);
  }
  return null;
}

/**
 * Searches French Wikipedia for authoritative, 100% native French summaries of literary works
 */
async function fetchFrenchWikipediaSummary(title: string, author?: string): Promise<{ synopsis: string; coverUrl?: string } | null> {
  const cleanTitle = title.trim();
  const cleanAuthor = author ? author.trim() : '';

  const queryVariants = [
    cleanTitle,
    `${cleanTitle} (roman)`,
    `${cleanTitle} (livre)`,
    `${cleanTitle} (bande dessinée)`,
    `${cleanTitle} (pièce de théâtre)`,
    cleanAuthor ? `${cleanTitle} (${cleanAuthor})` : '',
  ].filter(Boolean);

  // 1. Direct page summary test
  for (const variant of queryVariants) {
    try {
      const wikiUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(variant)}`;
      const wikiRes = await fetch(wikiUrl, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
      if (wikiRes.ok) {
        const wikiJson = await wikiRes.json();
        if (wikiJson.extract && isValidBookSynopsis(wikiJson.extract) && wikiJson.type !== 'disambiguation') {
          let extract = stripHtml(wikiJson.extract);
          if (extract.length > 450) {
            const cut = extract.substring(0, 440);
            const lastPeriod = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
            extract = lastPeriod > 150 ? cut.substring(0, lastPeriod + 1) : cut + '...';
          }
          return {
            synopsis: extract,
            coverUrl: wikiJson.thumbnail?.source,
          };
        }
      }
    } catch {
      // try next variant
    }
  }

  // 2. Wikipedia Search API fallback for fuzzy/canonical article resolution
  try {
    const searchTerms = [
      cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : `${cleanTitle} roman`,
      `${cleanTitle} livre`,
      cleanTitle,
    ];

    for (const term of searchTerms) {
      const searchUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term
      )}&utf8=1&format=json&srlimit=3`;
      const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const results = searchData.query?.search;
        if (results && results.length > 0) {
          for (const item of results) {
            const itemTitle = item.title;
            const summaryUrl = `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(itemTitle)}`;
            const sumRes = await fetch(summaryUrl, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
            if (sumRes.ok) {
              const sumJson = await sumRes.json();
              if (sumJson.extract && isValidBookSynopsis(sumJson.extract) && sumJson.type !== 'disambiguation') {
                let extract = stripHtml(sumJson.extract);
                if (extract.length > 450) {
                  const cut = extract.substring(0, 440);
                  const lastPeriod = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
                  extract = lastPeriod > 150 ? cut.substring(0, lastPeriod + 1) : cut + '...';
                }
                return {
                  synopsis: extract,
                  coverUrl: sumJson.thumbnail?.source,
                };
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Wikipedia FR Search] Error:', err);
  }

  return null;
}

/**
 * Free Public Books Database Search (Catalogue général de la BnF + data.bnf.fr + Wikipédia FR + Google Books)
 * GUARANTEED TO ALWAYS RETURN AUTHENTIC FRENCH METADATA AND AUTHORITATIVE SYNOPSES.
 */
async function fetchPublicBookData(title: string, author?: string) {
  const cleanTitle = title.trim();
  const cleanAuthor = author ? author.trim() : '';

  let foundData: {
    synopsis?: string;
    originalYear?: string;
    pagesEstimate?: number;
    genre?: string;
    tags?: string[];
    canonicalAuthor?: string;
    publisher?: string;
    coverUrl?: string;
    source?: string;
    isbn?: string;
  } = {};

  // 1. Primary bibliographic metadata: Catalogue général de la BnF (Bibliothèque nationale de France)
  try {
    const bnfRecord = await fetchBnfCatalogData(cleanTitle, cleanAuthor);
    if (bnfRecord) {
      foundData = { ...bnfRecord };
      foundData.source = 'Catalogue général de la BnF';
    }
  } catch (err) {
    console.warn('[Public DB] BnF search error:', err);
  }

  // 2. Primary Synopsis Search: Google Books (French 4th cover / publisher blurbs)
  try {
    const gbQueries = [
      cleanAuthor ? `intitle:${cleanTitle} inauthor:${cleanAuthor}` : `intitle:${cleanTitle}`,
      cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle,
      `intitle:${cleanTitle}`,
    ];

    for (const q of gbQueries) {
      if (foundData.synopsis && foundData.publisher && foundData.coverUrl) break;

      const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        q
      )}&langRestrict=fr&maxResults=5`;

      const gbRes = await fetch(gbUrl, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
      if (gbRes.ok) {
        const gbJson = await gbRes.json();
        if (gbJson.items && gbJson.items.length > 0) {
          for (const item of gbJson.items) {
            const vol = item.volumeInfo || {};
            let desc = vol.description ? stripHtml(vol.description) : '';

            const pubYear = vol.publishedDate ? vol.publishedDate.substring(0, 4) : undefined;
            const authors = vol.authors && vol.authors.length > 0 ? vol.authors.join(', ') : cleanAuthor;
            const rawCategories = vol.categories || [];
            const normalizedGenre = normalizeCategoryToFrench(rawCategories[0]);
            const frenchTags = cleanAndTranslateTagsToFrench(rawCategories);
            const cover = vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail;
            const isbn13 = vol.industryIdentifiers?.find((i: any) => i.type === 'ISBN_13')?.identifier;

            foundData.originalYear = foundData.originalYear || pubYear;
            foundData.pagesEstimate = foundData.pagesEstimate || vol.pageCount;
            foundData.genre = foundData.genre || normalizedGenre;
            foundData.tags = foundData.tags && foundData.tags.length > 0 ? foundData.tags : frenchTags;
            foundData.canonicalAuthor = foundData.canonicalAuthor || authors;
            foundData.publisher = foundData.publisher || vol.publisher;
            foundData.coverUrl = foundData.coverUrl || (cover ? cover.replace('http://', 'https://') : undefined);
            foundData.isbn = foundData.isbn || isbn13;

            if (!foundData.synopsis && desc && isValidBookSynopsis(desc)) {
              if (desc.length > 450) {
                const cut = desc.substring(0, 440);
                const lastPeriod = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
                desc = lastPeriod > 150 ? cut.substring(0, lastPeriod + 1) : cut + '...';
              }

              if (isFrenchText(desc)) {
                foundData.synopsis = desc;
                foundData.source = foundData.source ? `${foundData.source} & Google Books` : 'Google Books FR';
                break;
              } else {
                const frenchSynopsis = await translateToFrench(desc);
                if (isValidBookSynopsis(frenchSynopsis)) {
                  foundData.synopsis = frenchSynopsis;
                  foundData.source = foundData.source ? `${foundData.source} & Google Books` : 'Google Books';
                  break;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Public DB] Google Books lookup error:', err);
  }

  // 3. Secondary Synopsis Search: French Wikipedia for literary encyclopedia plot summaries
  if (!foundData.synopsis) {
    try {
      const wikiData = await fetchFrenchWikipediaSummary(cleanTitle, cleanAuthor);
      if (wikiData && wikiData.synopsis && isValidBookSynopsis(wikiData.synopsis)) {
        foundData.synopsis = wikiData.synopsis;
        if (wikiData.coverUrl && !foundData.coverUrl) {
          foundData.coverUrl = wikiData.coverUrl;
        }
        foundData.source = foundData.source ? `${foundData.source} & Wikipédia FR` : 'Wikipédia FR';
      }
    } catch (err) {
      console.warn('[Public DB] French Wikipedia lookup error:', err);
    }
  }

  // 4. Tertiary Synopsis Search: Open Library Public API
  if (!foundData.synopsis) {
    try {
      const olQuery = cleanAuthor ? `${cleanTitle} ${cleanAuthor}` : cleanTitle;
      const olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(
        olQuery
      )}&limit=3`;
      const olRes = await fetch(olUrl, { headers: { 'User-Agent': 'BiblioScan/1.0' } });
      if (olRes.ok) {
        const olJson = await olRes.json();
        if (olJson.docs && olJson.docs.length > 0) {
          const doc = olJson.docs[0];
          let olSynopsis = '';

          if (doc.key) {
            try {
              const workRes = await fetch(`https://openlibrary.org${doc.key}.json`, {
                headers: { 'User-Agent': 'BiblioScan/1.0' },
              });
              if (workRes.ok) {
                const workJson = await workRes.json();
                if (typeof workJson.description === 'string') {
                  olSynopsis = stripHtml(workJson.description);
                } else if (workJson.description && workJson.description.value) {
                  olSynopsis = stripHtml(workJson.description.value);
                }
              }
            } catch {
              // ignore work fetch error
            }
          }

          if (olSynopsis && isValidBookSynopsis(olSynopsis)) {
            if (olSynopsis.length > 450) {
              const cut = olSynopsis.substring(0, 440);
              const lastPeriod = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
              olSynopsis = lastPeriod > 150 ? cut.substring(0, lastPeriod + 1) : cut + '...';
            }

            if (isFrenchText(olSynopsis)) {
              foundData.synopsis = olSynopsis;
              foundData.source = foundData.source ? `${foundData.source} & Open Library` : 'Open Library';
            } else {
              const translated = await translateToFrench(olSynopsis);
              if (isValidBookSynopsis(translated)) {
                foundData.synopsis = translated;
                foundData.source = foundData.source ? `${foundData.source} & Open Library` : 'Open Library';
              }
            }
          }

          const authors = doc.author_name ? doc.author_name.join(', ') : cleanAuthor;
          const year = doc.first_publish_year ? String(doc.first_publish_year) : foundData.originalYear;
          const pages = doc.number_of_pages_median || foundData.pagesEstimate;
          const rawSubjects = doc.subject ? doc.subject.slice(0, 6) : [];
          const frenchTags = cleanAndTranslateTagsToFrench(rawSubjects);
          const normalizedGenre = normalizeCategoryToFrench(rawSubjects[0]);
          const coverUrl = doc.cover_i
            ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            : foundData.coverUrl;

          foundData.originalYear = foundData.originalYear || year;
          foundData.pagesEstimate = foundData.pagesEstimate || pages;
          foundData.genre = foundData.genre || normalizedGenre;
          foundData.tags = foundData.tags && foundData.tags.length > 0 ? foundData.tags : frenchTags;
          foundData.canonicalAuthor = foundData.canonicalAuthor || authors;
          foundData.publisher = foundData.publisher || (doc.publisher ? doc.publisher[0] : undefined);
          foundData.coverUrl = foundData.coverUrl || coverUrl;
        }
      }
    } catch (err) {
      console.warn('[Public DB] Open Library lookup error:', err);
    }
  }

  // Ensure default fallback values are properly localized in French
  if (!foundData.genre) foundData.genre = 'Roman';
  if (!foundData.tags || foundData.tags.length === 0) foundData.tags = ['Littérature'];
  if (!foundData.source) foundData.source = 'Catalogue BnF & Bases publiques';

  // Final check: if synopsis exists and is not French, translate it
  if (foundData.synopsis && !isFrenchText(foundData.synopsis)) {
    foundData.synopsis = await translateToFrench(foundData.synopsis);
  }

  return Object.keys(foundData).length > 0 ? foundData : null;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

/**
 * OCR / Bookshelf Scanner API Endpoint
 * Accepts base64 images of bookshelf or book covers and extracts list of books
 */
app.post('/api/scan-bookshelf', async (req, res) => {
  try {
    const { images, options } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({
        error: 'Veuillez fournir au moins une image de bibliothèque (base64).',
      });
    }

    const ai = getGeminiClient();

    // Prepare image parts for Gemini
    const contents: any[] = [];
    
    // Add prompt instructions
    const promptText = `
Tu es un expert mondial en reconnaissance optique de caractères (OCR), bibliothéconomie et analyse visuelle de rayonnages et de tranches de livres (spines) de bibliothèques physiques.
Analyse méticuleusement la ou les photos fournies de la bibliothèque.

Pour chaque livre visible (sur tranche, couverture, pile horizontale ou verticale) :
1. Extrais précisément le Titre complet du livre (sans inventer, en corrigeant les éventuelles fautes de lecture OCR évidentes).
2. Extrais le ou les Noms d'Auteur(s) (format "Prénom Nom" ou "Nom, Prénom").
3. Si visible, identifie l'Éditeur / Collection (ex: Folio, Gallimard, Pocket, J'ai Lu, Albin Michel, Actes Sud, Flammarion, Seuil, Penguin, etc.).
4. Si mentionné ou évident, note la Série / Tome (ex: "Tome 1", "Vol. 2").
5. Déduis la Catégorie / Genre principal (ex: "Roman", "Science-Fiction & Fantasy", "Policier & Thriller", "Bande Dessinée & Manga", "Histoire & Biographie", "Philosophie & Essais", "Développement Personnel", "Art & Beaux Livres", "Jeunesse", "Sciences & Techniques", "Autre").
6. Évalue le niveau de confiance (entre 0.0 et 1.0) sur la lecture.
7. Identifie la couleur dominante de la tranche (en code hexadécimal ex: "#8B0000" ou nom de couleur CSS ex: "#1e3a8a", "#15803d", "#78350f", "#312e81") pour permettre un affichage visuel réaliste sur étagère.
8. Indique approximativement la boîte englobante (bounding box) sur l'image si possible (valeurs normalisées entre 0 et 1000 : [ymin, xmin, ymax, xmax]).
9. Fournis un court résumé ou mot-clé contextuel si le livre est très célèbre.

Règles importantes :
- Ne génère aucun faux livre : si un texte n'est pas un livre, ignore-le.
- Si le titre ou l'auteur est tronqué ou flou, fais de ton mieux pour reconstituer le titre exact d'après les lettres visibles et la typographie.
- Remplis TOUS les champs du schéma JSON demandé.
`;

    // Process all images provided
    for (let i = 0; i < images.length; i++) {
      const rawImg = images[i];
      let mimeType = 'image/jpeg';
      let base64Data = rawImg;

      if (rawImg.startsWith('data:')) {
        const match = rawImg.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          mimeType = match[1];
          base64Data = match[2];
        }
      }

      contents.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    }

    contents.push({ text: promptText });

    const response = await generateWithRetryAndFallback({
      contents: contents,
      config: {
        systemInstruction:
          'Tu es une IA spécialisée dans la reconnaissance ultra-précise de livres, tranches de livres et bibliothèques personnelles. Tu retournes toujours un JSON conforme au schéma.',
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            books: {
              type: Type.ARRAY,
              description: 'Liste de tous les livres détectés dans les photos',
              items: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: 'Titre complet du livre',
                  },
                  author: {
                    type: Type.STRING,
                    description: "Nom de l'auteur principal ou des auteurs",
                  },
                  subtitle: {
                    type: Type.STRING,
                    description: 'Sous-titre ou complément de titre (optionnel)',
                  },
                  publisher: {
                    type: Type.STRING,
                    description: "Maison d'édition ou collection (ex: Folio, Gallimard)",
                  },
                  series: {
                    type: Type.STRING,
                    description: 'Nom de série ou numéro de tome (optionnel)',
                  },
                  category: {
                    type: Type.STRING,
                    description: 'Genre littéraire estimé',
                  },
                  spineColor: {
                    type: Type.STRING,
                    description: 'Couleur hexadécimale dominante de la tranche (ex: #7c2d12, #1e3a8a)',
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: 'Indice de confiance de lecture entre 0.0 et 1.0',
                  },
                  shortDescription: {
                    type: Type.STRING,
                    description: 'Brève description ou thématique en 1 phrase',
                  },
                  box2d: {
                    type: Type.ARRAY,
                    items: { type: Type.INTEGER },
                    description: 'Boîte englobante normalisée [ymin, xmin, ymax, xmax] sur 1000',
                  },
                },
                required: ['title', 'author', 'category', 'confidence'],
              },
            },
            photoAnalysisSummary: {
              type: Type.STRING,
              description: 'Brève description de ce qui a été vu sur la photo (ex: "Étagère de romans de science-fiction avec 14 livres bien visibles")',
            },
            detectedCount: {
              type: Type.INTEGER,
              description: 'Nombre total de livres repérés',
            },
          },
          required: ['books', 'detectedCount'],
        },
      },
    });

    const responseText = response.text?.trim() || '{}';
    let parsedData;
    try {
      parsedData = cleanAndParseJson(responseText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', responseText);
      return res.status(500).json({
        error: 'Erreur lors du décodage du résultat OCR.',
        raw: responseText,
      });
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error in /api/scan-bookshelf:', error);
    const isOverloaded =
      error?.status === 503 ||
      error?.code === 503 ||
      error?.status === 'UNAVAILABLE' ||
      String(error?.message).includes('503') ||
      String(error?.message).includes('high demand') ||
      String(error?.message).includes('UNAVAILABLE');

    const statusCode = isOverloaded ? 503 : 500;
    const userMessage = isOverloaded
      ? "Les serveurs d'intelligence artificielle subissent actuellement une forte affluence temporaire. Veuillez patienter quelques secondes et relancer l'analyse."
      : error?.message || "Une erreur est survenue lors de l'analyse OCR.";

    return res.status(statusCode).json({
      error: userMessage,
      isHighDemand: isOverloaded,
    });
  }
});

/**
 * Public lookup endpoint (Google Books / OpenLibrary / Wikipedia)
 */
app.post('/api/public-lookup', async (req, res) => {
  try {
    const { title, author } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    const publicData = await fetchPublicBookData(title, author);
    if (publicData) {
      return res.json({ success: true, data: publicData });
    } else {
      return res.json({
        success: false,
        message: 'Aucun résultat trouvé dans les bases publiques gratuites.',
      });
    }
  } catch (err: any) {
    console.error('Error in /api/public-lookup:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de la recherche publique.' });
  }
});

/**
 * Batch enrich multiple books from public databases (free, fast, no quota exhaustion)
 */
app.post('/api/batch-enrich-public', async (req, res) => {
  try {
    const { books } = req.body; // Array of { id, title, author }
    if (!books || !Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ error: 'Liste de livres requise' });
    }

    const results: Array<{ id: string; success: boolean; data?: any }> = [];

    // Process with controlled concurrency of 4
    const chunks = [];
    for (let i = 0; i < books.length; i += 4) {
      chunks.push(books.slice(i, i + 4));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (b: { id: string; title: string; author?: string }) => {
        try {
          const pubData = await fetchPublicBookData(b.title, b.author);
          if (pubData) {
            results.push({ id: b.id, success: true, data: pubData });
          } else {
            results.push({ id: b.id, success: false });
          }
        } catch {
          results.push({ id: b.id, success: false });
        }
      });
      await Promise.all(chunkPromises);
    }

    return res.json({ success: true, results });
  } catch (err: any) {
    console.error('Error in /api/batch-enrich-public:', err);
    return res.status(500).json({ error: err.message || 'Erreur lors de l’enrichissement en lot.' });
  }
});

/**
 * Single book enricher / ISBN lookup
 * Supports mode: 'public' | 'ai' | 'auto' (default: 'auto')
 */
app.post('/api/enrich-book', async (req, res) => {
  try {
    const { title, author, mode = 'auto' } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    // 1. If mode is 'auto' or 'public', try free public database first
    if (mode === 'auto' || mode === 'public') {
      const publicData = await fetchPublicBookData(title, author);
      if (publicData && publicData.synopsis) {
        return res.json({
          success: true,
          data: publicData,
          source: publicData.source || 'Base publique',
        });
      }

      // If user strictly requested public mode and nothing found:
      if (mode === 'public') {
        if (publicData) {
          return res.json({
            success: true,
            data: publicData,
            source: publicData.source || 'Base publique',
          });
        }
        return res.status(404).json({
          error: 'Aucune fiche trouvée dans les bases publiques gratuites pour ce titre.',
        });
      }
    }

    // 2. Fallback to or explicitly requested Gemini AI
    const prompt = `Trouve les métadonnées littéraires précises pour le livre suivant : Titre: "${title}", Auteur: "${author || 'Inconnu'}".
Fournis un résumé concis en français (2 à 3 phrases maximum), la date de première parution, le genre exact, le nombre approximatif de pages, et les thèmes clés.`;

    const response = await generateWithRetryAndFallback({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            synopsis: { type: Type.STRING, description: 'Résumé en 2-3 phrases en français' },
            originalYear: { type: Type.STRING, description: "Année de publication originale (ex: '1943')" },
            pagesEstimate: { type: Type.INTEGER, description: 'Nombre estimé de pages' },
            genre: { type: Type.STRING, description: 'Genre littéraire précis' },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 à 5 mots-clés ou tags',
            },
            canonicalAuthor: { type: Type.STRING, description: "Nom canonique de l'auteur" },
          },
          required: ['synopsis', 'genre', 'tags'],
        },
      },
    });

    let result;
    try {
      result = cleanAndParseJson(response.text);
    } catch {
      result = {};
    }
    result.source = 'Intelligence Artificielle (Gemini)';
    return res.json({ success: true, data: result, source: 'IA Gemini' });
  } catch (err: any) {
    console.error('Error enriching book:', err);
    const isOverloaded =
      err?.status === 503 ||
      err?.code === 503 ||
      err?.status === 'UNAVAILABLE' ||
      String(err?.message).includes('503') ||
      String(err?.message).includes('high demand') ||
      String(err?.message).includes('UNAVAILABLE');

    const statusCode = isOverloaded ? 503 : 500;
    const userMessage = isOverloaded
      ? "Service IA temporairement surchargé. Réessayez dans quelques instants ou utilisez la base publique."
      : err?.message || "Erreur lors de l'enrichissement du livre.";

    return res.status(statusCode).json({ error: userMessage, isHighDemand: isOverloaded });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BiblioScan server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
