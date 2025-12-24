import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { MapItem } from '../types';

interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MapItem | null;
  categories: string[];
  onSave: (id: string, newName: string, newCategory: string, newNotes: string) => void;
  onDelete?: (id: string) => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  isOpen,
  onClose,
  item,
  categories,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (item) {
      setName(item.customName || item.title);
      setNotes(item.notes || '');
      setCategory(item.category || 'Nog te sorteren');
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
  }, [item, isOpen]);

  // Enhanced focus handler to push input to the very top
  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target;
    // Small delay to allow the mobile keyboard to begin opening/layout shift
    setTimeout(() => {
      target.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start', // Forces the element to the top of the scrollable area
        inline: 'nearest' 
      });
    }, 150);
  };

  if (!isOpen || !item) return null;

  const handleSave = () => {
    const finalCategory = isAddingCategory ? newCategoryName.trim() : category;
    if (!name.trim()) {
      alert("Naam is verplicht");
      return;
    }
    if (isAddingCategory && !finalCategory) {
      alert("Nieuwe categorie naam is verplicht");
      return;
    }

    onSave(item.id, name, finalCategory || 'Nog te sorteren', notes);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && item) {
        onDelete(item.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-stone-200 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Sticky Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-100 sticky top-0 bg-white z-20">
          <h2 className="text-xl font-semibold text-slate-800">Details Bewerken</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        {/* Form Content - pb-80 provides massive scroll room to push bottom fields to the top */}
        <div className="p-6 space-y-6 pb-80">
          {/* Image Preview - Smaller to give more space for fields */}
          <div className="flex justify-center">
             <div className="w-24 h-24 rounded-lg overflow-hidden border border-stone-200 shadow-sm bg-stone-100">
                <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
             </div>
          </div>

          {/* Name Input - Reduced scroll-mt to 14 for tighter gap to header */}
          <div className="scroll-mt-14">
            <label className="block text-sm font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={handleInputFocus}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-lg"
              placeholder="Naam van persoon of object"
            />
          </div>

          {/* Notes Input */}
          <div className="scroll-mt-14">
            <label className="block text-sm font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Notities</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={handleInputFocus}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all min-h-[100px] resize-none text-lg"
              placeholder="Extra informatie, details, ..."
            />
          </div>

          {/* Category Selection */}
          <div className="scroll-mt-14">
            <label className="block text-sm font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Categorie</label>
            
            {!isAddingCategory ? (
              <div className="flex space-x-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg appearance-none"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsAddingCategory(true)}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 p-3 rounded-xl border border-indigo-100 transition-colors"
                  title="Nieuwe Categorie"
                >
                  <Plus size={24} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col space-y-2">
                <input
                  type="text"
                  placeholder="Nieuwe categorie naam..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onFocus={handleInputFocus}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-lg"
                  autoFocus
                />
                 <button
                  onClick={() => setIsAddingCategory(false)}
                  className="text-indigo-600 font-semibold text-sm self-end px-2"
                >
                  Annuleren
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-6 border-t border-stone-100 bg-stone-50 rounded-b-2xl flex justify-between sticky bottom-0 z-20">
          {onDelete && (
             <button
                onClick={handleDelete}
                className="flex items-center text-red-500 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-xl font-semibold transition-all"
              >
                <Trash2 size={20} className="mr-2" />
                Verwijderen
              </button>
          )}

          <button
            onClick={handleSave}
            className="flex items-center bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all ml-auto text-lg"
          >
            <Save size={20} className="mr-2" />
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
};