import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  UploadCloud,
  Camera,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Save,
  Image as ImageIcon,
  FolderOpen,
  ArrowLeft,
  Video,
  Layers,
  Sparkles,
  Trash2,
  ScanLine,
  Loader2,
} from 'lucide-react';
import { getApiUrl } from '../../services/apiConfig';
import { updateRecipeBackend, deleteRecipeBackend } from '../../services/inspectionService';
import type { CreatedRecipe } from '../../services/recipeStore';
import {
  saveRecipeToStore,
  deleteRecipeFromStore,
  getCachedRecipes,
} from '../../services/recipeStore';

export type { CreatedRecipe };

interface CreateRecipeModalProps {
  onClose: () => void;
  onSave: (recipe: CreatedRecipe) => void;
  onDelete?: (recipeId: string) => void;
  existingPresets?: CreatedRecipe[];
  editRecipe?: CreatedRecipe | null;
}

const DEFAULT_FALLBACK_PRESETS: CreatedRecipe[] = [
  { id: 'recipe1', name: 'recipe1', type: 'Preset', image: '/images/recipes/recipe1.png', targetCode: '8901030866784' },
  { id: 'recipe2', name: 'recipe2', type: 'Preset', image: '/images/recipes/recipe2.png', targetCode: '8901088719841' },
  { id: 'recipe3', name: 'recipe3', type: 'Preset', image: '/images/recipes/recipe3.png', targetCode: '5011987214491' }
];

const CreateRecipeModal: React.FC<CreateRecipeModalProps> = ({ onClose, onSave, onDelete, existingPresets, editRecipe }) => {
  const isEditMode = Boolean(editRecipe);
  const [recipeName, setRecipeName] = useState(editRecipe?.name || '');
  const [targetCode, setTargetCode] = useState(editRecipe?.targetCode || '');
  const [selectedBasePresetId, setSelectedBasePresetId] = useState<string>('');
  const [acquisitionMode, setAcquisitionMode] = useState<'upload' | 'camera'>('upload');

  // Barcode Auto-Detection State
  const [isDetectingBarcode, setIsDetectingBarcode] = useState<boolean>(false);
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null);
  const [barcodeDetectionNote, setBarcodeDetectionNote] = useState<string | null>(null);

  // Sync / Clean up stale localStorage entries that might contain dummy barcode
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pixtron_custom_recipes');
      if (stored) {
        let list: CreatedRecipe[] = JSON.parse(stored);
        let modified = false;
        list = list.map(item => {
          if (item.id === 'coke_2') {
            modified = true;
            return { ...item, targetCode: '7501055320639' };
          }
          if (item.targetCode === '8838838838838') {
            modified = true;
            return { ...item, targetCode: '' };
          }
          return item;
        });
        if (modified) {
          localStorage.setItem('pixtron_custom_recipes', JSON.stringify(list));
        }
      }
    } catch (e) {
      console.warn('Error syncing stored recipes:', e);
    }
  }, []);

const compressAndOptimizeImage = (dataUrl: string, maxDim: number = 1600): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(maxDim / width, maxDim / height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.90));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

  const autoScanBarcodeFromImage = async (imageDataUrl: string) => {
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image')) return;
    setIsDetectingBarcode(true);
    setBarcodeDetectionNote(null);

    // 1. Try Browser Native C++ BarcodeDetector API (instant ~10-20ms if supported in Chromium/Edge)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector();
        const testImg = new Image();
        testImg.onload = async () => {
          try {
            const detected = await barcodeDetector.detect(testImg);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              const code = String(detected[0].rawValue).trim();
              if (code) {
                setTargetCode(code);
                setDetectedBarcode(code);
                setBarcodeDetectionNote(`Detected instantly: ${code}`);
                setIsDetectingBarcode(false);
              }
            }
          } catch {}
        };
        testImg.src = imageDataUrl;
      } catch {}
    }

    try {
      // 2. Optimize image payload size so transmission and backend decoding completes in < 300ms
      const optimizedUrl = await compressAndOptimizeImage(imageDataUrl, 1600);

      const res = await fetch(getApiUrl('/api/recipes/decode-barcode'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: optimizedUrl }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.barcode) {
          setTargetCode(data.barcode);
          setDetectedBarcode(data.barcode);
          setBarcodeDetectionNote(`Authentic barcode detected: ${data.barcode}`);
          return;
        }
      }
      setDetectedBarcode(null);
      setBarcodeDetectionNote('No barcode found in image. You can enter it manually.');
    } catch (err) {
      console.warn('Barcode auto-decode error:', err);
      setBarcodeDetectionNote('Unable to auto-scan barcode. You can enter it manually.');
    } finally {
      setIsDetectingBarcode(false);
    }
  };

  // Available Presets
  const availablePresets = useMemo(() => {
    if (existingPresets && existingPresets.length > 0) {
      return existingPresets;
    }
    return getCachedRecipes();
  }, [existingPresets]);

  const selectedBasePreset = availablePresets.find(p => p.id === selectedBasePresetId);

  // Image State
  const [selectedImage, setSelectedImage] = useState<string | null>(editRecipe?.image || null);
  const [imageFileName, setImageFileName] = useState<string>(editRecipe ? `${editRecipe.name}.png` : '');
  const [imageFileSize, setImageFileSize] = useState<string>(editRecipe ? 'Existing Recipe Image' : '');
  const [imageSource, setImageSource] = useState<'upload' | 'camera' | 'template' | null>(editRecipe ? 'template' : null);

  // Deletion State
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (editRecipe) {
      setRecipeName(editRecipe.name);
      setTargetCode(editRecipe.targetCode || '');
      setSelectedImage(editRecipe.image);
      setImageFileName(`${editRecipe.name}.png`);
      setImageFileSize('Existing Recipe Image');
      setImageSource('template');
    }
  }, [editRecipe]);

  // Camera State
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  // Submission State
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Enumerate video devices on mount
  const refreshDevices = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(videoInputs);
        if (videoInputs.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(videoInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.warn('Could not enumerate video devices:', err);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, []);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Bind cameraStream to video element whenever stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(e => console.warn('Video play interrupted:', e));
    }
  }, [cameraStream]);

  // When switching to camera mode or changing device, restart camera
  useEffect(() => {
    if (acquisitionMode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [acquisitionMode, selectedDeviceId]);

  const requestMediaStream = async (deviceId?: string): Promise<MediaStream> => {
    // Attempt 1: Preferred deviceId with ideal 720p
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { ideal: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });
      } catch (e1) {
        console.warn('Attempt 1 (ideal deviceId + 720p) failed, trying relaxed constraints...', e1);
      }

      // Attempt 2: Preferred deviceId without resolution constraint
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { ideal: deviceId } }
        });
      } catch (e2) {
        console.warn('Attempt 2 (relaxed deviceId) failed, trying exact deviceId...', e2);
      }

      // Attempt 3: Exact deviceId
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } }
        });
      } catch (e3) {
        console.warn('Attempt 3 (exact deviceId) failed, trying generic camera...', e3);
      }
    }

    // Attempt 4: Generic camera with ideal 720p
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } catch (e4) {
      console.warn('Attempt 4 (generic 720p) failed, trying basic video...', e4);
    }

    // Final Attempt 5: Bare minimum video constraint
    return await navigator.mediaDevices.getUserMedia({ video: true });
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await requestMediaStream(selectedDeviceId);
      setCameraStream(stream);
      setIsCameraActive(true);
      // Re-query devices once permission is active to populate real labels
      refreshDevices();
    } catch (err: any) {
      console.error('Camera access error:', err);
      let message = 'Unable to access optical camera/scanner. ';
      if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        message += 'The camera is currently locked or in use by another application (e.g., Microsoft Teams, Zoom, or Windows Camera). Please close any background apps using your camera and click "Restart Feed".';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message += 'Camera permission was denied. Please allow camera access in Windows Settings (Settings > Privacy & Security > Camera > "Let desktop apps access your camera").';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message += 'No camera device detected. Please verify your camera or scanner is plugged in and recognized by Windows.';
      } else if (err.name === 'OverconstrainedError') {
        message += `The requested resolution/framerate is not supported by this hardware (${err.constraint || 'overconstrained'}).`;
      } else {
        message += (err.message || 'Please check device permissions or use the file upload option.');
      }
      setCameraError(message);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  // Handle Base Preset Selection
  const handleSelectBasePreset = (presetId: string) => {
    setSelectedBasePresetId(presetId);
    setErrorMessage(null);

    if (!presetId) {
      // Reverted to None (start clean from scratch)
      if (imageSource === 'template') {
        setSelectedImage(null);
        setImageFileName('');
        setImageFileSize('');
        setImageSource(null);
        setDetectedBarcode(null);
        setBarcodeDetectionNote(null);
      }
      return;
    }

    const preset = availablePresets.find(p => p.id === presetId);
    if (!preset) return;

    // Inherit Target Barcode if available
    if (preset.targetCode) {
      setTargetCode(preset.targetCode);
      setDetectedBarcode(preset.targetCode);
      setBarcodeDetectionNote(`Linked barcode from preset: ${preset.targetCode}`);
    }

    // Pre-load reference image from preset if user hasn't uploaded or captured one yet
    if (preset.image && imageSource !== 'upload' && imageSource !== 'camera') {
      setSelectedImage(preset.image);
      setImageFileName(`${preset.name}_reference.png`);
      setImageFileSize('Base Template');
      setImageSource('template');
    }
  };

  // Handle Capture Snapshot from live camera
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setSelectedImage(dataUrl);
    setImageFileName(`capture_${Date.now()}.png`);
    setImageFileSize(`${Math.round((dataUrl.length * 3) / 4 / 1024)} KB`);
    setImageSource('camera');
    stopCamera();
    // Auto-detect authentic barcode immediately from camera snapshot
    autoScanBarcodeFromImage(dataUrl);
  };

  // Handle File Upload
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, JPEG).');
      return;
    }
    setErrorMessage(null);
    setImageFileName(file.name);
    setImageFileSize(`${(file.size / 1024).toFixed(1)} KB`);
    setImageSource('upload');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setSelectedImage(result);
      // Auto-detect authentic barcode immediately from uploaded image
      autoScanBarcodeFromImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Handle Save Recipe
  const handleSaveRecipe = async () => {
    setErrorMessage(null);
    const cleanName = recipeName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

    if (!cleanName) {
      setErrorMessage('Please provide a valid recipe / program name.');
      return;
    }

    if (!selectedImage) {
      setErrorMessage('Please select a base preset template, upload a product image, or capture with the camera.');
      return;
    }

    setIsSaving(true);

    try {
      if (isEditMode && editRecipe) {
        // UPDATE EXISTING RECIPE
        const updatePayload: {
          recipeName: string;
          targetCode?: string;
          imageData?: string;
        } = {
          recipeName: cleanName,
          targetCode: targetCode.trim() || undefined,
        };

        if (selectedImage && selectedImage.startsWith('data:image')) {
          updatePayload.imageData = selectedImage;
        }

        const updateRes = await updateRecipeBackend(editRecipe.id, updatePayload);
        const updatedRecipe: CreatedRecipe = {
          id: editRecipe.id,
          name: cleanName,
          type: editRecipe.type || 'Preset',
          image: updateRes.recipe?.image || selectedImage,
          rawImage: updateRes.recipe?.rawImage || selectedImage,
          processedImage: updateRes.recipe?.processedImage,
          targetCode: updateRes.recipe?.targetCode || targetCode.trim() || undefined,
        };

        saveRecipeToStore(updatedRecipe);

        setSuccessMessage(`Recipe "${cleanName}" updated successfully!`);
        setTimeout(() => {
          onSave(updatedRecipe);
        }, 800);
      } else {
        // CREATE NEW RECIPE
        let finalImagePath = selectedImage;
        let finalTargetCode = targetCode.trim();

        try {
          const response = await fetch(getApiUrl('/api/save-recipe'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipeName: cleanName,
              imageData: selectedImage,
              targetCode: finalTargetCode || undefined,
              basePreset: selectedBasePresetId || undefined,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              finalImagePath = data.imagePath || selectedImage;
              if (data.targetCode && !finalTargetCode) {
                finalTargetCode = data.targetCode;
              }
            }
          }
        } catch (networkErr) {
          console.warn('API save-recipe endpoint unavailable, falling back to local storage:', networkErr);
        }

        const newRecipe: CreatedRecipe = {
          id: cleanName.toLowerCase(),
          name: cleanName,
          type: 'Preset',
          image: finalImagePath,
          targetCode: finalTargetCode || undefined,
        };

        saveRecipeToStore(newRecipe);

        setSuccessMessage(`Recipe "${cleanName}" created and saved to project repository!`);

        setTimeout(() => {
          onSave(newRecipe);
        }, 800);
      }
    } catch (err: any) {
      console.error('Failed to save recipe:', err);
      setErrorMessage(`Failed to save recipe: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!editRecipe) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await deleteRecipeBackend(editRecipe.id);
      deleteRecipeFromStore(editRecipe.id);

      setSuccessMessage(`Recipe "${editRecipe.name}" deleted successfully.`);
      setTimeout(() => {
        if (onDelete) {
          onDelete(editRecipe.id);
        } else {
          onClose();
        }
      }, 700);
    } catch (err: any) {
      console.error('Failed to delete recipe:', err);
      setErrorMessage(`Failed to delete recipe: ${err.message || 'Unknown error'}`);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-[920px] max-h-[92vh] rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-300">

        {/* Header */}
        <div className="bg-[#123681] text-white font-bold py-3 px-6 flex justify-between items-center shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-blue-200 hover:text-white p-1 rounded transition-colors mr-1 cursor-pointer"
              title="Back to Presets"
            >
              <ArrowLeft size={18} />
            </button>
            <h2 className="text-base font-bold">
              {isEditMode ? `Update Recipe: ${editRecipe?.name}` : 'Create New Recipe (Program)'}
            </h2>
            <span className="text-xs bg-blue-900/60 text-blue-200 px-2 py-0.5 rounded font-mono">
              Code & Label Verification
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white p-1 rounded transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8fafc]">

          {/* Notification Banners */}
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-xs font-semibold">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs font-bold">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* SECTION 1: Recipe Identity */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold text-[#123681] uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 pb-2">
              <FolderOpen size={15} />
              1. Recipe Identification
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Column 1: Recipe Name & Pre-existing Preset Selector */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Recipe Name * <span className="text-gray-400 font-normal">(Folder & Script ID)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. recipe4_herbal_shampoo"
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs text-gray-800 font-mono font-bold focus:outline-none focus:border-[#123681] bg-white shadow-2xs"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">
                    Saved as: <code className="text-blue-700">recipes/{recipeName ? recipeName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'recipe_name'}.py</code>
                  </span>
                </div>

                {/* DIRECTLY BELOW RECIPE NAME: Select Pre-existing Preset */}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-gray-700 flex items-center gap-1.5">
                      <Layers size={13} className="text-[#123681]" />
                      <span>Base on Pre-existing Preset <span className="text-gray-400 font-normal">(Template)</span></span>
                    </label>
                    {selectedBasePresetId && (
                      <button
                        type="button"
                        onClick={() => handleSelectBasePreset('')}
                        className="text-[10px] text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                      >
                        <X size={10} /> Clear
                      </button>
                    )}
                  </div>

                  {/* Dropdown Selector */}
                  <select
                    value={selectedBasePresetId}
                    onChange={(e) => handleSelectBasePreset(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs text-gray-800 font-semibold focus:outline-none focus:border-[#123681] bg-white cursor-pointer shadow-2xs"
                  >
                    <option value="">-- None (Create New from Scratch) --</option>
                    {availablePresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} {preset.targetCode ? `• [Ref Code: ${preset.targetCode}]` : `(${preset.type || 'Preset'})`}
                      </option>
                    ))}
                  </select>

                  {/* Quick Preset Selector Chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-400 font-semibold">Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleSelectBasePreset('')}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${!selectedBasePresetId
                          ? 'bg-[#123681] text-white border-[#123681] font-bold shadow-2xs'
                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                    >
                      None
                    </button>
                    {availablePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectBasePreset(preset.id)}
                        className={`text-[10px] px-2 py-0.5 rounded border font-mono transition-all cursor-pointer ${selectedBasePresetId === preset.id
                            ? 'bg-[#123681] text-white border-[#123681] font-bold shadow-2xs scale-102'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
                          }`}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column 2: Target Barcode & Active Base Preset Info Card */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-gray-700 flex items-center gap-1.5 text-xs">
                      <span>Target Barcode / Reference Code</span>
                      {isDetectingBarcode && (
                        <span className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold animate-pulse">
                          <Loader2 size={11} className="animate-spin" />
                          Auto-detecting from image...
                        </span>
                      )}
                      {!isDetectingBarcode && detectedBarcode && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-300 px-1.5 py-0.2 rounded shadow-2xs">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Auto-detected: {detectedBarcode}
                        </span>
                      )}
                    </label>

                    {selectedImage && selectedImage.startsWith('data:image') && (
                      <button
                        type="button"
                        onClick={() => autoScanBarcodeFromImage(selectedImage)}
                        disabled={isDetectingBarcode}
                        className="text-[10px] text-[#123681] hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-50"
                        title="Scan image pixels to extract genuine barcode"
                      >
                        <ScanLine size={11} />
                        Scan from Image
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. 7501055320639 or 8901030866784"
                      value={targetCode}
                      onChange={(e) => {
                        setTargetCode(e.target.value);
                        setDetectedBarcode(null);
                        setBarcodeDetectionNote(null);
                      }}
                      className={`w-full border rounded px-3 py-2 text-xs text-gray-800 font-mono font-bold focus:outline-none transition-all shadow-2xs ${
                        detectedBarcode
                          ? 'border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-400'
                          : 'border-gray-300 bg-white focus:border-[#123681]'
                      }`}
                    />
                  </div>

                  {barcodeDetectionNote && !detectedBarcode && !isDetectingBarcode && (
                    <span className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle size={11} className="text-amber-600" />
                      {barcodeDetectionNote}
                    </span>
                  )}
                  {!barcodeDetectionNote && (
                    <span className="text-[10px] text-gray-400 mt-1 block">
                      Auto-detected authentic barcode from image for real-time `compare_code.py` verification.
                    </span>
                  )}
                </div>

                {/* Base Preset Visual Card */}
                {selectedBasePreset ? (
                  <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-md flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-900 rounded border border-gray-300 overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                      {selectedBasePreset.image ? (
                        <img
                          src={selectedBasePreset.image}
                          alt={selectedBasePreset.name}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Layers size={18} className="text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-800">{selectedBasePreset.name}</span>
                        <span className="text-[10px] bg-[#123681] text-white px-1.5 py-0.2 rounded font-mono font-semibold">
                          Active Template
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 truncate mt-0.5">
                        Reference Barcode: <span className="font-mono font-bold text-[#123681]">{selectedBasePreset.targetCode || 'None'}</span>
                      </p>
                      <p className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                        <CheckCircle2 size={11} className="shrink-0 text-emerald-600" />
                        Reference image & parameters linked. You can keep or replace below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-dashed border-gray-300 rounded-md text-gray-500 text-[11px] flex items-center gap-2.5">
                    <Sparkles size={16} className="text-[#123681] shrink-0" />
                    <span>
                      Select an existing preset on the left to clone its reference image and barcode decoding parameters, or configure a clean recipe from scratch.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Image Acquisition (Upload or Camera Capture) */}
          <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <h3 className="text-xs font-bold text-[#123681] uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={15} />
                2. Product Image Acquisition
              </h3>

              {/* Acquisition Mode Switcher */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md border border-gray-200">
                <button
                  type="button"
                  onClick={() => setAcquisitionMode('upload')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${acquisitionMode === 'upload'
                      ? 'bg-[#123681] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                  <UploadCloud size={13} />
                  Upload Image File
                </button>

                <button
                  type="button"
                  onClick={() => setAcquisitionMode('camera')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${acquisitionMode === 'camera'
                      ? 'bg-[#123681] text-white shadow-2xs'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                  <Camera size={13} />
                  Capture External Camera
                </button>
              </div>
            </div>

            {/* MODE A: UPLOAD FILE */}
            {acquisitionMode === 'upload' && (
              <div className="space-y-3">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-[#123681] rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/20"
                >
                  <UploadCloud size={36} className="text-[#123681] mb-2" />
                  <p className="text-xs font-bold text-gray-700">
                    Click to browse or drag and drop product image here
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Supports PNG, JPG, JPEG, WEBP (Max 25MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* MODE B: CAPTURE FROM EXTERNAL CAMERA */}
            {acquisitionMode === 'camera' && (
              <div className="space-y-3">
                {/* Camera controls toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 p-2.5 rounded border border-gray-200 text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <Video size={15} className="text-[#123681]" />
                    <span className="font-bold text-gray-700">Video Device:</span>
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => setSelectedDeviceId(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-800 bg-white font-medium focus:outline-none focus:border-[#123681] flex-1 max-w-xs"
                    >
                      {videoDevices.length === 0 && (
                        <option value="">Default Optical Camera / Scanner</option>
                      )}
                      {videoDevices.map((dev, idx) => (
                        <option key={dev.deviceId || idx} value={dev.deviceId}>
                          {dev.label || `Camera ${idx + 1} (${dev.deviceId.substring(0, 8)}...)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={startCamera}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-bold cursor-pointer transition-colors"
                    >
                      <RotateCcw size={12} />
                      Restart Feed
                    </button>
                    <button
                      type="button"
                      onClick={handleCaptureSnapshot}
                      disabled={!isCameraActive}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-[#123681] hover:bg-blue-900 text-white rounded font-bold cursor-pointer transition-colors shadow-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Camera size={14} />
                      Capture Frame
                    </button>
                  </div>
                </div>

                {cameraError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-semibold">
                    {cameraError}
                  </div>
                )}

                {/* Live Camera Viewfinder */}
                <div className="relative bg-black rounded-lg overflow-hidden h-60 flex items-center justify-center border-2 border-gray-800 shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />

                  {/* Crosshair ROI Alignment Guide */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-32 border-2 border-emerald-400/80 rounded bg-emerald-500/5 flex flex-col justify-between p-1.5">
                      <div className="text-[10px] font-mono text-emerald-300 font-bold bg-black/60 px-1 rounded w-fit">
                        [ALIGN BARCODE IN FRAME]
                      </div>
                      <div className="w-full h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444]" />
                      <div className="text-[9px] text-right font-mono text-emerald-400 font-bold bg-black/60 px-1 rounded self-end">
                        RECIPE CAPTURE
                      </div>
                    </div>
                  </div>

                  <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE CAMERA VIEW
                  </div>
                </div>

                {/* Hidden canvas for snapshot rendering */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {/* PREVIEW OF CAPTURED / UPLOADED / TEMPLATE IMAGE */}
            {selectedImage && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span className="text-xs font-bold text-gray-700">
                      Recipe Image Preview
                    </span>
                    {imageSource === 'template' && (
                      <span className="text-[10px] bg-blue-100 text-[#123681] px-1.5 py-0.2 rounded font-semibold border border-blue-200 ml-1">
                        From Template: {selectedBasePresetId}
                      </span>
                    )}
                    {imageSource === 'camera' && (
                      <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-semibold border border-purple-200 ml-1">
                        Camera Snapshot
                      </span>
                    )}
                    {imageSource === 'upload' && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-semibold border border-emerald-200 ml-1">
                        File Upload
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                    <span>{imageFileName}</span>
                    <span>•</span>
                    <span>{imageFileSize}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImage(null);
                        setImageSource(null);
                        setImageFileName('');
                        setImageFileSize('');
                      }}
                      className="text-red-600 hover:text-red-800 font-bold cursor-pointer underline text-[11px]"
                    >
                      Clear / Retake
                    </button>
                  </div>
                </div>

                <div className="h-44 bg-slate-900 border border-slate-700 rounded-md flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={selectedImage}
                    alt="Recipe Product Preview"
                    className="max-h-full max-w-full object-contain rounded"
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 font-mono">
                  <span>File storage target: <code className="text-blue-700 font-bold">recipes/images/{recipeName ? recipeName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') : 'recipe'}.png</code></span>
                  <span className="text-emerald-700 font-bold">● Ready for verification</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Save & Delete Recipe Buttons */}
        <div className="bg-white border-t border-gray-200 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 border border-gray-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {isEditMode && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting || isSaving}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                title="Delete this recipe program"
              >
                <Trash2 size={14} />
                <span>Delete Recipe</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveRecipe}
            disabled={isSaving || isDeleting}
            className="flex items-center gap-2 px-6 py-2.5 rounded text-xs font-bold text-white bg-[#123681] hover:bg-blue-900 transition-colors shadow-sm cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Save size={15} />
            {isSaving ? (isEditMode ? 'Updating Recipe...' : 'Saving Recipe...') : (isEditMode ? 'Update Recipe' : 'Save Recipe')}
          </button>
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-[420px] rounded-lg shadow-2xl p-5 border border-red-200 flex flex-col gap-4">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Delete Recipe</h3>
                  <p className="text-xs text-gray-500">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-gray-700 leading-relaxed">
                Are you sure you want to permanently delete recipe <strong className="text-gray-900 font-bold font-mono">"{editRecipe?.name}"</strong>? It will be removed from your active presets repository.
              </p>

              <div className="flex justify-end items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 border border-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRecipe}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Recipe'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default CreateRecipeModal;
