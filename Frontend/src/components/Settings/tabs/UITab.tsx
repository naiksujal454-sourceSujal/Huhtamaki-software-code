import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { auditLogger } from '../../../services/auditLogger';
import { CheckCircle, Loader2 } from 'lucide-react';
import { fetchSettingsSection, updateSettingsSection } from '../../../services/api';

interface UITabProps {
  brightness: number;
  setBrightness: (val: number) => void;
}

const UITab: React.FC<UITabProps> = ({ brightness, setBrightness }) => {
  const { language, setLanguage } = useLanguage();
  const [savedMsg, setSavedMsg] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load persisted UI settings on mount
  useEffect(() => {
    const loadUISettings = async () => {
      try {
        const data = await fetchSettingsSection('ui');
        if (data) {
          if (typeof data.brightness === 'number') {
            setBrightness(data.brightness);
          }
          if (data.language && (data.language === 'en' || data.language === 'hi')) {
            setLanguage(data.language);
          }
        }
      } catch (err) {
        console.warn('Could not load UI settings from DB:', err);
      }
    };
    loadUISettings();
  }, [setBrightness, setLanguage]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettingsSection('ui', {
        brightness: brightness,
        language: language,
      });

      auditLogger.logAction('UI Settings', 'settings.ui_saved', `Saved UI Settings: Brightness ${brightness}%, Language ${language}`, {
        brightness,
        language,
      });

      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err) {
      console.error('Failed to save UI settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-[#153472] mb-2">UI Settings</h2>
      <p className="text-sm text-gray-500 mb-8">Customize the user interface appearance and language.</p>

      {savedMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold flex items-center gap-2">
          <CheckCircle size={16} />
          <span>UI settings saved successfully.</span>
        </div>
      )}

      <div className="mb-8">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          Display Brightness ({brightness}%)
        </label>
        <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Dark</span>
              <input 
                type="range" 
                min="30" 
                max="100" 
                value={brightness}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setBrightness(val);
                }}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#153472]"
              />
              <span className="text-sm text-gray-500">Bright</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">Adjusting the slider will immediately change the screen brightness.</p>
          </div>

          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 mb-2">Language</label>
            <select 
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'hi')}
              className="w-full max-w-[300px] border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#153472]"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी (Hindi)</option>
            </select>
            <p className="text-xs text-gray-400 mt-2">Select application display language.</p>
          </div>

          <button 
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-[#153472] hover:bg-blue-900 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors text-sm flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin" size={14} />}
            <span>Save UI Settings</span>
          </button>
    </div>
  );
};

export default UITab;
