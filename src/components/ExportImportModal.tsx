import React, { useState } from 'react';
import { Book, LibraryExportData } from '../types';
import { exportLibraryJson, importLibraryJson } from '../services/db';
import {
  X,
  Download,
  Upload,
  Copy,
  Check,
  FileJson,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  onLibraryReload: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  books,
  onLibraryReload,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [importStrategy, setImportStrategy] = useState<'auto-skip' | 'auto-replace' | 'keep-all'>('auto-skip');
  const [importResult, setImportResult] = useState<{
    added: number;
    skipped: number;
    replaced: number;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleExportJson = async () => {
    const data = await exportLibraryJson();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `bibliotheque_numerique_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    if (books.length === 0) return;
    const headers = ['ID', 'Titre', 'Auteur', 'Sous-titre', 'Genre', 'Éditeur', 'Année', 'Pages', 'Rangement', 'Statut', 'Note', 'Notes', 'Tags'];
    const rows = books.map((b) => [
      b.id,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${(b.subtitle || '').replace(/"/g, '""')}"`,
      `"${(b.category || '').replace(/"/g, '""')}"`,
      `"${(b.publisher || '').replace(/"/g, '""')}"`,
      b.year || '',
      b.pages || '',
      `"${(b.shelf || '').replace(/"/g, '""')}"`,
      b.status,
      b.rating,
      `"${(b.notes || '').replace(/"/g, '""')}"`,
      `"${(b.tags || []).join(', ')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `bibliotheque_export_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = async () => {
    const data = await exportLibraryJson();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportJsonText(event.target?.result as string);
      };
      reader.readAsText(file);
      setImportError(null);
      setImportResult(null);
    }
  };

  const handleStartImport = async () => {
    if (!importJsonText.trim()) {
      setImportError('Veuillez sélectionner un fichier JSON ou coller les données.');
      return;
    }

    setIsProcessing(true);
    setImportError(null);

    try {
      const parsed = JSON.parse(importJsonText);
      const res = await importLibraryJson(parsed, importStrategy);
      setImportResult(res);
      onLibraryReload();

      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch (err: any) {
      setImportError(err.message || 'Fichier JSON invalide.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      id="export-import-modal-backdrop"
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif-title text-lg font-bold">
                Export & Sauvegarde de Données
              </h3>
              <p className="text-xs text-amber-200/80">
                Format JSON universel avec déduplication intelligente à l'import
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

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-6 pt-3">
          <button
            id="tab-export-btn"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 pb-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === 'export'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exporter mes livres (JSON / CSV)</span>
          </button>
          <button
            id="tab-import-btn"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-2 pb-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === 'import'
                ? 'border-amber-800 text-amber-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Restaurer / Importer (JSON)</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {activeTab === 'export' && (
            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-stone-900 block">
                    Votre bibliothèque actuelle
                  </span>
                  <span className="text-xs text-stone-500">
                    {books.length} ouvrage{books.length > 1 ? 's' : ''} indexé{books.length > 1 ? 's' : ''} localement
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-900">
                  Prêt à exporter
                </span>
              </div>

              {/* Main JSON Export Button */}
              <div className="p-5 rounded-2xl border-2 border-amber-800/20 bg-amber-50/40 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-amber-800 text-white shadow-sm">
                    <FileJson className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-serif-title font-bold text-stone-900 text-base">
                      Fichier JSON Complet (Recommandé)
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Sauvegarde exhaustive : titres, auteurs, notes, notes étoilées, rangements, couleurs de tranches et tags.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    id="download-json-btn"
                    onClick={handleExportJson}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl font-semibold text-xs shadow-sm transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger le fichier .json</span>
                  </button>
                  <button
                    id="copy-json-btn"
                    onClick={handleCopyJson}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 rounded-xl font-semibold text-xs transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copié !' : 'Copier JSON'}</span>
                  </button>
                </div>
              </div>

              {/* Secondary CSV Export */}
              <div className="p-4 rounded-2xl border border-stone-200 bg-white flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-stone-900 text-xs sm:text-sm">
                      Tableur Excel / CSV
                    </h5>
                    <p className="text-[11px] text-stone-500">
                      Export tabulaire pour Excel, Google Sheets, LibreOffice
                    </p>
                  </div>
                </div>
                <button
                  id="download-csv-btn"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-semibold text-xs transition"
                >
                  Télécharger .csv
                </button>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* File upload input */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5">
                  Sélectionner un fichier JSON de sauvegarde
                </label>
                <input
                  id="import-file-input"
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="w-full text-xs text-stone-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-800 file:text-white hover:file:bg-amber-900 cursor-pointer p-2 border border-stone-200 rounded-2xl bg-stone-50"
                />
              </div>

              {/* Deduplication strategy choice */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Gestion des doublons à l'importation :
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100/80 cursor-pointer">
                    <input
                      type="radio"
                      name="dupStrategy"
                      checked={importStrategy === 'auto-skip'}
                      onChange={() => setImportStrategy('auto-skip')}
                      className="text-amber-800 focus:ring-amber-700"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-stone-900 block">
                        Ignorer automatiquement les doublons (Recommandé)
                      </span>
                      <span className="text-stone-500 text-[11px]">
                        Les livres déjà présents dans votre bibliothèque ne seront pas importés en double.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100/80 cursor-pointer">
                    <input
                      type="radio"
                      name="dupStrategy"
                      checked={importStrategy === 'auto-replace'}
                      onChange={() => setImportStrategy('auto-replace')}
                      className="text-amber-800 focus:ring-amber-700"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-stone-900 block">
                        Mettre à jour les livres existants
                      </span>
                      <span className="text-stone-500 text-[11px]">
                        Écrase et complète les informations des livres correspondants.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Paste raw JSON textarea */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1">
                  Ou collez directement le texte JSON :
                </label>
                <textarea
                  id="import-raw-json-textarea"
                  rows={3}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder='{"appName": "BiblioScan", "books": [...]}'
                  className="w-full p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs font-mono text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-700 resize-none"
                />
              </div>

              {/* Result alerts */}
              {importResult && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Importation terminée avec succès !</span>
                  </div>
                  <div>
                    • <strong>{importResult.added}</strong> nouveau{importResult.added > 1 ? 'x' : ''} livre{importResult.added > 1 ? 's' : ''} ajouté{importResult.added > 1 ? 's' : ''}
                    <br />
                    • <strong>{importResult.skipped}</strong> doublon{importResult.skipped > 1 ? 's' : ''} ignoré{importResult.skipped > 1 ? 's' : ''} automatiquement
                    {importResult.replaced > 0 && (
                      <span><br />• <strong>{importResult.replaced}</strong> livre{importResult.replaced > 1 ? 's' : ''} mis à jour</span>
                    )}
                  </div>
                </div>
              )}

              {importError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {/* Import CTA */}
              <button
                id="execute-import-btn"
                disabled={!importJsonText.trim() || isProcessing}
                onClick={handleStartImport}
                className="w-full flex items-center justify-center gap-2 py-3 bg-amber-800 hover:bg-amber-900 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-sm transition"
              >
                <Upload className="w-4 h-4" />
                <span>{isProcessing ? 'Importation en cours...' : 'Lancer l’importation dans la base locale'}</span>
              </button>
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
