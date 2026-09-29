import React, { useState, useEffect } from 'react';
import { Home, UserCheck } from 'lucide-react';
import { formatDateTime, subscribeToDateFormat } from '../../services/dateFormatService';

interface FooterProps {
  onHomeClick?: () => void;
  isAuthenticated?: boolean;
  user?: { username: string; role: string } | null;
  onLogoutClick?: () => void;
}

const Footer: React.FC<FooterProps> = ({ 
  onHomeClick, 
  isAuthenticated = false, 
  user, 
  onLogoutClick 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const unsub = subscribeToDateFormat(() => setCurrentTime(new Date()));
    return () => {
      clearInterval(timer);
      unsub();
    };
  }, []);

  const formatTime = (date: Date) => {
    return formatDateTime(date, false);
  };

  return (
    <div className="h-8 bg-pixtron-blue text-white flex items-center justify-between px-2 text-xs font-bold z-20">
      <div className="flex items-center gap-4">
        <button 
          onClick={onHomeClick}
          className="bg-white/10 hover:bg-white/20 p-1.5 rounded-sm cursor-pointer transition-colors"
        >
          <Home size={18} />
        </button>
        <span className="text-gray-300 font-mono">Serial: MV-0604-001-ABC123</span>
      </div>
      
      <div className="text-gray-200">
        Powered by Pixtron Systems | Vendor name
      </div>
      
      <div className="flex items-center gap-4">
        {isAuthenticated && (
          <span>{user ? `${user.username} (${user.role.toUpperCase()})` : 'Logged In'}</span>
        )}
        <span className="font-mono">{formatTime(currentTime)}</span>
        {isAuthenticated && (
          <button 
            onClick={onLogoutClick}
            title="Log Out"
            className="bg-white/10 hover:bg-white/20 p-1.5 rounded-sm cursor-pointer transition-colors active:scale-95 flex items-center justify-center"
          >
            <UserCheck size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Footer;
