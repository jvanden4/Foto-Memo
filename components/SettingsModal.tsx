import React, { useRef, useState } from 'react';
import { X, FolderPlus, Loader2, RefreshCw, FolderCog, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { MapItem } from '../types';
import { upsertFilesToDB, StoredFile } from '../utils/db';
import { getFileType, processFileToItem } from '../utils/fileHelpers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  onFolderSelect: (name: string, items: MapItem[]) => void;
  onScan?: () => void;
  isRefreshing?: boolean;
  isLoggedIn?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  folderName,
  onFolderSelect,
  onScan,
  isRefreshing = false,
  isLoggedIn = false,
  onSignIn,
  onSignOut
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);

    try {
        let detectedFolderName = "Geselecteerde Map";
        if (files[0].webkitRelativePath) {
            const parts = files[0].webkitRelativePath.split('/');
            if (parts.length > 1) {
                detectedFolderName = parts[0];
            }
        }

        const newItems: MapItem[] = [];
        const dbItems: StoredFile[] = [];
        const fileArray: File[] = Array.from(files);

        for (let index = 0; index < fileArray.length; index++) {
            const file = fileArray[index];
            if (getFileType(file) !== 'image') continue;

            const { mapItem, buffer } = await processFileToItem(file);
            newItems.push(mapItem);

            const { previewUrl: _, ...meta } = mapItem;
            dbItems.push({
                id: mapItem.id,
                buffer,
                fileType: file.type,
                meta
            });
        }

        await upsertFilesToDB(dbItems);
        onFolderSelect(detectedFolderName, newItems);
    } catch (err) {
        console.error("Failed to process files", err);
        alert("Fout bij verwerken.");
    } finally {
        setIsProcessing(false);
    }
  };

  const busy = isProcessing || isRefreshing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-bold text-slate-800">Instellingen</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-2 rounded-full hover:bg-stone-100"
            disabled={busy}
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Cloud Sync Section */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Cloud Synchronisatie</h3>
            {isLoggedIn ? (
                <div className="space-y-3">
                    <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-green-700 font-bold text-sm">
                            <CheckCircle2 size={16} />
                            Verbonden met Drive
                        </div>
                        <button onClick={onSignOut} className="text-stone-400 hover:text-red-500 transition-colors">
                            <LogOut size={18} />
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500">Metadata wordt automatisch opgeslagen in 'foto_memo_data.json'.</p>
                </div>
            ) : (
                <button 
                    onClick={onSignIn}
                    className="w-full flex items-center justify-center gap-2 bg-white border border-stone-300 hover:bg-stone-50 text-slate-700 py-2.5 rounded-lg text-sm font-bold shadow-sm transition-all active:scale-95"
                >
                    <LogIn size={18} />
                    Inloggen met Google
                </button>
            )}
          </div>

          <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100 mb-2">
              <div className="bg-white p-2.5 rounded-lg shadow-sm">
                  <FolderCog className="text-indigo-600" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">Actieve Map</p>
                  <p className="text-slate-800 font-bold truncate">{folderName || 'Geen map geselecteerd'}</p>
              </div>
          </div>

          <p className="text-sm text-slate-500 px-1 mb-4">
             Beheer de foto's in je lokale map. Je kunt nieuwe foto's toevoegen of een volledig andere map kiezen.
          </p>

          <input
            type="file"
            ref={inputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
          />

          <div className="space-y-3">
              {folderName && (
                  <button
                    onClick={onScan}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition-all bg-white hover:bg-stone-50 text-indigo-600 border-2 border-indigo-600 active:scale-95 disabled:opacity-50"
                  >
                    {isRefreshing ? <Loader2 className="animate-spin" size={22} /> : <RefreshCw size={22} />}
                    Scan op nieuwe foto's
                  </button>
              )}

              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold transition-all bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={22} /> : <FolderPlus size={22} />}
                {folderName ? 'Andere map kiezen' : 'Map selecteren'}
              </button>
          </div>
        </div>

        <div className="p-6 bg-stone-50 border-t border-stone-100">
           <p className="text-[10px] text-slate-400 text-center uppercase font-bold tracking-widest">
              Foto's blijven veilig in je browser opgeslagen.
           </p>
        </div>
      </div>
    </div>
  );
};