import React, { useRef, useState } from 'react';
import { X, FolderPlus, Loader2 } from 'lucide-react';
import { MapItem } from '../types';
import { upsertFilesToDB, StoredFile } from '../utils/db';
import { getFileType, processFileToItem } from '../utils/fileHelpers';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  onFolderSelect: (name: string, items: MapItem[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  folderName,
  onFolderSelect,
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

        // Process files in chunks to avoid blocking UI too much
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

        // Upsert logic to preserve existing categories
        await upsertFilesToDB(dbItems);

        onFolderSelect(detectedFolderName, newItems);
        onClose();
    } catch (err) {
        console.error("Failed to process files", err);
        alert("Er is een fout opgetreden bij het verwerken van de afbeeldingen.");
    } finally {
        setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <h2 className="text-xl font-semibold text-slate-800">Map Selecteren</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 rounded-full hover:bg-stone-100"
            disabled={isProcessing}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center text-center">
            
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-6 text-indigo-500">
            {isProcessing ? <Loader2 className="animate-spin" size={32} /> : <FolderPlus size={32} />}
          </div>

          <h3 className="text-lg font-medium text-slate-800 mb-2">
            {isProcessing ? "Afbeeldingen verwerken..." : "Kies een lokale map"}
          </h3>
          <p className="text-sm text-slate-500 mb-8">
            {isProcessing 
                ? "Een ogenblik geduld, de afbeeldingen worden gecontroleerd en bijgewerkt."
                : "Selecteer een map. Nieuwe foto's komen in 'Nog te sorteren', bestaande indeling blijft bewaard."}
          </p>

          <input
            type="file"
            ref={inputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            {...({ webkitdirectory: "", directory: "" } as any)}
          />

          <button
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing}
            className={`w-full flex items-center justify-center px-6 py-3 rounded-xl font-medium transition-all shadow-lg 
                ${isProcessing 
                    ? 'bg-slate-100 cursor-not-allowed text-slate-400' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20 active:scale-95'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin mr-2" size={20} /> : <FolderPlus className="mr-2" size={20} />}
            Map Selecteren
          </button>
        </div>

        <div className="p-6 border-t border-stone-100 bg-stone-50 rounded-b-2xl">
          <p className="text-xs text-slate-500 text-center">
             Selecteer een map. De foto's worden veilig opgeslagen in je browser.
          </p>
        </div>
      </div>
    </div>
  );
};