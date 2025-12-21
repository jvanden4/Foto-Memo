import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, FolderOpen, RefreshCw } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ContentGrid } from './components/ContentGrid';
import { CategoryGrid } from './components/CategoryGrid';
import { EditItemModal } from './components/EditItemModal';
import { StartupModal } from './components/StartupModal';
import { MapItem } from './types';
import { loadFilesFromDB, updateFileMetadata, upsertFilesToDB, deleteFilesFromDB, StoredFile } from './utils/db';
import { getFileType, processFileToItem } from './utils/fileHelpers';

const STORAGE_KEY_NAME = 'app_cached_folder_name';
const STORAGE_KEY_CATEGORIES = 'app_custom_categories';
const STORAGE_KEY_VIEW = 'app_view_state';
const STORAGE_KEY_ACTIVE_CAT = 'app_active_category';
const SESSION_KEY_STARTUP_SHOWN = 'app_startup_shown';

type ViewState = 'categories' | 'items';

const App: React.FC = () => {
  const [items, setItems] = useState<MapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [folderName, setFolderName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_NAME) || '';
    }
    return '';
  });

  // Startup Modal State
  const [isStartupModalOpen, setIsStartupModalOpen] = useState(false);
  const [hasCheckedStartup, setHasCheckedStartup] = useState(false);

  // Navigation State - Initialize from Session Storage to maintain state across reloads
  const [view, setView] = useState<ViewState>(() => {
    if (typeof window !== 'undefined') {
        const saved = sessionStorage.getItem(STORAGE_KEY_VIEW);
        return (saved as ViewState) || 'categories';
    }
    return 'categories';
  });

  const [activeCategory, setActiveCategory] = useState<string>(() => {
    if (typeof window !== 'undefined') {
        return sessionStorage.getItem(STORAGE_KEY_ACTIVE_CAT) || '';
    }
    return '';
  });
  
  // Custom Category Management
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_CATEGORIES);
        if (saved) {
            let cats = JSON.parse(saved) as string[];
            return cats.filter(c => c !== 'Algemeen' && c !== 'Nog te sorteren');
        }
    }
    return [];
  });

  // Automatically open settings if no folder name is present
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem(STORAGE_KEY_NAME);
    }
    return false;
  });
  
  // Edit State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MapItem | null>(null);

  // Hidden Input Ref for Refresh/Scan
  const refreshInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence Effects ---
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_VIEW, view);
  }, [view]);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_ACTIVE_CAT, activeCategory);
  }, [activeCategory]);

  // --- LOGIC: Define Categories and Sort Items ---

  const categories = useMemo(() => {
    const sortedCustom = [...customCategories].sort((a, b) => a.localeCompare(b));
    return ['Nog te sorteren', ...sortedCustom];
  }, [customCategories]);

  const getEffectiveCategory = useCallback((item: MapItem) => {
    const cat = item.category;
    if (!cat || cat === 'Algemeen' || cat === 'Nog te sorteren') return 'Nog te sorteren';
    if (customCategories.includes(cat)) return cat;
    
    // Safety check: if item has a category that isn't in our list (e.g. after a code reset),
    // treat it as 'Nog te sorteren' temporarily, but the self-healing logic in loadData will fix this.
    return 'Nog te sorteren';
  }, [customCategories]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    // Initialize all known categories with 0
    categories.forEach(c => counts[c] = 0);
    
    items.forEach(item => {
        // Use direct category from item to ensure even "lost" categories are counted if logic allows
        const cat = item.category; 
        
        // Only count if it's a valid current category, otherwise it falls to inbox conceptually
        // but for counting let's trust the item's metadata if we can matches a known category
        if (cat && counts[cat] !== undefined) {
             counts[cat]++;
        } else {
             counts['Nog te sorteren']++;
        }
    });
    return counts;
  }, [items, categories]);

  // Determine cover images for categories
  const categoryCovers = useMemo(() => {
    const covers: Record<string, string> = {};
    items.forEach(item => {
        const cat = item.category; // Use raw category
        if (cat && !covers[cat] && item.previewUrl && item.type === 'image') {
            covers[cat] = item.previewUrl;
        }
    });
    return covers;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (view !== 'items' || !activeCategory) return [];
    // Here we strictly filter by what the user clicked
    // If the category was deleted but items remain, they will show in inbox or need reassignment
    return items.filter(i => {
        const itemCat = i.category || 'Nog te sorteren';
        if (activeCategory === 'Nog te sorteren') {
             // Show everything that is explicitly inbox OR has an invalid category
             return itemCat === 'Nog te sorteren' || !customCategories.includes(itemCat);
        }
        return itemCat === activeCategory;
    });
  }, [items, view, activeCategory, customCategories]);

  const inboxItems = useMemo(() => {
      return items.filter(i => {
          const cat = i.category;
          return !cat || cat === 'Nog te sorteren' || cat === 'Algemeen' || !customCategories.includes(cat);
      });
  }, [items, customCategories]);


  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const storedFiles = await loadFilesFromDB();
      const mapItems: MapItem[] = storedFiles.map(stored => {
        const blob = new Blob([stored.buffer], { type: stored.fileType });
        const previewUrl = URL.createObjectURL(blob);
        
        return {
          ...stored.meta,
          previewUrl,
          category: stored.meta.category,
          customName: stored.meta.customName || stored.meta.title
        };
      });
      setItems(mapItems);

      // --- SELF-HEALING CATEGORY LOGIC ---
      // Scan all items. If an item belongs to a category that isn't in our list, restore it.
      // This protects the user from losing categories if localStorage is cleared but DB remains.
      const discoveredCategories = new Set<string>();
      mapItems.forEach(item => {
          if (item.category && 
              item.category !== 'Nog te sorteren' && 
              item.category !== 'Algemeen') {
              discoveredCategories.add(item.category);
          }
      });

      setCustomCategories(prev => {
          const combined = new Set([...prev, ...discoveredCategories]);
          if (combined.size !== prev.length) {
              return Array.from(combined);
          }
          return prev;
      });

    } catch (error) {
      console.error("Failed to load items from DB", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    loadData().then(() => {
        const storedName = localStorage.getItem(STORAGE_KEY_NAME);
        const hasSeenStartup = sessionStorage.getItem(SESSION_KEY_STARTUP_SHOWN);
        
        // Only show startup modal if we have a folder AND haven't seen it this session
        if (storedName && !hasSeenStartup) {
            setIsStartupModalOpen(true);
        } else {
            setHasCheckedStartup(true);
        }
    });

    return () => {
      setItems(prevItems => {
        prevItems.forEach(item => {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        });
        return [];
      });
    };
  }, [loadData]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NAME, folderName);
  }, [folderName]);
  
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories));
  }, [customCategories]);

  const handleFolderSelect = (name: string, newItems: MapItem[]) => {
    setFolderName(name);
    loadData();
    setView('categories');
    setHasCheckedStartup(true);
  };

  const handleScanClick = () => {
    refreshInputRef.current?.click();
  };

  const handleScanFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      setIsRefreshing(true);
      const previousCount = items.length;

      try {
        const dbItems: StoredFile[] = [];
        const fileArray: File[] = Array.from(files);

        for (let index = 0; index < fileArray.length; index++) {
            const file = fileArray[index];
            if (getFileType(file) !== 'image') continue;

            const { mapItem, buffer } = await processFileToItem(file);
            const { previewUrl: _, ...meta } = mapItem;
            
            dbItems.push({
                id: mapItem.id,
                buffer,
                fileType: file.type,
                meta
            });
        }
        
        await upsertFilesToDB(dbItems);
        await loadData();
        
        const newCount = (await loadFilesFromDB()).length;
        const added = Math.max(0, newCount - previousCount);
        if (added > 0) {
            alert(`${added} nieuwe foto('s) toegevoegd aan 'Nog te sorteren'.`);
        } else {
            alert("Map gecontroleerd. Geen nieuwe foto's gevonden.");
        }

      } catch (err) {
          console.error("Failed to refresh files", err);
          alert("Er is een fout opgetreden bij het verversen.");
          setIsRefreshing(false);
      } finally {
          if (refreshInputRef.current) {
              refreshInputRef.current.value = '';
          }
      }
  };

  const handleCreateCategory = (name: string) => {
    if (name !== 'Algemeen' && name !== 'Nog te sorteren' && !customCategories.includes(name)) {
        setCustomCategories(prev => [...prev, name]);
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName || newName === oldName || customCategories.includes(newName)) return;

    setCustomCategories(prev => prev.map(c => c === oldName ? newName : c));
    setItems(prev => prev.map(item => 
        item.category === oldName ? { ...item, category: newName } : item
    ));

    const itemsToUpdate = items.filter(i => i.category === oldName);
    for (const item of itemsToUpdate) {
        await updateFileMetadata(item.id, { category: newName });
    }
  };

  const handleDeleteCategory = async (categoryToDelete: string) => {
    setCustomCategories(prev => prev.filter(c => c !== categoryToDelete));
    setItems(prev => prev.map(item => 
        item.category === categoryToDelete ? { ...item, category: 'Nog te sorteren' } : item
    ));

    const itemsToUpdate = items.filter(i => i.category === categoryToDelete);
    for (const item of itemsToUpdate) {
        await updateFileMetadata(item.id, { category: 'Nog te sorteren' });
    }
  };

  const handleUpdateItem = async (id: string, newName: string, newCategory: string, newNotes: string) => {
     setItems(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, customName: newName, category: newCategory, notes: newNotes };
        }
        return item;
     }));

     if (newCategory !== 'Nog te sorteren') {
        handleCreateCategory(newCategory);
     }

     await updateFileMetadata(id, { customName: newName, category: newCategory, notes: newNotes });
  };

  const handleMoveItems = async (itemIds: string[], targetCategory: string) => {
    setItems(prev => prev.map(item => {
        if (itemIds.includes(item.id)) {
            return { ...item, category: targetCategory };
        }
        return item;
    }));

    for (const id of itemIds) {
        await updateFileMetadata(id, { category: targetCategory });
    }
  };

  const handleDeleteItems = async (itemIds: string[]): Promise<boolean> => {
    if (!window.confirm(`Weet je zeker dat je ${itemIds.length} foto('s) wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`)) {
        return false;
    }

    setItems(prev => prev.filter(item => !itemIds.includes(item.id)));
    await deleteFilesFromDB(itemIds);
    return true;
  };

  const handleStartupScan = () => {
    setIsStartupModalOpen(false);
    sessionStorage.setItem(SESSION_KEY_STARTUP_SHOWN, 'true');
    setHasCheckedStartup(true);
    handleScanClick();
  };

  const handleStartupSkip = () => {
    setIsStartupModalOpen(false);
    sessionStorage.setItem(SESSION_KEY_STARTUP_SHOWN, 'true');
    setHasCheckedStartup(true);
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-slate-800 flex flex-col">
      <input
        type="file"
        ref={refreshInputRef}
        onChange={handleScanFileChange}
        className="hidden"
        multiple
        {...({ webkitdirectory: "", directory: "" } as any)}
      />

      <nav className="bg-[#fdfbf7]/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('categories')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FolderOpen className="text-white h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">
                Foto Memo
              </span>
            </div>
            
            <div className="flex items-center">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-stone-200 transition-all duration-200 flex items-center space-x-2 group"
              >
                <Settings className={`h-6 w-6 transition-transform duration-500 ${isSettingsOpen ? 'rotate-90' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
           <>
             {view === 'categories' && (
                <div className="space-y-12">
                    <CategoryGrid 
                        categories={categories.filter(c => c !== 'Nog te sorteren')}
                        counts={categoryCounts}
                        categoryCovers={categoryCovers}
                        onSelectCategory={(cat) => {
                            setActiveCategory(cat);
                            setView('items');
                        }}
                        onCreateCategory={handleCreateCategory}
                        onRenameCategory={handleRenameCategory}
                        onDeleteCategory={handleDeleteCategory}
                        onDropItem={(itemId, category) => handleMoveItems([itemId], category)}
                    />

                     <div className="animate-in fade-in slide-in-from-top-4 duration-500 border-t border-stone-200 pt-8">
                         <h3 className="text-lg font-semibold text-slate-400 mb-4 px-1">Nog te sorteren</h3>
                         <div className="bg-black rounded-t-3xl p-4 sm:p-6 min-h-[400px]">
                            <ContentGrid 
                                items={inboxItems} 
                                isLoading={false} 
                                mapName="" 
                                categoryName="Inbox"
                                categories={categories}
                                onBack={() => {}}
                                onEditItem={(item) => {
                                    setEditingItem(item);
                                    setIsEditModalOpen(true);
                                }}
                                onMoveItems={handleMoveItems}
                                onDeleteItems={handleDeleteItems}
                                isInboxMode={true}
                                onScan={handleScanClick}
                                darkMode={true}
                            />
                        </div>
                    </div>
                </div>
             )}

             {view === 'items' && (
                <ContentGrid 
                    items={filteredItems} 
                    isLoading={false} 
                    mapName={folderName || "Mijn Map"} 
                    categoryName={activeCategory}
                    categories={categories}
                    onBack={() => {
                        setView('categories');
                        setActiveCategory('');
                    }}
                    onEditItem={(item) => {
                        setEditingItem(item);
                        setIsEditModalOpen(true);
                    }}
                    onMoveItems={handleMoveItems}
                    onDeleteItems={handleDeleteItems}
                />
             )}
           </>
        )}
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        folderName={folderName}
        onFolderSelect={handleFolderSelect}
      />

      <EditItemModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        item={editingItem}
        categories={categories.filter(c => c !== 'Nog te sorteren')}
        onSave={handleUpdateItem}
        onDelete={async (id) => {
            const success = await handleDeleteItems([id]);
            if (success) setIsEditModalOpen(false);
        }}
      />

      <StartupModal 
        isOpen={isStartupModalOpen} 
        onScan={handleStartupScan} 
        onSkip={handleStartupSkip} 
      />
    </div>
  );
};

export default App;