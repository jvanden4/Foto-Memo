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

  // --- GOOGLE AUTH LOGIC ---
  useEffect(() => {
    initGoogleAuth((status) => {
        setIsLoggedIn(status);
    });

    // Forceer het tekenen van de knop zodra het element beschikbaar is
    const interval = setInterval(() => {
      const btn = document.getElementById('google-login-button');
      if (btn && (window as any).google) {
        (window as any).google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with'
        });
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSignIn = async () => {
    try {
        await signIn();
        setIsLoggedIn(true);
        const cloudData = await loadFromDrive();
        if (cloudData && window.confirm("Cloud data gevonden. Herstellen?")) {
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
      try {
        const dbItems: StoredFile[] = [];
        for (const file of Array.from(files)) {
            if (getFileType(file) !== 'image') continue;
            const { mapItem, buffer } = await processFileToItem(file);
