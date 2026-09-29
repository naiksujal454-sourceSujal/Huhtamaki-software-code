import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  fetchAlertConfigurations, 
  updateAlertConfigurations,
  fetchEmailSettings,
  updateEmailSettings,
  sendTestEmail
} from '../../../services/api';
import { auditLogger } from '../../../services/auditLogger';
import { CheckCircle, AlertTriangle, Loader2, Mail, Send, Bell } from 'lucide-react';

interface AlertItem {
  id?: number;
  alert_key: string;
  label: string;
  is_displayed: boolean;
  is_suppressed: boolean;
  priority: string;
}

const AlertConfigurationTab: React.FC = () => {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email Notification State
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([
    { alert_key: 'scanner', label: 'Scanner Alerts', is_displayed: true, is_suppressed: false, priority: 'Critical' },
    { alert_key: 'plc', label: 'PLC Alerts', is_displayed: true, is_suppressed: false, priority: 'Critical' },
    { alert_key: 'sensor', label: 'Sensor Alerts', is_displayed: true, is_suppressed: false, priority: 'Medium' },
    { alert_key: 'network', label: 'Network Alerts', is_displayed: true, is_suppressed: false, priority: 'High' },
  ]);

  // Load alert configurations and email settings from database
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [alertData, emailData] = await Promise.all([
          fetchAlertConfigurations(),
          fetchEmailSettings().catch(() => null),
        ]);

        if (alertData && alertData.length > 0) {
          const coreKeys = ['scanner', 'plc', 'sensor', 'network'];
          const filtered = alertData.filter((a: any) => coreKeys.includes(a.alert_key));
          if (filtered.length > 0) {
            setAlerts(filtered);
          }
        }

        if (emailData) {
          setEmailEnabled(emailData.enabled ?? true);
          setRecipientEmail(emailData.recipient_email || 'supervisor@huhtamaki.com');
          setTestEmailTarget(emailData.recipient_email || 'supervisor@huhtamaki.com');
        }
      } catch (err: any) {
        console.warn('Could not load alert settings from DB:', err);
      }
    };
    loadAll();
  }, []);

  const handleToggle = (key: string, field: 'is_displayed' | 'is_suppressed') => {
    setAlerts(alerts.map((a) => (a.alert_key === key ? { ...a, [field]: !a[field] } : a)));
  };

  const handlePriority = (key: string, priority: string) => {
    setAlerts(alerts.map((a) => (a.alert_key === key ? { ...a, priority } : a)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateAlertConfigurations(alerts),
        updateEmailSettings({
          enabled: emailEnabled,
          recipient_email: recipientEmail,
        }),
      ]);

      auditLogger.logAction(
        'Alert Configuration',
        'settings.alerts_saved',
        'Updated alert policies and email notification settings',
        { alerts_count: alerts.length, recipient_email: recipientEmail }
      );
      setFeedback({ type: 'success', text: 'Alert and Email configuration saved successfully.' });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save configuration.' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    const target = testEmailTarget.trim() || recipientEmail.trim();
    if (!target) {
      setEmailFeedback({ type: 'error', text: 'Please enter a valid email address to test.' });
      return;
    }

    setSendingTestEmail(true);
    setEmailFeedback(null);
    try {
      const res = await sendTestEmail(target);
      setEmailFeedback({
        type: 'success',
        text: res.message || `Test email sent successfully to ${target}`,
      });
      auditLogger.logAction('Alert Email', 'email.test_sent', `Sent test alert email to ${target}`, { recipient: target });
    } catch (err: any) {
      setEmailFeedback({
        type: 'error',
        text: err.message || 'Failed to send test email. Check server logs.',
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  return (
    <div className="max-w-4xl pb-10">
      <h2 className="text-2xl font-bold text-[#153472] mb-2">{t('Alert Configuration') || 'Alert Configuration'}</h2>
      <p className="text-sm text-gray-500 mb-8">Configure alert display, suppression, priority settings, and email notifications.</p>

      {feedback && (
        <div className={`mb-6 p-3 rounded-md border flex items-center gap-2 text-xs font-bold ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="flex gap-4 mb-8">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-md p-4">
          <div className="text-xs font-bold text-gray-400 mb-1">Total alert channels</div>
          <div className="text-2xl font-bold text-gray-800">{alerts.length}</div>
        </div>
        <div className="flex-1 bg-amber-50 border border-amber-200 rounded-md p-4">
          <div className="text-xs font-bold text-amber-500 mb-1">Email Alerts</div>
          <div className="text-2xl font-bold text-amber-600">{emailEnabled ? 'ACTIVE' : 'MUTED'}</div>
        </div>
      </div>

      {/* Alert Policy Management Table */}
      <h3 className="text-md font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Bell size={18} className="text-[#153472]" />
        <span>Hardware & System Alert Channels</span>
      </h3>

      <div className="flex flex-col gap-3 mb-8">
          {alerts.map((alert) => (
            <div key={alert.alert_key} className="flex items-center justify-between border border-gray-200 rounded-md p-4 bg-white shadow-xs hover:shadow transition-shadow">
              <div className="font-bold text-gray-700">{t(alert.label) || alert.label}</div>
              <div className="flex items-center gap-6">
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={alert.is_displayed}
                    onChange={() => handleToggle(alert.alert_key, 'is_displayed')}
                    className="w-4 h-4 text-[#153472] rounded border-gray-300 focus:ring-[#153472]"
                  />
                  <span className="text-sm font-bold text-gray-600">Display</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={alert.is_suppressed}
                    onChange={() => handleToggle(alert.alert_key, 'is_suppressed')}
                    className="w-4 h-4 text-[#153472] rounded border-gray-300 focus:ring-[#153472]"
                  />
                  <span className="text-sm font-bold text-gray-600">Suppress</span>
                </label>

                <select 
                  value={alert.priority}
                  onChange={(e) => handlePriority(alert.alert_key, e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm text-gray-700 focus:outline-none focus:border-[#153472] bg-white min-w-[100px]"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>
          ))}
        </div>

      {/* Email Notification Dispatch Section */}
      <div className="border border-blue-200 rounded-lg p-5 bg-gradient-to-br from-white to-blue-50/40 mb-8 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-100 text-[#153472] rounded-lg">
              <Mail size={18} />
            </div>
            <div>
              <h3 className="text-md font-bold text-gray-800">Email Defect Alert Dispatch</h3>
              <p className="text-xs text-gray-500">Automatically sends email notifications when critical barcode defects halt the line.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-md border border-gray-300 shadow-2xs">
            <input 
              type="checkbox" 
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
              className="w-4 h-4 text-[#153472] rounded border-gray-300 focus:ring-[#153472]"
            />
            <span className="text-xs font-bold text-gray-700">Enable Email Alerts</span>
          </label>
        </div>

        {emailFeedback && (
          <div className={`mb-4 p-3 rounded-md border flex items-center gap-2 text-xs font-bold ${
            emailFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {emailFeedback.type === 'success' ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>{emailFeedback.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Supervisor / Recipient Email Address</label>
            <input 
              type="email" 
              value={recipientEmail} 
              onChange={(e) => {
                setRecipientEmail(e.target.value);
                setTestEmailTarget(e.target.value);
              }}
              placeholder="e.g. operator@huhtamaki.com, supervisor@huhtamaki.com"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#153472] bg-white font-mono"
            />
            <span className="text-[11px] text-gray-400 mt-1 block">Multiple emails can be separated by commas.</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Test Email Dispatch</label>
            <div className="flex gap-2">
              <input 
                type="email" 
                value={testEmailTarget} 
                onChange={(e) => setTestEmailTarget(e.target.value)}
                placeholder="Enter email to receive test"
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-[#153472] bg-white font-mono"
              />
              <button 
                type="button"
                onClick={handleSendTestEmail}
                disabled={sendingTestEmail || !testEmailTarget}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-md shadow-xs transition-colors text-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {sendingTestEmail ? <Loader2 className="animate-spin" size={13} /> : <Send size={13} />}
                <span>Send Test</span>
              </button>
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">Click to test instant email delivery to your inbox.</span>
          </div>
        </div>
      </div>
      
      {/* Save Button */}
      <div className="pt-2">
        <button 
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-[#153472] hover:bg-blue-900 disabled:opacity-50 text-white font-bold py-2.5 px-8 rounded-md shadow-sm transition-colors text-sm flex items-center gap-2 cursor-pointer"
        >
          {saving && <Loader2 className="animate-spin" size={14} />}
          <span>Save Alert & Email Configuration</span>
        </button>
      </div>
    </div>
  );
};

export default AlertConfigurationTab;
