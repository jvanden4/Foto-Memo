import React, { useState, useRef, useEffect } from 'react';
import { Folder, FolderPlus, X, Check, AlertCircle, Plus, Pencil } from 'lucide-react';

interface CategoryGridProps {
  categories: string[];
  counts: Record<string, number>;
  categoryCovers?: Record<string, string>;
  onSelectCategory: (category: string) => void;
  onCreateCategory: (name: string) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onDeleteCategory?: (name: string) => void;
  onDropItem?: (itemId: string, category: string) => void;
}

const PROTECTED_CATEGORIES = ['Nog te sorteren', 'Algemeen'];

export const CategoryGrid: React.FC<CategoryGridProps> = ({ 
  categories, 
  counts, 
  categoryCovers = {},
  onSelectCategory,
  onCreateCategory,
  onRenameCategory,
  onDeleteCategory,
  onDropItem
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Renaming State
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Deleting State (Confirmation Mode)
  const [deletingCategory, setDeletingCategory] = useState<string | null>(null);

  // Drag & Drop State
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input automatically when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isCreating]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      onCreateCategory(newCategoryName.trim());
      setNewCategoryName('');
      setIsCreating(false);
    }
  };

  const startEditing = (e: React.MouseEvent, category: string) => {
    e.stopPropagation();
    if (PROTECTED_CATEGORIES.includes(category)) return;
    setEditingCategory(category);
    setRenameValue(category);
    setDeletingCategory(null);
  };

  const saveRename = (e: React.MouseEvent | React.FormEvent, oldName: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRenameCategory && renameValue.trim() && renameValue !== oldName) {
        onRenameCategory(oldName, renameValue.trim());
    }
    setEditingCategory(null);
  };

  const cancelRename = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingCategory(null);
  };

  const initiateDelete = (e: React.MouseEvent, category: string) => {
      e.stopPropagation();
      if (PROTECTED_CATEGORIES.includes(category)) return;
      setDeletingCategory(category);
      setEditingCategory(null);
  };

  const confirmDelete = (e: React.MouseEvent, category: string) => {
      e.stopPropagation();
      if (onDeleteCategory) {
          onDeleteCategory(category);
      }
      setDeletingCategory(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      setDeletingCategory(null);
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent, category: string) => {
      e.preventDefault(); // Necessary to allow dropping
      if (dragOverCategory !== category) {
          setDragOverCategory(category);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      setDragOverCategory(null);
  };

  const handleDrop = (e: React.DragEvent, category: string) => {
      e.preventDefault();
      setDragOverCategory(null);
      const itemId = e.dataTransfer.getData('text/plain');
      if (itemId && onDropItem) {
          onDropItem(itemId, category);
      }
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            Categorieën
            <span className="text-xs font-normal text-slate-500 bg-stone-200 px-2 py-1 rounded-full">
                {categories.length}
            </span>
        </h2>
      </div>
      
      {/* 2 columns on mobile, 4 on md - replicating the social media card style */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        {/* Create New Category Card */}
        <div className={`relative overflow-hidden rounded-2xl aspect-[3/4] shadow-sm transition-all duration-300
             ${isCreating 
                ? 'bg-[#262626] ring-2 ring-indigo-500' 
                : 'bg-[#262626] border border-dashed border-stone-600 hover:border-stone-400 cursor-pointer group'}`
        }>
            {isCreating ? (
               <form onSubmit={handleCreateSubmit} className="absolute inset-0 p-4 flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
                  <div className="w-20 h-20 rounded-full bg-stone-700 flex items-center justify-center mb-4 text-white">
                     <FolderPlus size={32} />
                  </div>
                  <input 
                    ref={inputRef}
                    type="text"
                    placeholder="Naam..."
                    className="w-full bg-stone-700 border border-stone-600 rounded-lg px-3 py-2 text-sm text-white mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={() => !newCategoryName && setIsCreating(false)}
                    onKeyDown={(e) => e.key === 'Escape' && setIsCreating(false)}
                  />
                  <div className="flex w-full gap-2">
                      <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded-lg font-bold">
                        Maken
                      </button>
                      <button type="button" onMouseDown={() => setIsCreating(false)} className="px-3 bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 rounded-lg">
                        <X size={14} />
                      </button>
                  </div>
               </form>
            ) : (
              <button 
                onClick={() => setIsCreating(true)}
                className="w-full h-full flex flex-col items-center justify-center text-stone-400 group-hover:text-white transition-colors p-4"
              >
                <div className="bg-stone-800 group-hover:bg-stone-700 p-4 rounded-full mb-3 transition-colors duration-300 ring-2 ring-stone-700">
                    <Plus size={32} />
                </div>
                <span className="text-sm font-semibold">Nieuwe toevoegen</span>
              </button>
            )}
        </div>

        {/* Categories as "Profile" Cards */}
        {categories.map((category) => {
            const isEditing = editingCategory === category;
            const isDeleting = deletingCategory === category;
            const isProtected = PROTECTED_CATEGORIES.includes(category);
            const isDragTarget = dragOverCategory === category;
            const coverUrl = categoryCovers[category];
            const itemCount = counts[category] || 0;

            return (
                <div
                    key={category}
                    onClick={() => !isEditing && !isDeleting && onSelectCategory(category)}
                    onDragOver={(e) => !isEditing && !isDeleting && handleDragOver(e, category)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => !isEditing && !isDeleting && handleDrop(e, category)}
                    className={`relative rounded-2xl flex flex-col items-center p-4 transition-all duration-300 aspect-[3/4] cursor-pointer
                        ${isDeleting 
                            ? 'bg-red-900/20 border border-red-500/50' 
                            : isDragTarget
                                ? 'bg-indigo-900/30 ring-2 ring-indigo-500 scale-105 z-10'
                                : 'bg-[#262626] border border-stone-800 hover:border-stone-600 hover:bg-[#2d2d2d]'
                        }
                    `}
                >
                    {/* Top Right Actions (X to delete) */}
                    {!isProtected && !isEditing && !isDeleting && (
                        <button 
                            onClick={(e) => initiateDelete(e, category)}
                            className="absolute top-2 right-2 text-stone-500 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    )}

                    {/* Circular Image / Avatar */}
                    <div className="mt-2 mb-3 relative group/avatar">
                        <div className={`w-24 h-24 rounded-full overflow-hidden ring-4 transition-all duration-300
                            ${isDragTarget ? 'ring-indigo-500 scale-110' : 'ring-[#121212]'}
                        `}>
                            {coverUrl ? (
                                <img src={coverUrl} alt={category} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-stone-700 flex items-center justify-center text-stone-400">
                                    <Folder size={40} />
                                </div>
                            )}
                        </div>
                        {/* Edit Pencil Overlay on Avatar Hover */}
                         {!isProtected && !isEditing && !isDeleting && (
                            <div 
                                onClick={(e) => startEditing(e, category)}
                                className="absolute bottom-0 right-0 bg-stone-800 text-white p-1.5 rounded-full border border-stone-600 shadow-lg cursor-pointer hover:bg-indigo-600 hover:border-indigo-500 transition-colors"
                            >
                                <Pencil size={12} strokeWidth={3} />
                            </div>
                         )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col items-center w-full text-center">
                        {isEditing ? (
                            <form 
                                onSubmit={(e) => saveRename(e, category)}
                                onClick={(e) => e.stopPropagation()} 
                                className="w-full flex flex-col items-center gap-2"
                            >
                                <input
                                    type="text"
                                    autoFocus
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    onKeyDown={(e) => e.key === 'Escape' && setEditingCategory(null)}
                                />
                                <div className="flex gap-2 w-full justify-center">
                                    <button type="submit" className="text-green-400 hover:text-green-300 bg-green-400/10 p-1 rounded"><Check size={16} /></button>
                                    <button type="button" onClick={cancelRename} className="text-red-400 hover:text-red-300 bg-red-400/10 p-1 rounded"><X size={16} /></button>
                                </div>
                            </form>
                        ) : isDeleting ? (
                            <div className="w-full flex flex-col items-center animate-in fade-in zoom-in">
                                <span className="text-white text-sm font-semibold mb-2">Verwijderen?</span>
                                <div className="flex gap-2 w-full">
                                    <button onClick={(e) => confirmDelete(e, category)} className="flex-1 bg-red-600 hover:bg-red-500 text-white text-xs py-2 rounded-lg font-medium">
                                        Ja
                                    </button>
                                    <button onClick={cancelDelete} className="flex-1 bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 rounded-lg font-medium">
                                        Nee
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="text-stone-400 text-xs mb-4">
                                    {itemCount} items
                                </p>
                                
                                <button 
                                    className="mt-auto w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold py-2 rounded-lg text-sm transition-colors shadow-lg shadow-blue-900/20 active:scale-95 truncate px-2"
                                    title={category}
                                >
                                    {category}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};