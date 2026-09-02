import React from 'react';
import {
  Camera,
  Plus,
  FileJson,
  PieChart,
  BookMarked,
  Wifi,
  WifiOff,
  Sparkles,
  Layers,
} from 'lucide-react';

interface NavbarProps {
  totalBooksCount: number;
  onOpenScanModal: () => void;
  onOpenAddModal: () => void;
  onOpenExportModal: () => void;
  onOpenStatsModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalBooksCount,
  onOpenScanModal,
  onOpenAddModal,
  onOpenExportModal,
  onOpenStatsModal,
}) => {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  React.useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  return (
    <>
      {/* Main Desktop & Tablet Header */}
      <header
        id="app-navbar-header"
        className="bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-md backdrop-blur-md bg-stone-900/95"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-amber-900 flex items-center justify-center text-amber-100 shadow-md border border-amber-500/30 flex-shrink-0">
              <BookMarked className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-serif-title text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  BiblioScan
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  OCR IA
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-sans hidden sm:block">
                Bibliothèque numérique & reconnaissance par photo
              </p>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Online/Offline status badge */}
            <div
              id="online-status-badge"
              className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isOnline
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
              }`}
              title={isOnline ? 'Connecté aux serveurs IA' : 'Mode hors-ligne local actif'}
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>En ligne</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                  <span>Hors-ligne</span>
                </>
              )}
            </div>

            {/* Stats Button */}
            <button
              id="header-stats-btn"
              onClick={onOpenStatsModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition"
              title="Voir les statistiques"
            >
              <PieChart className="w-4 h-4" />
              <span>Statistiques</span>
            </button>

            {/* Export/Import JSON Button */}
            <button
              id="header-export-btn"
              onClick={onOpenExportModal}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition"
              title="Sauvegarde & Export JSON"
            >
              <FileJson className="w-4 h-4" />
              <span className="hidden sm:inline">Export / Import</span>
            </button>

            {/* Manual Add Button */}
            <button
              id="header-manual-add-btn"
              onClick={onOpenAddModal}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau</span>
            </button>

            {/* Main Primary Scan Button */}
            <button
              id="header-scan-btn"
              onClick={onOpenScanModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl font-semibold text-xs sm:text-sm shadow-md transition transform active:scale-95 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-amber-200" />
              <span>Scanner (Photos)</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Fixed Navigation Bar */}
      <nav
        id="mobile-bottom-nav"
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-stone-900/95 backdrop-blur-lg border-t border-stone-800 z-40 px-4 py-2 flex items-center justify-around shadow-2xl"
      >
        <button
          id="mobile-nav-scan"
          onClick={onOpenScanModal}
          className="flex flex-col items-center gap-1 text-amber-400 p-1 min-w-[54px]"
        >
          <div className="w-10 h-10 rounded-full bg-amber-800 flex items-center justify-center text-white shadow-md">
            <Camera className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold">Scanner</span>
        </button>

        <button
          id="mobile-nav-add"
          onClick={onOpenAddModal}
          className="flex flex-col items-center gap-1 text-stone-400 hover:text-stone-200 p-1 min-w-[54px]"
        >
          <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-200">
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[10px]">Manuel</span>
        </button>

        <button
          id="mobile-nav-export"
          onClick={onOpenExportModal}
          className="flex flex-col items-center gap-1 text-stone-400 hover:text-stone-200 p-1 min-w-[54px]"
        >
          <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-200">
            <FileJson className="w-4 h-4" />
          </div>
          <span className="text-[10px]">Export JSON</span>
        </button>

        <button
          id="mobile-nav-stats"
          onClick={onOpenStatsModal}
          className="flex flex-col items-center gap-1 text-stone-400 hover:text-stone-200 p-1 min-w-[54px]"
        >
          <div className="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-200">
            <PieChart className="w-4 h-4" />
          </div>
          <span className="text-[10px]">Stats</span>
        </button>
      </nav>
    </>
  );
};
