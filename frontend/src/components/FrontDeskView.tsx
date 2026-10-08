import { useState } from 'react';
import { Send, Loader2, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';
import { api, type AssignWalkInResponse } from '../lib/api';
import { triggerHaptic } from '../lib/telegram';

export const FrontDeskView: React.FC = () => {
  const [companyName, setCompanyName] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('Manufacturing');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<AssignWalkInResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTinChange = (val: string) => {
    const sanitized = val.replace(/\D/g, '').slice(0, 10);
    setTin(sanitized);
    setErrorMessage(null);
  };

  const handleAssignWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      setErrorMessage('Company Name is required.');
      triggerHaptic('error');
      return;
    }

    if (tin.length !== 10) {
      setErrorMessage('TIN must be strictly 10 numeric digits.');
      triggerHaptic('error');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setAssignmentResult(null);
    triggerHaptic('medium');

    try {
      const res = await api.assignWalkIn({
        companyName: companyName.trim(),
        tin,
        address: address.trim() || undefined,
        industry,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });

      triggerHaptic('success');
      setAssignmentResult(res);
      // Reset form
      setCompanyName('');
      setTin('');
      setAddress('');
      setContactName('');
      setContactPhone('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Walk-in assignment failed');
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* View Header */}
      <div>
        <div className="flex items-center space-x-2 text-[#0071e3] dark:text-blue-400 font-semibold text-xs tracking-wider uppercase">
          <UserCheck className="w-4 h-4" />
          <span>Reception Desk Portal</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white mt-1">
          Walk-In & Lead Assignment
        </h2>
        <p className="text-xs text-[#6e6e73] dark:text-zinc-400 mt-1">
          Intake new office visitors. Assigns company leads fairly to the next available sales representative via round-robin.
        </p>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center space-x-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Successful Assignment Result Card */}
      {assignmentResult && (
        <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2 font-bold text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Lead Successfully Assigned & Dispatched</span>
          </div>

          <div className="p-3.5 rounded-xl bg-white/90 dark:bg-black/30 border border-emerald-200 dark:border-emerald-900/30 space-y-1.5 text-xs">
            <div>
              <span className="text-[#6e6e73] dark:text-zinc-400">Company:</span>{' '}
              <span className="font-semibold text-[#1d1d1f] dark:text-white">{assignmentResult.account.companyName}</span>
            </div>
            <div>
              <span className="text-[#6e6e73] dark:text-zinc-400">TIN:</span>{' '}
              <span className="font-mono text-[#1d1d1f] dark:text-white">{assignmentResult.account.tin}</span>
            </div>
            <div>
              <span className="text-[#6e6e73] dark:text-zinc-400">Assigned Sales Rep:</span>{' '}
              <span className="font-semibold text-[#0071e3] dark:text-blue-400">
                {assignmentResult.account.assignedRep.fullName} (ID: {assignmentResult.account.assignedRep.telegramId})
              </span>
            </div>
            <div className="pt-1 flex items-center space-x-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Instant Telegram push notification dispatched to rep's phone.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setAssignmentResult(null)}
            className="text-xs text-[#0071e3] hover:underline font-medium pt-1"
          >
            Intake next visitor
          </button>
        </div>
      )}

      {/* Intake Form */}
      <form onSubmit={handleAssignWalkIn} className="space-y-4 apple-glass-card p-5 rounded-2xl border border-black/10 dark:border-white/10 text-xs shadow-sm">
        {/* Company Name */}
        <div>
          <label className="block text-[#1d1d1f] dark:text-zinc-300 mb-1.5 font-medium">Company Name *</label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Sheger Construction Materials"
            className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
          />
        </div>

        {/* 10-Digit TIN */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[#1d1d1f] dark:text-zinc-300 font-medium">Customer TIN *</label>
            <span
              className={`font-mono text-[11px] ${
                tin.length === 10 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-[#86868b]'
              }`}
            >
              {tin.length}/10 digits
            </span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            required
            value={tin}
            onChange={(e) => handleTinChange(e.target.value)}
            placeholder="0012345678"
            className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] font-mono tracking-wider focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
          />
        </div>

        {/* Industry */}
        <div>
          <label className="block text-[#1d1d1f] dark:text-zinc-300 mb-1.5 font-medium">Industry Sector</label>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
          >
            <option value="Manufacturing">Manufacturing</option>
            <option value="Agriculture">Agriculture & Agro-Processing</option>
            <option value="Renewable Energy">Renewable Energy & Solar</option>
            <option value="Construction">Construction & Infrastructure</option>
            <option value="Wholesale">Wholesale & Trade</option>
            <option value="Services">Corporate Services</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Address */}
        <div>
          <label className="block text-[#1d1d1f] dark:text-zinc-300 mb-1.5 font-medium">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Megenagna Square, Addis Ababa"
            className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
          />
        </div>

        {/* Contact Person Details */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/5 dark:border-white/5">
          <div>
            <label className="block text-[#6e6e73] dark:text-zinc-400 mb-1 font-medium">Contact Person</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Dawit Tadesse"
              className="w-full h-10 px-3 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[#6e6e73] dark:text-zinc-400 mb-1 font-medium">Phone Number</label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+251 9..."
              className="w-full h-10 px-3 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] transition-colors"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || tin.length !== 10}
          className="w-full mt-2 h-12 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-semibold flex items-center justify-center space-x-2 apple-press transition-all shadow-sm active:scale-[0.98]"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Assign to Next Available Rep</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
