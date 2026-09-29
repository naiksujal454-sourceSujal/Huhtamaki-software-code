import React from 'react';
import { LogOut, X, UserCheck } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

interface LogoutModalProps {
  user?: { username: string; role: string } | null;
  onClose: () => void;
  onConfirmLogout: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({ user, onClose, onConfirmLogout }) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white w-[420px] rounded-xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
        
        {/* Header */}
        <div className="bg-[#123681] text-white py-3.5 px-5 flex justify-between items-center select-none">
          <div className="flex items-center gap-2.5">
            <LogOut size={18} className="text-blue-200" />
            <h2 className="text-sm font-bold tracking-wide uppercase">{t('User Logout')}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-md transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-5">
          
          {/* User Info Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-4 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#123681] text-white flex items-center justify-center shadow-sm shrink-0">
              <UserCheck size={24} />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-800 text-base truncate">
                  {user?.username || 'admin'}
                </span>
                <span className="bg-blue-100 text-[#123681] text-[10px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase">
                  {user?.role || 'ADMIN'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-emerald-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{t('Active Session')}</span>
              </div>
            </div>
          </div>

          {/* Warning / Prompt text */}
          <div className="text-gray-600 text-xs leading-relaxed">
            <p className="font-medium text-gray-700 mb-1">
              {t('Are you sure you want to end your session?')}
            </p>
            <p className="text-gray-500">
              {t('You will be logged out and returned to the sign-in screen.')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer"
            >
              {t('Cancel')}
            </button>
            <button
              onClick={onConfirmLogout}
              type="button"
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-md shadow-sm transition-colors cursor-pointer flex items-center gap-2"
            >
              <LogOut size={14} />
              <span>{t('Log Out')}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default LogoutModal;
