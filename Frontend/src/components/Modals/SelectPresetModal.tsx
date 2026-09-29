import React, { useState, useEffect } from 'react';
import { Search, Hexagon, X, Edit3, Plus, ArrowRight } from 'lucide-react';
import CreateRecipeModal from './CreateRecipeModal.tsx';
import type { CreatedRecipe } from '../../services/recipeStore';
import {
  getCachedRecipes,
  subscribeToRecipes,
  syncRecipesWithBackend,
  saveRecipeToStore,
  deleteRecipeFromStore,
  prewarmRecipeImage,
} from '../../services/recipeStore';

interface SelectPresetModalProps {
  onClose: () => void;
  onSelect: (preset: CreatedRecipe) => void;
  activeRecipeId?: string;
}

const SelectPresetModal: React.FC<SelectPresetModalProps> = ({ onClose, onSelect, activeRecipeId }) => {
  // Synchronous initial load with ZERO delay (0ms) - all default & created recipes load right away
  const [recipeList, setRecipeList] = useState<CreatedRecipe[]>(() => getCachedRecipes());
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(() => {
    if (activeRecipeId) return activeRecipeId;
    const initialList = getCachedRecipes();
    return initialList.length > 0 ? initialList[0].id : 'recipe1';
  });
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<CreatedRecipe | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 1. Subscribe to any real-time store updates
    const unsubscribe = subscribeToRecipes((updatedList) => {
      setRecipeList(updatedList);
    });

    // 2. Quietly synchronize with backend in background without any blocking or loading spinners
    syncRecipesWithBackend();

    return unsubscribe;
  }, []);

  // Preload selected preset image when selection changes
  useEffect(() => {
    const selected = recipeList.find(p => p.id === selectedPresetId);
    if (selected?.image) {
      prewarmRecipeImage(selected.image);
    }
    if (selected?.rawImage) {
      prewarmRecipeImage(selected.rawImage);
    }
  }, [selectedPresetId, recipeList]);

  const filteredPresets = recipeList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.targetCode && p.targetCode.includes(searchQuery))
  );

  const selectedPreset = recipeList.find(p => p.id === selectedPresetId) || (filteredPresets.length > 0 ? filteredPresets[0] : undefined);

  const handleRecipeSaved = (savedRecipe: CreatedRecipe) => {
    saveRecipeToStore(savedRecipe);
    const updated = getCachedRecipes();
    setRecipeList(updated);
    setSelectedPresetId(savedRecipe.id);
    setIsCreatingRecipe(false);
    setEditingRecipe(null);
    syncRecipesWithBackend(true);
  };

  const handleRecipeDeleted = (deletedId: string) => {
    deleteRecipeFromStore(deletedId);
    const updated = getCachedRecipes();
    setRecipeList(updated);
    if (selectedPresetId === deletedId) {
      setSelectedPresetId(updated.length > 0 ? updated[0].id : null);
    }
    setIsCreatingRecipe(false);
    setEditingRecipe(null);
    syncRecipesWithBackend(true);
  };

  const handleOpenEdit = (preset: CreatedRecipe, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingRecipe(preset);
    setSelectedPresetId(preset.id);
    setIsCreatingRecipe(true);
  };

  const handleOpenCreate = () => {
    setEditingRecipe(null);
    setIsCreatingRecipe(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
        <div className="bg-white w-[920px] h-[610px] rounded-lg shadow-2xl flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-[#123681] text-white font-bold py-3 px-6 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Hexagon size={18} className="text-blue-300" />
              <h2>Recipe Management & Presets (SKU)</h2>
            </div>
            <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition-colors cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">

            {/* Left Column - List */}
            <div className="w-[55%] border-r border-gray-200 p-4 flex flex-col h-full bg-[#f8f9fa]">

              <button
                onClick={handleOpenCreate}
                className="bg-[#123681] hover:bg-blue-900 text-white font-bold py-2.5 px-4 rounded-md shadow-sm mb-4 transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Plus size={16} />
                <span>Create New Recipe Program</span>
              </button>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search presets by name or barcode..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-[#123681] bg-white"
                />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-2">
                {filteredPresets.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPresetId(preset.id)}
                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${
                      selectedPresetId === preset.id
                        ? 'bg-blue-50/80 border-blue-300 shadow-[inset_0_0_0_2px_#123681]'
                        : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Hexagon size={22} className={selectedPresetId === preset.id ? 'text-[#123681] shrink-0' : 'text-gray-400 shrink-0'} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-baseline gap-1.5 truncate">
                          <span className="font-bold text-gray-800 text-sm truncate">{preset.name}</span>
                          <span className="text-[10px] text-gray-400 shrink-0">({preset.type})</span>
                        </div>
                        {preset.targetCode && (
                          <span className="text-[11px] text-blue-700 font-mono font-semibold truncate">
                            Code: {preset.targetCode}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dedicated Update / Edit Button for Each Recipe */}
                    <div className="flex items-center gap-1.5 ml-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(preset, e)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-[#123681] bg-blue-50 hover:bg-blue-100 hover:text-blue-900 border border-blue-200 rounded transition-colors cursor-pointer shadow-xs active:scale-95"
                        title={`Update / Edit ${preset.name}`}
                      >
                        <Edit3 size={12} />
                        <span>Update</span>
                      </button>
                    </div>
                  </div>
                ))}

                {filteredPresets.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    No recipes found matching "{searchQuery}"
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Details Preview & Actions */}
            <div className="flex-1 p-6 flex flex-col h-full bg-white relative">
              <div className="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                <h3 className="text-sm font-bold text-gray-700">Recipe Image Preview</h3>
                {selectedPreset && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedPreset)}
                    className="flex items-center gap-1 text-xs font-bold text-[#123681] hover:underline cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>Edit Selected</span>
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 flex items-center justify-center bg-gray-900 border border-gray-200 rounded-md mb-4 overflow-hidden p-2 shadow-inner">
                {selectedPreset ? (
                  <img
                    src={selectedPreset.image}
                    alt={selectedPreset.name}
                    className="max-w-full max-h-full object-contain rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-sm text-gray-400">Select a preset to view details</span>
                )}
              </div>

              <h3 className="text-sm font-bold text-gray-700 mb-2 border-b border-gray-200 pb-1">Preset Parameters</h3>

              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs mb-4 flex flex-col gap-1.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-sans font-semibold">Program Name:</span>
                  <span className="text-gray-900 font-bold">{selectedPreset ? selectedPreset.name : 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-sans font-semibold">Target Barcode:</span>
                  <span className="text-blue-700 font-bold">{selectedPreset?.targetCode || 'Not configured'}</span>
                </div>
              </div>

              {/* Action Buttons: Update Preset & Load Preset */}
              <div className="flex gap-2">
                {selectedPreset && (
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(selectedPreset)}
                    className="flex-1 py-2.5 rounded-md font-bold text-xs bg-slate-100 hover:bg-slate-200 border border-gray-300 text-gray-700 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Change name, image, or barcode for this recipe"
                  >
                    <Edit3 size={14} className="text-[#123681]" />
                    <span>Update Recipe</span>
                  </button>
                )}

                <button
                  onClick={() => selectedPreset && onSelect(selectedPreset)}
                  disabled={!selectedPreset}
                  className={`py-2.5 rounded-md font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5 ${
                    selectedPreset
                      ? 'flex-[1.5] bg-[#123681] hover:bg-blue-900 text-white cursor-pointer active:scale-98'
                      : 'w-full bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <ArrowRight size={14} />
                  <span>Load Preset into Line</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Create / Edit Recipe Modal Overlay */}
      {isCreatingRecipe && (
        <CreateRecipeModal
          onClose={() => {
            setIsCreatingRecipe(false);
            setEditingRecipe(null);
          }}
          onSave={handleRecipeSaved}
          onDelete={handleRecipeDeleted}
          existingPresets={recipeList}
          editRecipe={editingRecipe}
        />
      )}
    </>
  );
};

export default SelectPresetModal;
