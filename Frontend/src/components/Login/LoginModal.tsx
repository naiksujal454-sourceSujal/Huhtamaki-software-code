import React, { useState } from 'react';
import { Shield, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { loginUser } from '../../services/api';
import { auditLogger } from '../../services/auditLogger';

interface LoginModalProps {
  onLogin: (user: { username: string; role: string; id?: number | string }) => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await loginUser(cleanUser, password);
      auditLogger.setCurrentUser(response.user.username);
      onLogin({
        username: response.user.username,
        role: response.user.role.toUpperCase(),
        id: response.user.id,
      });
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please check credentials.';
      setErrorMessage(msg.includes('invalid credentials') ? 'Invalid Username or Password' : msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl w-[370px] overflow-hidden flex flex-col pointer-events-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-150">

      {/* Header */}
      <div className="pt-7 pb-3 flex flex-col items-center border-b border-gray-100 bg-slate-50/60">

        <h2 className="text-[#153472] text-xl font-bold tracking-tight">Sign In</h2>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="mx-6 mt-4 p-2.5 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-3.5">

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-700 ml-0.5">Username</label>
          <input
            type="text"
            placeholder="e.g. admin or operator"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#f8fafc] border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#153472] focus:ring-1 focus:ring-[#153472] transition-colors placeholder:text-gray-400 disabled:opacity-60"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-gray-700 ml-0.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full bg-[#f8fafc] border border-gray-300 rounded-md pl-3 pr-10 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#153472] focus:ring-1 focus:ring-[#153472] transition-colors placeholder:text-gray-400 disabled:opacity-60"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#153472] hover:bg-blue-900 active:bg-blue-950 text-white font-bold py-2.5 rounded-md mt-2 transition-colors text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>

      {/* Quick Credentials Hint */}
      <div className="mx-6 px-3 py-2 bg-slate-100/80 rounded border border-slate-200 text-[11px] text-gray-600">
        <span className="font-bold text-gray-700">Default Logins:</span>
        <div className="mt-0.5 flex flex-col text-[10.5px] text-gray-500 font-mono">
          <span>admin / Admin@123</span>
        </div>
      </div>

      {/* Security Notice */}
      <div className="mt-3 px-6 pb-5">
        <div className="flex items-start gap-2 text-gray-400">
          <p className="text-[10px] leading-snug">

          </p>
        </div>
      </div>

    </div>
  );
};

export default LoginModal;
