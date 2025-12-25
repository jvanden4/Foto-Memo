import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Settings, FolderOpen, Cloud, CloudOff, LogIn, Loader2 } from 'lucide-react';
import { SettingsModal } from './components/SettingsModal';
import { ContentGrid } from './components/ContentGrid';
import { CategoryGrid } from './components/CategoryGrid';
import { EditItemModal } from './components/EditItemModal';
import { MapItem } from './types';
import { loadFilesFromDB, updateFileMetadata, upsertFilesToDB, deleteFilesFromDB, StoredFile } from './utils/db';
import { getFileType, processFileToItem } from './utils/fileHelpers';
import { initGoogleAuth, signIn, signOut, saveToDrive, loadFromDrive } from './utils/googleDrive';

const STORAGE_KEY_NAME = 'app_cached_folder_name';
const STORAGE_KEY_CATEGORIES = 'app_custom_categories';
const STORAGE_KEY_VIEW = 'app_view_state';
const STORAGE_KEY_ACTIVE_CAT = 'app_active_category';

type ViewState = 'categories' | 'items';

const App: React.FC = () => {
  const [items, setItems] = useState<MapItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [folderName, setFolderName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY_NAME) || '';
    }
    return '';
  });

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

  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return !localStorage.getItem(STORAGE_KEY_NAME);
    }
    return false;
  });
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MapItem | null>(null);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    initGoogleAuth((status) => {
        setIsLoggedIn(status);
    });
  }, []);

  const handleSignIn = async () => {
    try {
        await signIn();
        setIsLoggedIn(true);
        const cloudData = await loadFromDrive();
        if (cloudData && window.confirm("Data gevonden op Google Drive. Herstellen?")) {
            if (cloudData.categories) setCustomCategories(cloudData.categories);
            if (cloudData.metadata) {
                for (const id of Object.keys(cloudData.metadata)) {
                    await updateFileMetadata(id, cloudData.metadata[id]);
                }
                await loadData();
            }
        }
    } catch (err) {
        console.error("Login failed", err);
    }
  };

  const handleSignOut = () => {
    signOut();
    setIsLoggedIn(false);
  };

  const triggerSync = useCallback(() => {
    if (!isLoggedIn) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    
    syncTimerRef.current = setTimeout(async () => {
        setIsSyncing(true);
        try {
            const metadata: Record<string, any> = {};
            items.forEach(item => {
                metadata[item.id] = {
                    customName: item.customName,
                    category: item.category,
                    notes: item.notes
                };
            });
            await saveToDrive({
                categories: customCategories,
                metadata: metadata,
                lastSync: new Date().toISOString()
            });
        } catch (err) {
            console.error("Sync failed", err);
        } finally {
            setIsSyncing(false);
        }
    }, 2000);
  }, [isLoggedIn, items, customCategories]);

  useEffect(() => { triggerSync(); }, [items, customCategories, triggerSync]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY_VIEW, view); }, [view]);
  useEffect(() => { sessionStorage.setItem(STORAGE_KEY_ACTIVE_CAT, activeCategory); }, [activeCategory]);

  const categories = useMemo(() => {
    const sortedCustom = [...customCategories].sort((a, b) => a.localeCompare(b));
    return ['Nog te sorteren', ...sortedCustom];
  }, [customCategories]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    categories.forEach(c => counts[c] = 0);
    items.forEach(item => {
        const cat = item.category || 'Nog te sorteren';
        if (counts[cat] !== undefined) counts[cat]++;
        else counts['Nog te sorteren']++;
    });
    return counts;
  }, [items, categories]);

  const categoryCovers = useMemo(() => {
    const covers: Record<string, string> = {};
    items.forEach(item => {
        const cat = item.category;
        if (cat && !covers[cat] && item.previewUrl && item.type === 'image') {
            covers[cat] = item.previewUrl;
        }
    });
    return covers;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (view !== 'items' || !activeCategory) return [];
    return items.filter(i => {
        const itemCat = i.category || 'Nog te sorteren';
        if (activeCategory === 'Nog te sorteren') {
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

      const discoveredCategories = new Set<string>();
      mapItems.forEach(item => {
          if (item.category && item.category !== 'Nog te sorteren' && item.category !== 'Algemeen') {
              discoveredCategories.add(item.category);
          }
      });

      setCustomCategories(prev => {
          const combined = new Set([...prev, ...discoveredCategories]);
          return Array.from(combined);
      });
    } catch (error) {
      console.error("Failed to load items from DB", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    return () => {
      setItems(prevItems => {
        prevItems.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
        return [];
      });
    };
  }, [loadData]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY_NAME, folderName); }, [folderName]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(customCategories)); }, [customCategories]);

  const handleFolderSelect = (name: string, newItems: MapItem[]) => {
    setFolderName(name);
    loadData();
    setView('categories');
    setIsSettingsOpen(false);
  };

  const handleScanTrigger = () => { scanInputRef.current?.click(); };

  const handleScanFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;
      setIsRefreshing(true);
      const previousCount = items.length;
      try {
        const dbItems: StoredFile[] = [];
        for (const file of Array.from(files)) {
            if (getFileType(file) !== 'image') continue;
            const { mapItem, buffer } = await processFileToItem(file);
            const { previewUrl: _, ...meta } = mapItem;
            dbItems.push({ id: mapItem.id, buffer, fileType: file.type, meta });
        }
        await upsertFilesToDB(dbItems);
        await loadData();
        alert("Refresh voltooid.");
      } catch (err) {
          console.error(err);
      } finally {
          setIsRefreshing(false);
          setIsSettingsOpen(false);
          if (scanInputRef.current) scanInputRef.current.value = '';
      }
  };

  const handleCreateCategory = (name: string) => {
    if (name !== 'Algemeen' && name !== 'Nog te sorteren' && !customCategories.includes(name)) {
        setCustomCategories(prev => [...prev, name]);
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    setCustomCategories(prev => prev.map(c => c === oldName ? newName : c));
    setItems(prev => prev.map(item => item.category === oldName ? { ...item, category: newName } : item));
    const itemsToUpdate = items.filter(i => i.category === oldName);
    for (const item of itemsToUpdate) await updateFileMetadata(item.id, { category: newName });
  };

  const handleDeleteCategory = async (categoryToDelete: string) => {
    setCustomCategories(prev => prev.filter(c => c !== categoryToDelete));
    setItems(prev => prev.map(item => item.category === categoryToDelete ? { ...item, category: 'Nog te sorteren' } : item));
    const itemsToUpdate = items.filter(i => i.category === categoryToDelete);
    for (const item of itemsToUpdate) await updateFileMetadata(item.id, { category: 'Nog te sorteren' });
  };

  const handleUpdateItem = async (id: string, newName: string, newCategory: string, newNotes: string) => {
     setItems(prev => prev.map(item => item.id === id ? { ...item, customName: newName, category: newCategory, notes: newNotes } : item));
     if (newCategory !== 'Nog te sorteren') handleCreateCategory(newCategory);
     await updateFileMetadata(id, { customName: newName, category: newCategory, notes: newNotes });
  };

  const handleMoveItems = async (itemIds: string[], targetCategory: string) => {
    setItems(prev => prev.map(item => itemIds.includes(item.id) ? { ...item, category: targetCategory } : item));
    for (const id of itemIds) await updateFileMetadata(id, { category: targetCategory });
  };

  const handleDeleteItems = async (itemIds: string[]): Promise<boolean> => {
    if (!window.confirm(`Verwijder ${itemIds.length} foto's?`)) return false;
    setItems(prev => prev.filter(item => !itemIds.includes(item.id)));
    await deleteFilesFromDB(itemIds);
    return true;
  };

  return (
    <div className="min-h-screen bg-[#fdfbf7] text-slate-800 flex flex-col">
      <input type="file" ref={scanInputRef} onChange={handleScanFileChange} className="hidden" multiple />

      {/* HEADER / NAV */}
      <nav className="bg-[#fdfbf7]/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setView('categories')}>
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FolderOpen className="text-white h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">Foto Memo</span>
            </div>

            <div className="flex items-center space-x-3">
              <div id="google-login-button" style={{ minWidth: '200px', minHeight: '40px', background: 'red' }}></div>
              
              {isLoggedIn ? (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${isSyncing ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'}`}>
                  {isSyncing ? <Loader2 className="animate-spin" size={12} /> : <Cloud size={12} />}
                  {isSyncing ? 'Sync' : 'Cloud'}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-slate-500 rounded-full text-[10px] font-bold uppercase">
                  <CloudOff size={12} /> Offline
                </div>
              )}

              <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-stone-200 transition-all">
                <Settings className={`h-6 w-6 ${isSettingsOpen ? 'rotate-90' : ''} transition-transform duration-500`} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isLoggedIn && (
            <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-orange-800">
                    <LogIn size={20} />
                    <p className="text-sm">Log in voor cloud backup.</p>
                </div>
                <button onClick={handleSignIn} className="bg-orange-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-md">Inloggen</button>
            </div>
        )}

        {isLoading || isRefreshing ? (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
           <>
             {view === 'categories' && (
                <div className="space-y-12">
                    <CategoryGrid categories={categories.filter(c => c !== 'Nog te sorteren')} counts={categoryCounts} categoryCovers={categoryCovers} onSelectCategory={(cat) => { setActiveCategory(cat); setView('items'); }} onCreateCategory={handleCreateCategory} onRenameCategory={handleRenameCategory} onDeleteCategory={handleDeleteCategory} onDropItem={(itemId, category) => handleMoveItems([itemId], category)} />
                    <div className="border-t border-stone-200 pt-8">
                         <h3 className="text-lg font-semibold text-slate-400 mb-4 px-1">Nog te sorteren</h3>
                         <div className="bg-black rounded-t-3xl p-4 sm:p-6 min-h-[400px]">
                            <ContentGrid items={inboxItems} isLoading={false} mapName="" categoryName="Inbox" categories={categories} onBack={() => {}} onEditItem={(item) => { setEditingItem(item); setIsEditModalOpen(true); }} onMoveItems={handleMoveItems} onDeleteItems={handleDeleteItems} isInboxMode={true} darkMode={true} />
                        </div>
                    </div>
                </div>
             )}
             {view === 'items' && (
                <ContentGrid items={filteredItems} isLoading={false} mapName={folderName || "Mijn Map"} categoryName={activeCategory} categories={categories} onBack={() => { setView('categories'); setActiveCategory(''); }} onEditItem={(item) => { setEditingItem(item); setIsEditModalOpen(true); }} onMoveItems={handleMoveItems} onDeleteItems={handleDeleteItems} />
             )}
           </>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} folderName={folderName} onFolderSelect={handleFolderSelect} onScan={handleScanTrigger} isRefreshing={isRefreshing} isLoggedIn={isLoggedIn} onSignIn={handleSignIn} onSignOut={handleSignOut} />
      <EditItemModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} item={editingItem} categories={categories.filter(c => c !== 'Nog te sorteren')} onSave={handleUpdateItem} onDelete={async (id) => { if (await handleDeleteItems([id])) setIsEditModalOpen(false); }} />
    </div>
  );
};

export default App;
