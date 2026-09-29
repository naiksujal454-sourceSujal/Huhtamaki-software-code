import React, { useState } from 'react';
import { KeyRound, X, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { changeUserPassword, type User } from '../../services/api';
import { auditLogger } from '../../services/auditLogger';

interface ChangePasswordModalProps {
  user: User | { id: number | string; username: string; role: string };
  onClose: () => void;
  onSuccess?: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose, onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword.trim()) {
      setErrorMsg('Please enter the original default password.');
      return;
    }

    if (!newPassword.trim()) {
      setErrorMsg('Please enter a new password.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters long.');
      return;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await changeUserPassword(user.id, {
        current_password: currentPassword,
        new_password: newPassword,
        username: user.username,
      });

      setSuccessMsg(response.message || 'Password updated successfully!');
      
      // Log event into software audit system
      auditLogger.logAction(
        'Change Password',
        'security.password_changed',
        `Password changed for user '${user.username}'`,
        { target_user: user.username, user_id: user.id }
      );

      if (onSuccess) {
        onSuccess();
      }

      // Close modal automatically after brief success delay
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password. Please check your current password.');
      auditLogger.logAction(
        'Change Password',
        'security.password_change_failed',
        `Failed password change attempt for '${user.username}': incorrect current password`,
        { target_user: user.username, user_id: user.id }
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white w-[420px] rounded-xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
        
        {/* Card Header */}
        <div className="bg-[#123681] text-white py-3.5 px-5 flex justify-between items-center select-none shadow-sm">
          <div className="flex items-center gap-2.5">
            <KeyRound size={18} className="text-amber-300" />
            <h2 className="text-sm font-bold tracking-wide uppercase">Change Password</h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={isLoading}
            className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-md transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Info Bar */}
        <div className="bg-slate-50 border-b border-gray-100 px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#123681]" />
            <span className="text-xs text-gray-500 font-medium">Target User:</span>
            <span className="text-xs font-bold text-gray-800">{user.username}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-[#123681]">
            {user.role}
          </span>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          
          {/* Status feedback */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start gap-2.5 text-xs text-red-700 animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 text-red-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md flex items-center gap-2.5 text-xs text-emerald-800 animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              <div className="flex-1 font-bold">{successMsg}</div>
            </div>
          )}

          {/* Field 1: Original Default Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-700">
              Original Default Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input 
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter original default password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isLoading || !!successMsg}
                className="w-full bg-[#f8fafc] border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] transition-colors placeholder:text-gray-400 disabled:opacity-60"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              Enter current password (e.g. default password for this account).
            </p>
          </div>

          {/* Field 2: New Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-700">
              New Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input 
                type={showNew ? 'text' : 'password'}
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isLoading || !!successMsg}
                className="w-full bg-[#f8fafc] border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] transition-colors placeholder:text-gray-400 disabled:opacity-60"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Field 3: Confirm New Password */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-gray-700">
              Confirm New Password
            </label>
            <div className="relative">
              <input 
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading || !!successMsg}
                className="w-full bg-[#f8fafc] border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#123681] focus:ring-1 focus:ring-[#123681] transition-colors placeholder:text-gray-400 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 mt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !!successMsg}
              className="px-5 py-2 text-xs font-bold text-white bg-[#123681] hover:bg-blue-900 active:bg-blue-950 rounded-md shadow-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Updating...</span>
                </>
              ) : successMsg ? (
                <>
                  <CheckCircle2 size={14} />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};

export default ChangePasswordModal;
