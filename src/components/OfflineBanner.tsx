import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, CheckCircle2, CloudOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnectedAlert, setShowReconnectedAlert] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnectedAlert(true);
      setTimeout(() => setShowReconnectedAlert(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnectedAlert(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          id="offline-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-amber-900/90 backdrop-blur-md text-amber-50 px-4 py-2.5 shadow-md border-b border-amber-700/50 sticky top-0 z-50 flex items-center justify-between text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2.5 max-w-5xl mx-auto w-full">
            <div className="p-1 rounded-md bg-amber-800 text-amber-200">
              <WifiOff className="w-4 h-4 animate-pulse" />
            </div>
            <div className="flex-1">
              <span className="font-semibold">Mode Hors-ligne Actif :</span> Votre bibliothèque locale, vos recherches, modifications et exports JSON fonctionnent à 100% hors-ligne.
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] bg-amber-800/80 text-amber-200 border border-amber-600/40">
              Stockage Local Sécurisé
            </span>
          </div>
        </motion.div>
      )}

      {showReconnectedAlert && (
        <motion.div
          id="online-reconnected-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-emerald-800/90 backdrop-blur-md text-emerald-50 px-4 py-2 shadow-md border-b border-emerald-600/50 sticky top-0 z-50 flex items-center justify-between text-xs sm:text-sm"
        >
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>Connexion rétablie. La reconnaissance OCR par IA est de nouveau opérationnelle.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
