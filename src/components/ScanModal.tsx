import React, { useState, useRef } from 'react';
import { Book, ScanDetectedBook } from '../types';
import { detectAndFlagDuplicates } from '../utils/deduplication';
import { getDemoBookshelfImages } from '../services/db';
import confetti from 'canvas-confetti';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Image as ImageIcon,
  Edit3,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingLibrary: Book[];
  onImportBooks: (books: Book[]) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  existingLibrary,
  onImportBooks,
}) => {
  const [images, setImages] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isOverloadedError, setIsOverloadedError] = useState(false);
  const [detectedBooks, setDetectedBooks] = useState<ScanDetectedBook[]>([]);
  const [step, setStep] = useState<'upload' | 'scanning' | 'review'>('upload');
  const [photoAnalysisSummary, setPhotoAnalysisSummary] = useState<string>('');
  const [autoDeselectDuplicates, setAutoDeselectDuplicates] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    try {
      const base64List = await Promise.all(files.map(fileToBase64));
      setImages((prev) => [...prev, ...base64List]);
      setScanError(null);
    } catch (err) {
      setScanError('Erreur lors du chargement des images.');
    }
  };

  const handleLoadDemoImage = async (demoUrl: string) => {
    try {
      setScanStep('Chargement de la photo démo...');
      const response = await fetch(demoUrl);
      const blob = await response.blob();
      const base64 = await fileToBase64(new File([blob], 'demo_bookshelf.jpg', { type: blob.type }));
      setImages((prev) => [...prev, base64]);
      setScanError(null);
    } catch (e) {
      setScanError('Impossible de charger la photo de démonstration.');
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startOcrScan = async () => {
    if (images.length === 0) {
      setScanError('Veuillez ajouter au moins une photo de votre bibliothèque.');
      return;
    }

    setIsScanning(true);
    setStep('scanning');
    setScanError(null);
    setIsOverloadedError(false);

    try {
      setScanStep('Transmission des clichés au modèle de vision...');
      await new Promise((r) => setTimeout(r, 400));

      setScanStep('Reconnaissance optique des caractères (OCR) sur les tranches...');

      const response = await fetch('/api/scan-bookshelf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        if (response.status === 503 || errJson.isHighDemand) {
          setIsOverloadedError(true);
        }
        throw new Error(errJson.error || 'Erreur lors de l’analyse OCR.');
      }

      setScanStep('Extraction des titres, auteurs et genres...');
      const result = await response.json();

      if (!result.data || !Array.isArray(result.data.books)) {
        throw new Error('Aucun livre n’a pu être détecté sur les photos.');
      }

      setScanStep('Détection et déduplication automatique...');
      setPhotoAnalysisSummary(result.data.photoAnalysisSummary || '');

      const rawBooks = result.data.books.map((b: any, idx: number) => ({
        tempId: `temp-${Date.now()}-${idx}`,
        title: b.title || 'Titre inconnu',
        author: b.author || 'Auteur inconnu',
        subtitle: b.subtitle || '',
        publisher: b.publisher || '',
        series: b.series || '',
        category: b.category || 'Roman',
        spineColor: b.spineColor || '#78350f',
        confidence: typeof b.confidence === 'number' ? b.confidence : 0.9,
        shortDescription: b.shortDescription || '',
        box2d: b.box2d,
      }));

      // Deduplicate against existing library and intra-batch
      const flagged = detectAndFlagDuplicates(rawBooks, existingLibrary, autoDeselectDuplicates);
      setDetectedBooks(flagged);
      setStep('review');
    } catch (err: any) {
      console.error('Scan error:', err);
      const isDemandError =
        String(err.message).includes('503') ||
        String(err.message).includes('affluence') ||
        String(err.message).includes('demand') ||
        String(err.message).includes('UNAVAILABLE');

      if (isDemandError) {
        setIsOverloadedError(true);
      }
      setScanError(
        err.message || 'Une erreur est survenue lors de l’analyse. Veuillez réessayer.'
      );
      setStep('upload');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleSelectBook = (tempId: string) => {
    setDetectedBooks((prev) =>
      prev.map((b) => (b.tempId === tempId ? { ...b, selectedForImport: !b.selectedForImport } : b))
    );
  };

  const selectAll = (select: boolean) => {
    setDetectedBooks((prev) => prev.map((b) => ({ ...b, selectedForImport: select })));
  };

  const selectOnlyNonDuplicates = () => {
    setDetectedBooks((prev) => prev.map((b) => ({ ...b, selectedForImport: !b.isDuplicate })));
  };

  const updateDetectedBook = (tempId: string, field: keyof ScanDetectedBook, value: any) => {
    setDetectedBooks((prev) =>
      prev.map((b) => (b.tempId === tempId ? { ...b, [field]: value } : b))
    );
  };

  const handleFinalImport = () => {
    const selected = detectedBooks.filter((b) => b.selectedForImport);
    if (selected.length === 0) {
      alert('Veuillez sélectionner au moins un livre à importer.');
      return;
    }

    const booksToSave: Book[] = selected.map((b, idx) => ({
      id: `book-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      title: b.title,
      author: b.author,
      subtitle: b.subtitle,
      publisher: b.publisher,
      series: b.series,
      category: b.category,
      spineColor: b.spineColor || '#78350f',
      shelf: 'Étagère Principale',
      status: 'to-read',
      rating: 0,
      notes: b.shortDescription ? `Notes OCR : ${b.shortDescription}` : '',
      tags: [b.category],
      ocrConfidence: b.confidence,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    onImportBooks(booksToSave);

    // Fire joyful confetti
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });

    onClose();
  };

  const duplicateCount = detectedBooks.filter((b) => b.isDuplicate).length;
  const newBooksCount = detectedBooks.filter((b) => !b.isDuplicate).length;
  const selectedCount = detectedBooks.filter((b) => b.selectedForImport).length;

  return (
    <div
      id="scan-modal-backdrop"
      className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-stone-200/80 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-950 to-stone-900 text-white flex items-center justify-between border-b border-amber-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-title text-lg sm:text-xl font-bold tracking-tight">
                Numériser ma bibliothèque par Photo (OCR)
              </h3>
              <p className="text-xs text-amber-200/80">
                Reconnaissance par IA des tranches, titres & auteurs avec déduplication automatique
              </p>
            </div>
          </div>
          <button
            id="close-scan-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {/* STEP 1: Upload / Take Photos */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Camera & File Upload CTA Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Take Photo with Camera */}
                <button
                  id="trigger-camera-btn"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-amber-600/40 bg-amber-50/50 hover:bg-amber-50 text-amber-950 transition group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-800 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm">Prendre une photo (Appareil photo)</span>
                  <span className="text-xs text-stone-500 mt-1 text-center">
                    Photographiez vos étagères ou vos piles de livres
                  </span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                {/* Pick from Gallery */}
                <button
                  id="trigger-gallery-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 hover:bg-stone-100 text-stone-800 transition group cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-stone-800 text-white flex items-center justify-center mb-3 shadow-md group-hover:scale-105 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-semibold text-sm">Importer des photos (Galerie)</span>
                  <span className="text-xs text-stone-500 mt-1 text-center">
                    Sélectionnez une ou plusieurs photos simultanément
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />
              </div>

              {/* Uploaded Photos Reel */}
              {images.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                      Photos sélectionnées ({images.length})
                    </h4>
                    <button
                      onClick={() => setImages([])}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Tout retirer
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {images.map((img, idx) => (
                      <div
                        key={idx}
                        className="relative rounded-xl overflow-hidden border border-stone-200 aspect-video group shadow-sm bg-stone-100"
                      >
                        <img
                          src={img}
                          alt={`Aperçu ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeImage(idx)}
                          className="absolute top-1.5 right-1.5 p-1 bg-stone-900/80 text-white rounded-full hover:bg-rose-600 transition"
                          title="Supprimer cette photo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white font-medium">
                          Photo #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Demo Sample Photos Option */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-semibold text-stone-900 uppercase tracking-wider">
                    Ou testez immédiatement avec un exemple de bibliothèque :
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {getDemoBookshelfImages().map((demo, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleLoadDemoImage(demo.url)}
                      className="text-left p-2.5 rounded-xl bg-white hover:bg-amber-50/80 border border-stone-200 hover:border-amber-400 transition flex items-center gap-2.5 group"
                    >
                      <img
                        src={demo.url}
                        alt={demo.name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-stone-800 truncate group-hover:text-amber-900">
                          {demo.name}
                        </div>
                        <div className="text-[10px] text-stone-400 line-clamp-1">
                          {demo.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Error display */}
              {scanError && (
                <div
                  className={`p-4 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm ${
                    isOverloadedError
                      ? 'bg-amber-50/90 border-amber-300/80 text-amber-950'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        isOverloadedError ? 'text-amber-600' : 'text-rose-500'
                      }`}
                    />
                    <div>
                      <div className="font-semibold text-sm mb-0.5">
                        {isOverloadedError
                          ? 'Forte affluence sur le service IA (Erreur 503)'
                          : 'Erreur lors de l’analyse'}
                      </div>
                      <p className="leading-relaxed opacity-90">{scanError}</p>
                    </div>
                  </div>

                  <button
                    onClick={startOcrScan}
                    className={`px-4 py-2 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 flex-shrink-0 shadow-sm cursor-pointer ${
                      isOverloadedError
                        ? 'bg-amber-800 hover:bg-amber-900 text-white'
                        : 'bg-rose-700 hover:bg-rose-800 text-white'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réessayer maintenant</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Scanning Progress */}
          {step === 'scanning' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-3xl bg-amber-800 text-white flex items-center justify-center shadow-xl animate-pulse">
                  <Sparkles className="w-10 h-10 text-amber-300 animate-spin" />
                </div>
                <div className="absolute -bottom-1 -right-1 p-1.5 bg-stone-900 text-white rounded-full shadow">
                  <Camera className="w-4 h-4" />
                </div>
              </div>

              <div>
                <h4 className="font-serif-title text-xl font-bold text-stone-900 mb-2">
                  Analyse de votre bibliothèque en cours...
                </h4>
                <p className="text-sm font-medium text-amber-900 bg-amber-50 px-4 py-2 rounded-full inline-block border border-amber-200 animate-pulse">
                  {scanStep || 'Reconnaissance optique des caractères par IA...'}
                </p>
              </div>

              <div className="max-w-md text-xs text-stone-500">
                Gemini analyse les tranches de livres, déchiffre les titres et auteurs même inclinés ou petits, et évalue les doublons avec votre collection existante.
              </div>
            </div>
          )}

          {/* STEP 3: Review Detected Books & Automatic Duplicate Prevention */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary Header */}
              {photoAnalysisSummary && (
                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-xs text-amber-950 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Observation de l'IA : </span>
                    {photoAnalysisSummary}
                  </div>
                </div>
              )}

              {/* Deduplication & Count Stats Pill */}
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-stone-900">
                      {detectedBooks.length} livre{detectedBooks.length > 1 ? 's' : ''} détecté{detectedBooks.length > 1 ? 's' : ''} au total
                    </div>
                    <div className="text-[11px] text-stone-500">
                      <span className="text-emerald-700 font-semibold">{newBooksCount} nouveaux</span>
                      {duplicateCount > 0 && (
                        <span> • <span className="text-amber-700 font-semibold">{duplicateCount} doublon{duplicateCount > 1 ? 's' : ''} écarté{duplicateCount > 1 ? 's' : ''}</span></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Selection Buttons */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={selectOnlyNonDuplicates}
                    className="px-2.5 py-1.5 bg-white hover:bg-stone-100 rounded-lg border border-stone-200 text-stone-700 font-medium transition"
                  >
                    Ignorer les doublons
                  </button>
                  <button
                    onClick={() => selectAll(true)}
                    className="px-2.5 py-1.5 bg-white hover:bg-stone-100 rounded-lg border border-stone-200 text-stone-700 font-medium transition"
                  >
                    Tout cocher
                  </button>
                </div>
              </div>

              {/* Detected Books List */}
              <div className="space-y-2.5 max-h-[45vh] overflow-y-auto pr-1">
                {detectedBooks.map((book) => (
                  <div
                    key={book.tempId}
                    className={`p-3.5 rounded-2xl border transition ${
                      book.isDuplicate
                        ? 'bg-amber-50/40 border-amber-200'
                        : 'bg-white border-stone-200 hover:border-stone-300'
                    } ${book.selectedForImport ? 'ring-1 ring-amber-700/30' : 'opacity-70'}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={book.selectedForImport}
                        onChange={() => toggleSelectBook(book.tempId)}
                        className="w-4 h-4 rounded text-amber-800 border-stone-300 focus:ring-amber-700 mt-1 cursor-pointer"
                      />

                      {/* Color Spine Preview */}
                      <div
                        className="w-3.5 h-12 rounded-sm shadow-sm flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: book.spineColor || '#78350f' }}
                      />

                      {/* Editable inputs */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <input
                            type="text"
                            value={book.title}
                            onChange={(e) => updateDetectedBook(book.tempId, 'title', e.target.value)}
                            className="font-serif-title font-semibold text-sm text-stone-900 bg-transparent hover:bg-stone-100/70 focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-stone-300 flex-1 focus:outline-none"
                            placeholder="Titre du livre"
                          />
                          <input
                            type="text"
                            value={book.author}
                            onChange={(e) => updateDetectedBook(book.tempId, 'author', e.target.value)}
                            className="text-xs font-medium text-stone-600 bg-transparent hover:bg-stone-100/70 focus:bg-white px-1.5 py-0.5 rounded border border-transparent focus:border-stone-300 w-full sm:w-44 focus:outline-none"
                            placeholder="Auteur"
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <input
                            type="text"
                            value={book.category}
                            onChange={(e) => updateDetectedBook(book.tempId, 'category', e.target.value)}
                            className="px-2 py-0.5 rounded text-[11px] bg-stone-100 text-stone-700 font-medium border border-stone-200 focus:outline-none w-32"
                            placeholder="Genre"
                          />

                          {book.publisher && (
                            <span className="text-[11px] text-stone-400">
                              Édition : {book.publisher}
                            </span>
                          )}

                          <span className="text-[10px] text-stone-400">
                            Confiance : {Math.round(book.confidence * 100)}%
                          </span>
                        </div>

                        {/* Duplicate Alert Banner if duplicate */}
                        {book.isDuplicate && (
                          <div className="text-[11px] text-amber-800 bg-amber-100/80 px-2 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <span>
                              {book.duplicateReason || 'Doublon détecté avec votre collection.'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-stone-50 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
          {step === 'upload' && (
            <>
              <div className="text-xs text-stone-500">
                {images.length > 0
                  ? `${images.length} photo${images.length > 1 ? 's' : ''} prête${images.length > 1 ? 's' : ''} pour l'OCR`
                  : 'Prenez ou sélectionnez des photos pour commencer.'}
              </div>
              <button
                id="start-ocr-btn"
                disabled={images.length === 0 || isScanning}
                onClick={startOcrScan}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white rounded-xl font-medium text-sm shadow-sm transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Lancer la reconnaissance OCR</span>
              </button>
            </>
          )}

          {step === 'scanning' && (
            <div className="text-xs text-stone-400 mx-auto">
              Traitement en cours, veuillez patienter quelques instants...
            </div>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-1.5 px-4 py-2 text-stone-600 hover:text-stone-900 text-xs font-medium"
              >
                ← Reprendre des photos
              </button>

              <button
                id="confirm-import-btn"
                onClick={handleFinalImport}
                disabled={selectedCount === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-semibold text-sm shadow-md transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Importer ({selectedCount} livre{selectedCount > 1 ? 's' : ''})</span>
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
