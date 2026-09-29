import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  fetchUsers, 
  toggleUserActive, 
  deleteUser,
  fetchRolePrivileges, 
  updateRolePrivileges, 
  fetchSettingsSection, 
  updateSettingsSection, 
  type User 
} from '../../../services/api';
import { auditLogger } from '../../../services/auditLogger';
import ChangePasswordModal from '../../Modals/ChangePasswordModal';
import { 
  KeyRound, 
  Shield, 
  RefreshCw, 
  UserPlus, 
  CheckCircle, 
  AlertTriangle, 
  X, 
  Save, 
  Lock, 
  Unlock, 
  ShieldCheck, 
  Clock,
  Loader2,
  Trash2
} from 'lucide-react';
import { getApiUrl } from '../../../services/apiConfig';

interface PrivilegeItem {
  id?: number;
  privilege_name: string;
  label: string;
  is_granted: boolean;
}

interface PrivilegeGroup {
  category: string;
  privileges: PrivilegeItem[];
}

const SecurityTab: React.FC = () => {
  const { t } = useLanguage();

  // Users State (synchronously initialized)
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const raw = localStorage.getItem('huhtamaki_cached_users');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      { id: 1, username: 'admin', role: 'admin', is_active: true },
      { id: 2, username: 'operator', role: 'operator', is_active: true },
      { id: 3, username: 'supervisor', role: 'supervisor', is_active: true },
    ];
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'operator' | 'supervisor' | 'user'>('operator');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Role Privileges State from Database (synchronously initialized)
  const [operatorGroups, setOperatorGroups] = useState<PrivilegeGroup[]>(() => {
    try {
      const raw = localStorage.getItem('huhtamaki_cached_op_groups');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [supervisorGroups, setSupervisorGroups] = useState<PrivilegeGroup[]>(() => {
    try {
      const raw = localStorage.getItem('huhtamaki_cached_sup_groups');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [loadingPrivileges, setLoadingPrivileges] = useState(false);
  const [savingOperator, setSavingOperator] = useState(false);
  const [savingSupervisor, setSavingSupervisor] = useState(false);

  // Session Settings State
  const [inactivityMinutes, setInactivityMinutes] = useState('15');
  const [logoutMinutes, setLogoutMinutes] = useState('30');
  const [savingSession, setSavingSession] = useState(false);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await fetchUsers();
      if (Array.isArray(data) && data.length > 0) {
        setUsers(data);
        try {
          localStorage.setItem('huhtamaki_cached_users', JSON.stringify(data));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const normalizePrivilegeGroups = (data: any): PrivilegeGroup[] => {
    if (!Array.isArray(data)) return [];
    return data.map((g: any) => {
      const rawItems = Array.isArray(g.privileges)
        ? g.privileges
        : Array.isArray(g.items)
        ? g.items
        : [];
      return {
        category: g.category || g.title || 'General',
        privileges: rawItems.map((p: any) => ({
          id: p.id,
          privilege_name: p.privilege_name || p.name || '',
          label: p.label || p.name || p.privilege_name || '',
          is_granted: p.is_granted !== undefined ? Boolean(p.is_granted) : Boolean(p.granted),
        })),
      };
    });
  };

  const loadPrivileges = async () => {
    setLoadingPrivileges(true);
    try {
      const [opData, supData] = await Promise.all([
        fetchRolePrivileges('operator'),
        fetchRolePrivileges('supervisor'),
      ]);
      const opNorm = normalizePrivilegeGroups(opData);
      const supNorm = normalizePrivilegeGroups(supData);
      if (opNorm.length > 0) {
        setOperatorGroups(opNorm);
        try {
          localStorage.setItem('huhtamaki_cached_op_groups', JSON.stringify(opNorm));
        } catch {}
      }
      if (supNorm.length > 0) {
        setSupervisorGroups(supNorm);
        try {
          localStorage.setItem('huhtamaki_cached_sup_groups', JSON.stringify(supNorm));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to load role privileges:', err);
    } finally {
      setLoadingPrivileges(false);
    }
  };

  const loadSessionSettings = async () => {
    try {
      const sessionData = await fetchSettingsSection('session');
      if (sessionData) {
        if (sessionData.inactivity_minutes) setInactivityMinutes(String(sessionData.inactivity_minutes));
        if (sessionData.logout_minutes) setLogoutMinutes(String(sessionData.logout_minutes));
      }
    } catch (err) {
      console.warn('Failed to load session settings:', err);
    }
  };

  useEffect(() => {
    loadUsers();
    loadPrivileges();
    loadSessionSettings();
  }, []);

  const handleRefresh = async () => {
    auditLogger.logAction('security', 'refresh_users', 'Refreshed user accounts from database');
    await Promise.all([loadUsers(), loadPrivileges()]);
    setFeedbackMsg({ type: 'success', text: 'Users and privileges reloaded from database.' });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await toggleUserActive(user.id);
      setUsers(prev => prev.map(u => (u.id === user.id ? { ...u, is_active: res.is_active } : u)));
      
      const actionName = res.is_active ? 'user_activated' : 'user_deactivated';
      const desc = `User '${user.username}' was ${res.is_active ? 'activated' : 'deactivated'}`;
      auditLogger.logAction(res.is_active ? 'User Activate' : 'User Deactivate', actionName, desc, {
        target_username: user.username,
        user_id: user.id,
        is_active: res.is_active,
      });

      setFeedbackMsg({
        type: 'success',
        text: `User '${user.username}' ${res.is_active ? 'activated' : 'deactivated'} successfully.`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || 'Failed to update user status.',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`Are you sure you want to permanently delete user account "${user.username}"?`);
    if (!confirmed) return;

    try {
      const res = await deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      try {
        const nextUsers = users.filter(u => u.id !== user.id);
        localStorage.setItem('huhtamaki_cached_users', JSON.stringify(nextUsers));
      } catch {}

      auditLogger.logAction('User Deleted', 'security.user_deleted', `Deleted user account '${user.username}' (role: ${user.role})`, {
        target_username: user.username,
        user_id: user.id,
      });

      setFeedbackMsg({
        type: 'success',
        text: res.message || `User '${user.username}' was deleted successfully.`,
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err.message || `Failed to delete user '${user.username}'.`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;

    setCreatingUser(true);
    setCreateUserError(null);
    setCreateUserSuccess(null);

    try {
      const res = await fetch(getApiUrl('/api/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          role: newRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to create user');
      }

      const created: User = await res.json();
      setUsers(prev => [...prev, created]);
      setCreateUserSuccess(`User '${created.username}' created successfully!`);

      auditLogger.logAction('User Created', 'security.user_created', `Created new user account '${created.username}' with role '${created.role}'`, {
        username: created.username,
        role: created.role,
      });

      setFeedbackMsg({ type: 'success', text: `User '${created.username}' created successfully.` });
      setTimeout(() => setFeedbackMsg(null), 3500);

      // Smooth delay so the user sees the confirmation on screen before the modal closes
      setTimeout(() => {
        setShowAddUserModal(false);
        setNewUsername('');
        setNewPassword('');
        setCreateUserSuccess(null);
        setCreatingUser(false);
      }, 1200);
    } catch (err: any) {
      setCreateUserError(err.message || 'Failed to create user.');
      setCreatingUser(false);
    }
  };

  // Toggle privilege in state
  const handleTogglePrivilege = (role: 'operator' | 'supervisor', categoryIndex: number, privIndex: number) => {
    if (role === 'operator') {
      setOperatorGroups(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        next[categoryIndex].privileges[privIndex].is_granted = !next[categoryIndex].privileges[privIndex].is_granted;
        return next;
      });
    } else {
      setSupervisorGroups(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        next[categoryIndex].privileges[privIndex].is_granted = !next[categoryIndex].privileges[privIndex].is_granted;
        return next;
      });
    }
  };

  // Save privileges to database
  const handleSavePrivileges = async (role: 'operator' | 'supervisor') => {
    const isOp = role === 'operator';
    if (isOp) setSavingOperator(true);
    else setSavingSupervisor(true);

    try {
      const groups = isOp ? operatorGroups : supervisorGroups;
      const flatList: any[] = [];
      groups.forEach(g => {
        g.privileges.forEach(p => {
          flatList.push({
            privilege_name: p.privilege_name,
            label: p.label,
            category: g.category,
            is_granted: p.is_granted,
          });
        });
      });

      const updated = await updateRolePrivileges(role, flatList);
      if (isOp) setOperatorGroups(normalizePrivilegeGroups(updated));
      else setSupervisorGroups(normalizePrivilegeGroups(updated));

      auditLogger.logAction(
        'Security Privileges',
        'security.privileges_saved',
        `Saved ${role.toUpperCase()} privileges (${flatList.filter(f => f.is_granted).length} granted)`,
        { role, total: flatList.length }
      );
      setFeedbackMsg({ type: 'success', text: `Role privileges for ${role.toUpperCase()} saved successfully.` });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || `Failed to save ${role} privileges.` });
    } finally {
      if (isOp) setSavingOperator(false);
      else setSavingSupervisor(false);
    }
  };

  const handleSaveSessionSettings = async () => {
    setSavingSession(true);
    try {
      const payload = {
        inactivity_minutes: parseInt(inactivityMinutes) || 15,
        logout_minutes: parseInt(logoutMinutes) || 30,
      };
      await updateSettingsSection('session', payload);
      auditLogger.logAction(
        'Session Settings',
        'security.session_settings_saved',
        `Updated session settings: Inactivity ${inactivityMinutes}m, Logout ${logoutMinutes}m`,
        payload
      );
      setFeedbackMsg({ type: 'success', text: 'Session security settings saved successfully.' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save session settings.' });
    } finally {
      setSavingSession(false);
    }
  };

  return (
    <div className="max-w-5xl pb-10">
      
      {/* Toast feedback banner */}
      {feedbackMsg && (
        <div className={`mb-4 p-3 rounded-md border flex items-center gap-2 text-xs font-bold animate-in fade-in ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedbackMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* User Management Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Shield size={20} className="text-[#153472]" />
            <span>{t('User Management')}</span>
          </h3>
          <p className="text-xs text-gray-500">Configure authentication credentials, active accounts, and database access controls.</p>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              setCreateUserError(null);
              setCreateUserSuccess(null);
              setShowAddUserModal(true);
            }}
            className="bg-[#153472] hover:bg-blue-900 active:bg-blue-950 text-white font-bold py-1.5 px-3.5 rounded text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <UserPlus size={14} />
            <span>Add User</span>
          </button>
          <button 
            onClick={handleRefresh}
            disabled={loadingUsers}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-1.5 px-3 rounded border border-gray-300 text-xs flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loadingUsers ? 'animate-spin' : ''} />
            <span>Reload DB</span>
          </button>
        </div>
      </div>

      {/* Existing Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-8 shadow-sm">
        <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Active Database Users ({users.length})
          </h4>
          <span className="text-[11px] text-gray-400">Security credential audit active</span>
        </div>

        {users.length === 0 && loadingUsers ? (
          <div className="py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-[#153472]" />
            <span>Loading database accounts...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="py-6 text-center text-sm text-gray-400">No users found.</div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    user.is_active ? 'bg-blue-100 text-[#153472]' : 'bg-gray-200 text-gray-400'
                  }`}>
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-800">{user.username}</span>
                      <span className="text-[11px] uppercase px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {user.role}
                      </span>
                      {user.is_active ? (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded">
                          active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                          inactive
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      UID: {user.public_uuid ? user.public_uuid.slice(0, 8) : `#${user.id}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button 
                    onClick={() => handleToggleActive(user)}
                    className={`font-bold py-1 px-3 rounded text-xs shadow-sm transition-colors cursor-pointer ${
                      user.is_active 
                        ? 'bg-[#da291c] hover:bg-red-700 text-white' 
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>

                  <button 
                    onClick={() => setSelectedUserForPassword(user)}
                    className="bg-[#153472] hover:bg-blue-900 text-white font-bold py-1 px-3 rounded text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <KeyRound size={13} />
                    <span>Password</span>
                  </button>

                  <button 
                    onClick={() => handleDeleteUser(user)}
                    title={`Delete user ${user.username}`}
                    className="bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-300 p-1.5 rounded transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Role Privileges with Live Database Binding & Strict Enforcement */}
      <div className="mb-8">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <ShieldCheck size={20} className="text-[#153472]" />
            <span>Role Privileges & Access Enforcement</span>
          </h3>
          <p className="text-xs text-gray-500">
            Strict permission matrix stored in the database. Only items with an active checkmark (✓) are granted access. Unticked capabilities are strictly blocked.
          </p>
        </div>

        {operatorGroups.length === 0 && loadingPrivileges ? (
          <div className="p-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg">
            <RefreshCw size={16} className="animate-spin text-[#153472]" />
            <span>Loading role permissions from database...</span>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            
            {/* Operator Column */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">Operator Role</h4>
                    <span className="text-[11px] text-gray-400">Shopfloor line operators</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-[#153472] border border-blue-200">
                    {operatorGroups.reduce((acc, g) => acc + (g.privileges || []).filter(p => p.is_granted).length, 0)} Granted
                  </span>
                </div>

                {operatorGroups.map((group, gIdx) => (
                  <div key={gIdx} className="mb-5">
                    <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{group.category}</h5>
                    <div className="flex flex-col gap-2">
                      {(group.privileges || []).map((item, pIdx) => (
                        <label 
                          key={pIdx} 
                          className={`flex items-center gap-2.5 p-1.5 rounded cursor-pointer text-xs font-bold select-none transition-colors ${
                            item.is_granted ? 'text-gray-800 bg-blue-50/40 hover:bg-blue-50' : 'text-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={item.is_granted}
                            onChange={() => handleTogglePrivilege('operator', gIdx, pIdx)}
                            className="w-4 h-4 text-[#153472] rounded border-gray-300 focus:ring-[#153472] cursor-pointer" 
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={() => handleSavePrivileges('operator')}
                  disabled={savingOperator}
                  className="w-full bg-[#153472] hover:bg-blue-900 active:bg-blue-950 text-white font-bold py-2 rounded-md shadow-sm text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                >
                  <Save size={14} />
                  <span>{savingOperator ? 'Saving...' : 'Save Operator Privileges'}</span>
                </button>
              </div>
            </div>

            {/* Supervisor Column */}
            <div className="flex-1 bg-white border border-gray-200 rounded-lg p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
                  <div>
                    <h4 className="text-base font-bold text-gray-900">Supervisor Role</h4>
                    <span className="text-[11px] text-gray-400">Shift leaders and production engineers</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {supervisorGroups.reduce((acc, g) => acc + (g.privileges || []).filter(p => p.is_granted).length, 0)} Granted
                  </span>
                </div>

                {supervisorGroups.map((group, gIdx) => (
                  <div key={gIdx} className="mb-5">
                    <h5 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{group.category}</h5>
                    <div className="flex flex-col gap-2">
                      {(group.privileges || []).map((item, pIdx) => (
                        <label 
                          key={pIdx} 
                          className={`flex items-center gap-2.5 p-1.5 rounded cursor-pointer text-xs font-bold select-none transition-colors ${
                            item.is_granted ? 'text-gray-800 bg-emerald-50/40 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-50'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={item.is_granted}
                            onChange={() => handleTogglePrivilege('supervisor', gIdx, pIdx)}
                            className="w-4 h-4 text-[#153472] rounded border-gray-300 focus:ring-[#153472] cursor-pointer" 
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={() => handleSavePrivileges('supervisor')}
                  disabled={savingSupervisor}
                  className="w-full bg-[#153472] hover:bg-blue-900 active:bg-blue-950 text-white font-bold py-2 rounded-md shadow-sm text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
                >
                  <Save size={14} />
                  <span>{savingSupervisor ? 'Saving...' : 'Save Supervisor Privileges'}</span>
                </button>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Session Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm max-w-xl">
        <h3 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
          <Clock size={18} className="text-[#153472]" />
          <span>Session & Inactivity Lock Settings</span>
        </h3>
        <p className="text-xs text-gray-500 mb-4">Timeout parameters persisted in the database section 'session'.</p>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Inactivity Lock Time (min)</label>
            <input 
              type="number" 
              min="1"
              max="120"
              value={inactivityMinutes}
              onChange={(e) => setInactivityMinutes(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Auto Logout Timing (min)</label>
            <input 
              type="number" 
              min="5"
              max="480"
              value={logoutMinutes}
              onChange={(e) => setLogoutMinutes(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>
        </div>

        <button 
          onClick={handleSaveSessionSettings}
          disabled={savingSession}
          className="bg-[#153472] hover:bg-blue-900 text-white font-bold py-2 px-6 rounded-md shadow-sm text-xs flex items-center gap-2 cursor-pointer disabled:opacity-60"
        >
          <Save size={14} />
          <span>{savingSession ? 'Saving...' : 'Save Session Settings'}</span>
        </button>
      </div>

      {/* Change Password Card / Modal */}
      {selectedUserForPassword && (
        <ChangePasswordModal 
          user={selectedUserForPassword}
          onClose={() => setSelectedUserForPassword(null)}
          onSuccess={() => {
            loadUsers();
          }}
        />
      )}

      {/* Add New User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white w-[380px] rounded-xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
            <div className="bg-[#153472] text-white py-3.5 px-5 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <UserPlus size={18} />
                <h3 className="text-sm font-bold tracking-wide uppercase">Add New User</h3>
              </div>
              <button onClick={() => setShowAddUserModal(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700">Username</label>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="Enter username"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#153472] disabled:bg-gray-100"
                  disabled={creatingUser || !!createUserSuccess}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700">Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter initial password"
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#153472] disabled:bg-gray-100"
                  disabled={creatingUser || !!createUserSuccess}
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700">Role</label>
                <select 
                  value={newRole} 
                  onChange={(e) => setNewRole(e.target.value as any)}
                  disabled={creatingUser || !!createUserSuccess}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#153472] bg-white cursor-pointer disabled:bg-gray-100"
                >
                  <option value="operator">Operator</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </select>
              </div>

              {/* Success Message Banner */}
              {createUserSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                  <span>{createUserSuccess}</span>
                </div>
              )}

              {/* Error Message Banner */}
              {createUserError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-800 rounded-md text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertTriangle size={16} className="text-red-600 shrink-0" />
                  <span>{createUserError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2.5 mt-2 pt-2 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddUserModal(false)}
                  disabled={creatingUser}
                  className="px-4 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 rounded hover:bg-gray-200 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creatingUser || !!createUserSuccess}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-[#153472] rounded hover:bg-blue-900 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Creating User...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default SecurityTab;
