import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { fetchServiceDetail, updateServiceDetail } from '../../../services/api';
import { auditLogger } from '../../../services/auditLogger';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface ServiceDetailData {
  provider_name: string;
  contact_info: string;
  last_service_date: string;
  next_service_date: string;
  service_hours: number;
  system_running_hours: number;
  calculated_running_time: number;
  maintenance_notes: string;
  warranty_status: string;
  support_email: string;
}

const ServiceDetailTab: React.FC = () => {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [formData, setFormData] = useState<ServiceDetailData>(() => {
    try {
      const raw = localStorage.getItem('huhtamaki_cached_service_detail');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      provider_name: 'Huhtamaki Engineering & Vision Services',
      contact_info: '+91 22 6789 0000 / Field Support',
      last_service_date: '2026-03-15',
      next_service_date: '2026-09-15',
      service_hours: 1250,
      system_running_hours: 4320,
      calculated_running_time: 4320,
      maintenance_notes: 'Lens calibration verified, optical focus adjusted.',
      warranty_status: 'Active (Extended Coverage)',
      support_email: 'service.india@huhtamaki.com',
    };
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchServiceDetail();
        if (data) {
          setFormData((prev) => ({ ...prev, ...data }));
          try {
            localStorage.setItem('huhtamaki_cached_service_detail', JSON.stringify(data));
          } catch {}
        }
      } catch (err: any) {
        console.warn('Failed to load service detail from DB:', err);
      }
    };
    loadData();
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateServiceDetail(formData);
      setFormData((prev) => ({ ...prev, ...updated }));
      auditLogger.logAction(
        'Service Detail',
        'settings.service_saved',
        `Updated service details for provider: ${formData.provider_name}`,
        { provider: formData.provider_name, last_service: formData.last_service_date }
      );
      setFeedback({ type: 'success', text: 'Service details saved successfully.' });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to save service details.' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl pb-10">
      <h2 className="text-2xl font-bold text-[#153472] mb-2">{t('Service Detail') || 'Service Detail'}</h2>
      <p className="text-sm text-gray-500 mb-8">View service information and maintenance details.</p>

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

      <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Service Provider</label>
            <input 
              type="text" 
              placeholder="Service provider name" 
              value={formData.provider_name}
              onChange={(e) => handleChange('provider_name', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Service Contact</label>
            <input 
              type="text" 
              placeholder="Contact information" 
              value={formData.contact_info}
              onChange={(e) => handleChange('contact_info', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Last Service Date</label>
            <input 
              type="date" 
              value={formData.last_service_date || ''}
              onChange={(e) => handleChange('last_service_date', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472] text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Next Service Date</label>
            <input 
              type="date" 
              value={formData.next_service_date || ''}
              onChange={(e) => handleChange('next_service_date', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472] text-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Service Hours</label>
            <input 
              type="number" 
              placeholder="0" 
              value={formData.service_hours || ''}
              onChange={(e) => handleChange('service_hours', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">System Running Time (hours)</label>
            <input 
              type="text" 
              value={formData.calculated_running_time || formData.system_running_hours || 0}
              disabled
              className="w-full border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm text-gray-600 cursor-not-allowed font-semibold"
            />
          </div>

          {/* Additional Points Below */}
          <hr className="border-gray-200 my-6" />
          <h3 className="text-md font-bold text-gray-700 mb-4">Additional Information</h3>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Maintenance Notes</label>
            <textarea 
              placeholder="Add notes..." 
              rows={3}
              value={formData.maintenance_notes || ''}
              onChange={(e) => handleChange('maintenance_notes', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Warranty Status</label>
            <input 
              type="text" 
              placeholder="e.g., Active until 2027" 
              value={formData.warranty_status || ''}
              onChange={(e) => handleChange('warranty_status', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Support Email</label>
            <input 
              type="email" 
              placeholder="support@example.com" 
              value={formData.support_email || ''}
              onChange={(e) => handleChange('support_email', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#153472]"
            />
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="bg-[#153472] hover:bg-blue-900 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-md shadow-sm transition-colors text-sm flex items-center gap-2"
            >
              {saving && <Loader2 className="animate-spin" size={14} />}
              <span>Save Details</span>
            </button>
          </div>
        </form>
    </div>
  );
};

export default ServiceDetailTab;
