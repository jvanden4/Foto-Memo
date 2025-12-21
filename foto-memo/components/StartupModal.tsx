import React from 'react';
import { X, RefreshCw } from 'lucide-react';

interface StartupModalProps {
  isOpen: boolean;
  onScan: () => void;
  onSkip: () => void;
}

export const StartupModal: React.FC<StartupModalProps> = ({
  isOpen,
  onScan,
  onSkip,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-semibold text-slate-800">Map Controleren</h2>
          <button 
            onClick={onSkip}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-500">
            <RefreshCw size={32} />
          </div>

          <h3 className="text-lg font-medium text-slate-800 mb-2">
            Controleren op nieuwe foto's?
          </h3>
          <p className="text-sm text-slate-500 mb-8">
            Wil je de geselecteerde map scannen op nieuwe bestanden die zijn toegevoegd sinds je laatste bezoek?
          </p>

          <div className="flex gap-3 w-full">
            <button
                onClick={onSkip}
                className="flex-1 py-3 rounded-xl font-medium transition-all bg-stone-100 hover:bg-stone-200 text-slate-700"
            >
                Overslaan
            </button>
            <button
                onClick={onScan}
                className="flex-1 py-3 rounded-xl font-medium transition-all shadow-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
            >
                Scannen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};