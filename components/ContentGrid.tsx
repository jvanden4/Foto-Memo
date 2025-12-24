import React, { useState, useRef } from 'react';
import { MapItem } from '../types';
import { Image as ImageIcon, ImageOff, ArrowLeft, Pencil, CheckSquare, Square, FolderInput, X, Trash2 } from 'lucide-react';
import { ImageViewer } from './ImageViewer';

interface ContentGridProps {
  items: MapItem[];
  isLoading: boolean;
  mapName: string;
  categoryName: string;
  categories: string[];
  onBack: () => void;
  onEditItem: (item: MapItem) => void;
  onMoveItems: (itemIds: string[], targetCategory: string) => void;
  onDeleteItems?: (itemIds: string[]) => void;
  isInboxMode?: boolean;
  darkMode?: boolean;
}

export const ContentGrid: React.FC<ContentGridProps> = ({ 
  items, 
  isLoading, 
  mapName, 
  categoryName,
  categories,
  onBack,
  onEditItem,
  onMoveItems,
  onDeleteItems,
  isInboxMode,
  darkMode = false
}) => {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMoveMenuOpen, setIsMoveMenuOpen] = useState(false);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const images = items.filter(item => item.type === 'image');

  const handleImageClick = (index: number, id: string, e: React.MouseEvent) => {
    if (isLongPressRef.current) {
        isLongPressRef.current = false;
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    if (isSelectionMode) {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
        setSelectedIds(newSelected);
    } else {
        setSelectedIndex(index);
        setViewerOpen(true);
    }
  };

  const handleEditClick = (e: React.MouseEvent, item: MapItem) => {
    e.stopPropagation();
    onEditItem(item);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteItems) onDeleteItems([id]);
  };

  const toggleSelectionMode = () => {
      if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedIds(new Set());
          setIsMoveMenuOpen(false);
      } else {
          setIsSelectionMode(true);
      }
  };

  const handleMoveToCategory = (targetCategory: string) => {
      onMoveItems(Array.from(selectedIds), targetCategory);
      setIsSelectionMode(false);
      setSelectedIds(new Set());
      setIsMoveMenuOpen(false);
  };

  const handleBulkDelete = () => {
      if (onDeleteItems) {
          onDeleteItems(Array.from(selectedIds));
          setIsSelectionMode(false);
          setSelectedIds(new Set());
      }
  };

  const handleTouchStart = (item: MapItem) => {
    if (isSelectionMode) return;
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onEditItem(item);
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
    }, 800);
  };

  const handleTouchEnd = () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); };
  const handleTouchMove = () => { if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current); };

  const handleViewerDelete = (id: string) => {
      if (onDeleteItems) {
          onDeleteItems([id]);
          setViewerOpen(false);
      }
  };

  const handleViewerMove = (id: string, targetCategory: string) => {
      onMoveItems([id], targetCategory);
      setViewerOpen(false);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 animate-pulse">
        {[...Array(24)].map((_, i) => (
          <div key={i} className="bg-slate-200 rounded-lg aspect-square"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full relative pb-32">
        <div className="flex items-center mb-6 justify-between">
            <div className="flex items-center">
                {!isInboxMode && (
                  <button 
                      onClick={onBack}
                      className="mr-4 p-2 rounded-full bg-white border border-stone-200 hover:bg-stone-100 text-slate-500 hover:text-slate-800 transition-colors"
                  >
                      <ArrowLeft size={20} />
                  </button>
                )}
                <div>
                    {!isInboxMode && <h2 className="text-xl font-bold text-slate-800">{categoryName}</h2>}
                    {!isInboxMode && <p className="text-sm text-slate-500">{mapName}</p>}
                </div>
            </div>
            
            <div className="flex items-center space-x-2">
                <button
                    onClick={toggleSelectionMode}
                    className={`flex items-center px-4 py-2 rounded-lg transition-colors font-medium border
                        ${isSelectionMode 
                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-500' 
                            : 'bg-white text-slate-600 border-stone-200 hover:bg-stone-50'}`}
                >
                    {isSelectionMode ? <X size={18} className="mr-2"/> : <CheckSquare size={18} className="mr-2"/>}
                    {isSelectionMode ? 'Annuleren' : 'Selecteren'}
                </button>
            </div>
        </div>
        
        {images.length === 0 ? (
           <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed
             ${darkMode ? 'bg-white/5 border-white/20 text-white/40' : 'bg-white/50 border-stone-300 text-slate-400'}`}>
             <ImageIcon size={48} className="mb-4 opacity-50" />
             <p>Geen afbeeldingen.</p>
           </div>
        ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {images.map((item, index) => {
                const isSelected = selectedIds.has(item.id);
                return (
                    <div 
                    key={item.id}
                    onTouchStart={() => handleTouchStart(item)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`group relative rounded-xl overflow-hidden aspect-[3/4] shadow-sm transition-all cursor-pointer select-none
                        ${isSelected ? 'ring-2 ring-indigo-500 transform scale-95 shadow-md' : 'border border-stone-200 hover:border-indigo-400 hover:shadow-lg'}
                        ${darkMode ? 'bg-stone-900 border-stone-800 hover:border-indigo-500' : 'bg-white'}
                    `}
                    onClick={(e) => handleImageClick(index, item.id, e)}
                    >
                        <div className={`h-3/4 w-full overflow-hidden relative ${darkMode ? 'bg-stone-800' : 'bg-stone-100'}`}>
                            {item.previewUrl ? (
                                <img 
                                src={item.previewUrl} 
                                alt={item.title}
                                className={`w-full h-full object-cover transition-transform duration-500 
                                    ${!isSelectionMode && 'group-hover:scale-110'}
                                    ${isSelected && 'opacity-75'}
                                `}
                                loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageOff size={24} /></div>
                            )}
                            {isSelectionMode && (
                                <div className="absolute top-2 left-2 z-10">
                                    <div className={`rounded-md p-1 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-black/50 text-white/50'}`}>
                                        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={`h-1/4 p-3 flex flex-col justify-center border-t relative ${darkMode ? 'bg-black border-stone-800' : 'bg-white border-stone-100'}`}>
                            <h3 className={`text-sm font-medium truncate pr-16 ${darkMode ? 'text-white' : 'text-slate-800'}`} title={item.customName || item.title}>{item.customName || item.title}</h3>
                            <p className={`text-xs mt-1 truncate ${darkMode ? 'text-stone-400' : 'text-slate-500'}`}>{item.size}</p>
                            {!isSelectionMode && (
                                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {onDeleteItems && (
                                        <button onClick={(e) => handleDeleteClick(e, item.id)} className="p-1.5 text-slate-400 hover:text-white bg-stone-100/10 hover:bg-red-600 rounded-full transition-colors"><Trash2 size={12} /></button>
                                    )}
                                    <button onClick={(e) => handleEditClick(e, item)} className="p-1.5 text-slate-400 hover:text-white bg-stone-100/10 hover:bg-indigo-600 rounded-full transition-colors"><Pencil size={12} /></button>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
            </div>
        )}

        {isSelectionMode && selectedIds.size > 0 && (
            <div className="fixed bottom-6 left-0 right-0 px-4 flex justify-center z-30">
                <div className="bg-white border border-stone-200 shadow-2xl rounded-2xl flex items-center p-3 sm:p-4 animate-in slide-in-from-bottom-5 text-slate-800">
                    <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-lg font-bold mr-4 shadow-sm">{selectedIds.size}</div>
                    <div className="h-10 w-[1px] bg-stone-200 mr-4 hidden sm:block"></div>
                    <div className="relative flex items-center gap-3">
                        <button onClick={() => setIsMoveMenuOpen(!isMoveMenuOpen)} className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl transition-colors font-medium text-base shadow-sm"><FolderInput size={22} /><span>Verplaatsen</span></button>
                         {onDeleteItems && (
                            <button onClick={handleBulkDelete} className="flex items-center space-x-2 bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-xl transition-colors font-medium border border-red-200 text-base shadow-sm"><Trash2 size={22} /><span>Verwijderen</span></button>
                        )}
                        {isMoveMenuOpen && (
                            <div className="absolute bottom-full mb-4 left-0 w-80 bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden py-1 z-50">
                                <div className="px-5 py-4 text-base font-bold text-slate-600 border-b border-stone-100 mb-1 bg-stone-50">Kies een map...</div>
                                <div className="max-h-[60vh] overflow-y-auto">
                                    {categories.map(cat => (
                                        <button key={cat} onClick={() => handleMoveToCategory(cat)} disabled={cat === categoryName} className={`w-full text-left px-6 py-4 text-lg border-b border-stone-50 flex items-center ${cat === categoryName ? 'text-slate-400 cursor-default bg-stone-50' : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-600'}`}><span className="truncate">{cat}</span></button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <ImageViewer 
          isOpen={viewerOpen}
          initialIndex={selectedIndex}
          images={images}
          categories={categories}
          onClose={() => setViewerOpen(false)}
          onDelete={onDeleteItems ? handleViewerDelete : undefined}
          onMove={handleViewerMove}
        />
    </div>
  );
};