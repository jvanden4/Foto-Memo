import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Folder } from 'lucide-react';
import { MapItem } from '../types';

interface ImageViewerProps {
  images: MapItem[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
  categories?: string[];
  onDelete?: (id: string) => void;
  onMove?: (id: string, targetCategory: string) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  images: propImages,
  initialIndex,
  isOpen,
  onClose,
  categories = [],
  onDelete,
  onMove
}) => {
  const [localImages, setLocalImages] = useState<MapItem[]>(propImages);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showLabel, setShowLabel] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const lastTouchTime = useRef<number>(0);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggered = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setLocalImages(propImages);
      setCurrentIndex(initialIndex);
      setShowLabel(false);
      setShowActionMenu(false);
    }
  }, [isOpen, propImages, initialIndex]);

  useEffect(() => {
    setShowLabel(false);
    setShowActionMenu(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showActionMenu) {
          if (e.key === 'Escape') setShowActionMenu(false);
          return;
      }
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowUp') handleMoveToBack();
      if (e.key === ' ' || e.key === 'Enter') setShowLabel(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, showActionMenu, localImages]);

  const handleNext = useCallback(() => {
    if (currentIndex < localImages.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, localImages.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const handleMoveToBack = useCallback(() => {
      if (localImages.length <= 1) return;
      setLocalImages(prev => {
          const newImages = [...prev];
          const [movedItem] = newImages.splice(currentIndex, 1);
          newImages.push(movedItem);
          return newImages;
      });
      if (currentIndex >= localImages.length - 1) {
          setCurrentIndex(0); 
      }
      setShowLabel(false);
  }, [currentIndex, localImages]);

  const handleActionMove = (cat: string) => {
      if (onMove && localImages[currentIndex]) {
          onMove(localImages[currentIndex].id, cat);
      }
      setShowActionMenu(false);
  };

  const handleActionDelete = () => {
      if (onDelete && localImages[currentIndex]) {
          onDelete(localImages[currentIndex].id);
      }
      setShowActionMenu(false);
  };

  const handleTap = () => {
    if (showActionMenu) {
        setShowActionMenu(false);
        return;
    }
    setShowLabel(prev => !prev);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (showActionMenu) return;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
    isLongPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
        isLongPressTriggered.current = true;
        setShowActionMenu(true);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }
    }, 800);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }
    if (showActionMenu || isLongPressTriggered.current) return;
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX.current - touchEndX;
    const diffY = touchStartY.current - touchEndY;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);

    touchStartX.current = null;
    touchStartY.current = null;

    if (diffY > 50 && absDiffY > absDiffX) {
        handleMoveToBack();
    } else if (absDiffX > 50 && absDiffX > absDiffY) {
      if (diffX > 0) handleNext(); else handlePrev();
    } else if (absDiffX < 10 && absDiffY < 10) {
      lastTouchTime.current = Date.now();
      handleTap();
    }
  };

  const onTouchMove = () => {
      if (longPressTimer.current) {
         clearTimeout(longPressTimer.current);
         longPressTimer.current = null;
      }
  };

  const onClick = (e: React.MouseEvent) => {
    if (Date.now() - lastTouchTime.current < 500) return;
    if (showActionMenu) return; 
    if ((e.target as HTMLElement).closest('button')) return;
    handleTap();
  };

  if (!isOpen) return null;
  const currentImage = localImages[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center touch-manipulation select-none overflow-hidden">
      {/* Close Button */}
      {!showActionMenu && (
        <button 
            onClick={onClose}
            className="absolute top-6 right-6 text-white/70 hover:text-white z-50 p-2 rounded-full bg-black/40 backdrop-blur-md transition-all active:scale-90"
        >
            <X size={32} />
        </button>
      )}

      {/* Main Content Area */}
      <div 
        className="w-full h-full flex items-center justify-center p-0 relative cursor-pointer outline-none"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onClick={onClick}
      >
        {currentImage && (
            <div className="relative flex items-center justify-center w-full h-full pointer-events-none">
                <img
                    src={currentImage.previewUrl}
                    alt={currentImage.title}
                    className={`max-h-full max-w-full object-contain pointer-events-auto transition-all duration-300
                        ${showActionMenu ? 'scale-90 opacity-40 blur-md' : 'scale-100'}
                    `}
                    draggable={false}
                />
                
                {/* Overlay Text */}
                {showLabel && !showActionMenu && (
                    <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in-95 duration-200 z-10 p-6">
                        <div className="bg-black/80 text-white px-8 py-8 rounded-[40px] backdrop-blur-xl max-w-full w-full max-h-[80vh] overflow-y-auto text-center shadow-2xl border border-white/10 flex flex-col items-center">
                            <h2 className="text-3xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
                                {currentImage.customName || currentImage.title}
                            </h2>
                            {currentImage.notes && (
                                <div className="text-lg md:text-xl text-stone-300 whitespace-pre-wrap font-medium leading-relaxed mt-4 border-t border-white/20 pt-6 w-full italic">
                                    "{currentImage.notes}"
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
      
      {/* Action Menu (Long Press) */}
      {showActionMenu && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
             <div className="bg-stone-900 border border-stone-700 rounded-[32px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col pointer-events-auto max-h-[85vh]">
                 <div className="p-8 text-center border-b border-stone-800 shrink-0">
                     <h3 className="text-white text-2xl font-black mb-1">Opties</h3>
                     <p className="text-stone-400 text-base">Bewerk of verplaats deze foto</p>
                 </div>
                 
                 <div className="p-4 flex flex-col flex-1 min-h-0">
                     <div className="flex flex-col flex-1 min-h-0 mb-4">
                        <label className="text-xs font-black text-stone-500 uppercase mb-3 ml-2 tracking-widest">Verplaatsen naar...</label>
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={(e) => { e.stopPropagation(); handleActionMove(cat); }}
                                    className="flex items-center gap-4 w-full p-5 bg-stone-800 hover:bg-indigo-900/40 text-stone-200 hover:text-white rounded-2xl transition-all text-left text-lg border border-stone-700 hover:border-indigo-500/50 active:scale-[0.98]"
                                >
                                    <Folder size={24} className="text-indigo-400 shrink-0" />
                                    <span className="truncate font-bold">{cat}</span>
                                </button>
                            ))}
                        </div>
                     </div>

                     {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleActionDelete(); }}
                            className="w-full flex items-center justify-center gap-3 p-5 bg-red-900/20 hover:bg-red-900/40 text-red-400 hover:text-red-200 rounded-2xl transition-all font-black text-lg border border-red-900/30 shrink-0 active:scale-[0.98]"
                        >
                            <Trash2 size={24} />
                            Verwijderen
                        </button>
                     )}
                 </div>

                 <div className="p-4 bg-black/30 shrink-0">
                     <button 
                        onClick={(e) => { e.stopPropagation(); setShowActionMenu(false); }}
                        className="w-full py-4 text-stone-500 hover:text-white font-bold text-lg transition-colors"
                     >
                         Annuleren
                     </button>
                 </div>
             </div>
          </div>
      )}

      {/* Minimal Counter */}
      {!showActionMenu && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/40 text-xs font-bold tracking-widest bg-white/5 px-4 py-1.5 rounded-full backdrop-blur-md pointer-events-none uppercase">
            {currentIndex + 1} / {localImages.length}
        </div>
      )}
    </div>
  );
};