import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Clock, 
  Layout, 
  FileText, 
  CheckCircle, 
  Wrench, 
  AlertTriangle, 
  Globe, 
  Shield, 
  Calendar, 
  Info,
  Monitor,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import GeneralSettingsTab from './tabs/GeneralSettingsTab';
import TestTab from './tabs/TestTab';
import SystemInfoTab from './tabs/SystemInfoTab';
import UITab from './tabs/UITab';
import ServiceDetailTab from './tabs/ServiceDetailTab';
import AlertConfigurationTab from './tabs/AlertConfigurationTab';
import SecurityTab from './tabs/SecurityTab';
import AdvanceSettingsTab from './tabs/AdvanceSettingsTab';
import InternetConnectionTab from './tabs/InternetConnectionTab';
import LogsTab from './tabs/LogsTab';
import ProductionLineTab from './tabs/ProductionLineTab';
import PlatformTab from './tabs/PlatformTab';
import { auditLogger } from '../../services/auditLogger';
import { fetchMyPrivileges, getCurrentUser } from '../../services/api';

interface SettingsViewProps {
  onNavigate: (view: 'analytics' | 'settings') => void;
  initialTab?: string;
  currentUser?: { username: string; role: string } | null;
}

const tabPrivilegeMap: Record<string, string> = {
  'General Settings': 'General Settings',
  'Advance Settings': 'Advance Settings',
  'Production Line Setup': 'General Settings',
  'Logs': 'View App Logs',
  'Test': 'Test Diagnostics',
  'Service Detail': 'Service Detail',
  'Alert Configuration': 'Alert Configuration',
  'Internet Connection': 'Internet Connection',
  'Security': 'Access Settings',
  'Platform': 'General Settings',
  'System Info': 'General Settings',
  'UI': 'UI Settings',
};

const SettingsView: React.FC<SettingsViewProps> = ({ onNavigate, initialTab, currentUser }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'General Settings');
  const [brightness, setBrightness] = useState(100);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [privileges, setPrivileges] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('huhtamaki_cached_privileges');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      'General Settings': true,
      'Advance Settings': true,
      'Production Line Setup': true,
      'View App Logs': true,
      'Test Diagnostics': true,
      'Service Detail': true,
      'Alert Configuration': true,
      'Internet Connection': true,
      'Access Settings': true,
      'UI Settings': true,
    };
  });
  const [currentUserRole, setCurrentUserRole] = useState<string>(
    currentUser?.role?.toLowerCase() || 'admin'
  );
  const [loadingPrivileges, setLoadingPrivileges] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (currentUser?.role) {
      setCurrentUserRole(currentUser.role.toLowerCase());
    }
  }, [currentUser]);

  useEffect(() => {
    // Apply brightness filter to the entire body to dim the UI globally
    document.body.style.filter = `brightness(${brightness}%)`;
  }, [brightness]);

  // Load effective role privileges and user role from database quietly in background
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        const [privs, user] = await Promise.all([
          fetchMyPrivileges(),
          getCurrentUser(),
        ]);
        if (privs) {
          setPrivileges(privs);
          try {
            localStorage.setItem('huhtamaki_cached_privileges', JSON.stringify(privs));
          } catch {}
        }
        const role = user?.role || currentUser?.role;
        if (role) {
          setCurrentUserRole(role.toLowerCase());
        }
      } catch (err) {
        console.warn('Could not load user privileges:', err);
      }
    };
    loadPermissions();
  }, [currentUser]);

  const hasAccess = (tabName: string): boolean => {
    // Admin always has full access (case-insensitive)
    if (currentUserRole?.toLowerCase() === 'admin') return true;
    const requiredPriv = tabPrivilegeMap[tabName];
    if (!requiredPriv) return true;
    if (privileges[requiredPriv] === undefined) return true;
    return privileges[requiredPriv] === true;
  };

  const handleTabClick = (tabName: string) => {
    if (tabName !== activeTab) {
      setActiveTab(tabName);
      try {
        auditLogger.logSettingsTab(tabName);
      } catch {}
    }
  };

  const menuItems = [
    { name: 'General Settings', icon: <Settings size={16} /> },
    { name: 'Advance Settings', icon: <Clock size={16} /> },
    { name: 'Production Line Setup', icon: <Layout size={16} /> },
    { name: 'Logs', icon: <FileText size={16} /> },
    { name: 'Test', icon: <CheckCircle size={16} /> },
    { name: 'Service Detail', icon: <Wrench size={16} /> },
    { name: 'Alert Configuration', icon: <AlertTriangle size={16} /> },
    { name: 'Internet Connection', icon: <Globe size={16} /> },
    { name: 'Security', icon: <Shield size={16} /> },
    { name: 'Platform', icon: <Calendar size={16} /> },
    { name: 'System Info', icon: <Info size={16} /> },
    { name: 'UI', icon: <Monitor size={16} /> },
  ];

  const currentTabAllowed = hasAccess(activeTab);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#eff1f4] rounded-md relative border border-gray-300">
      
      {/* Top Tab Bar */}
      <div className="flex gap-2 p-4 pb-0">
        <button 
          className="flex items-center gap-2 px-6 py-2 bg-[#123681] text-white font-bold rounded-t-lg shadow-sm border border-b-0 border-[#123681] cursor-default"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          {t('Settings')}
        </button>
        <button 
          onClick={() => {
            auditLogger.logNavigation('analytics', 'Switched from Settings to Analytics Dashboard');
            onNavigate('analytics');
          }}
          className="flex items-center gap-2 px-6 py-2 bg-white text-gray-700 font-bold rounded-t-lg shadow-sm border border-b-0 border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="3" rx="1"></rect><rect width="7" height="7" x="14" y="14" rx="1"></rect><rect width="7" height="7" x="3" y="14" rx="1"></rect></svg>
          {t('Dashboard')}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white mx-4 mb-4 rounded-md shadow-sm border border-gray-200 overflow-hidden flex">
        
        {/* Sidebar Navigation */}
        <div className="w-[240px] border-r border-gray-200 bg-white overflow-y-auto py-2">
          {menuItems.map((item) => {
            const allowed = hasAccess(item.name);
            return (
              <button
                key={item.name}
                onClick={() => handleTabClick(item.name)}
                className={`w-[90%] mx-auto flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all mb-1 cursor-pointer ${
                  activeTab === item.name 
                    ? 'bg-[#153472] text-white shadow-md' 
                    : allowed
                    ? 'text-gray-700 hover:bg-gray-100 bg-transparent'
                    : 'text-gray-400 bg-gray-50/50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className={activeTab === item.name ? 'text-white' : allowed ? 'text-gray-500' : 'text-gray-400'}>
                    {item.icon}
                  </div>
                  <span className="text-left truncate">{t(item.name)}</span>
                </div>

                {!allowed && (
                  <span title="Restricted by Role Privilege">
                    <Lock size={12} className={activeTab === item.name ? 'text-white/80' : 'text-gray-400'} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 overflow-y-auto p-8">
          {!currentTabAllowed ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50/50 rounded-xl border border-dashed border-gray-300">
              <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4 shadow-sm">
                <ShieldAlert size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Access Restricted (Role Privilege Required)</h3>
              <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
                Access to <strong className="text-gray-700">{activeTab}</strong> is disabled for your current role (<span className="uppercase font-bold text-[#153472]">{currentUserRole}</span>) in the database permissions matrix.
              </p>
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-xs text-gray-600 max-w-md shadow-sm">
                <span className="font-bold text-gray-800 block mb-1">To Enable Access:</span>
                Contact your System Administrator to check the <strong className="text-[#153472]">{tabPrivilegeMap[activeTab] || activeTab}</strong> privilege under <strong>Security &gt; Role Privileges</strong>.
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'General Settings' && <GeneralSettingsTab />}
              {activeTab === 'Advance Settings' && <AdvanceSettingsTab />}
              {activeTab === 'Logs' && <LogsTab />}
              {activeTab === 'Test' && <TestTab />}
              {activeTab === 'System Info' && <SystemInfoTab />}
              {activeTab === 'Alert Configuration' && <AlertConfigurationTab />}
              {activeTab === 'Security' && <SecurityTab />}
              {activeTab === 'Production Line Setup' && <ProductionLineTab />}
              {activeTab === 'Platform' && <PlatformTab />}
              {activeTab === 'UI' && <UITab brightness={brightness} setBrightness={setBrightness} />}
              {activeTab === 'Service Detail' && <ServiceDetailTab />}
              {activeTab === 'Internet Connection' && <InternetConnectionTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
