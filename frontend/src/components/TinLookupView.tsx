import { useState } from 'react';
import { Search, CheckCircle2, AlertTriangle, Building2, Plus, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import { api, type CheckTinResponse, type RegisterLeadResponse } from '../lib/api';
import { triggerHaptic } from '../lib/telegram';

export const TinLookupView: React.FC = () => {
  const [tin, setTin] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckTinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Registration Form State
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('Manufacturing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredAccounts, setRegisteredAccounts] = useState<RegisterLeadResponse['account'][]>([]);

  const handleTinChange = (val: string) => {
    // Only allow digits up to 10
    const sanitized = val.replace(/\D/g, '').slice(0, 10);
    setTin(sanitized);
    setCheckResult(null);
    setErrorMessage(null);
  };

  const handleCheckTin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (tin.length !== 10) {
      setErrorMessage('TIN must be exactly 10 numeric digits.');
      triggerHaptic('error');
      return;
    }

    setIsChecking(true);
    setErrorMessage(null);
    setCheckResult(null);
    triggerHaptic('light');

    try {
      const res = await api.checkTin(tin);
      setCheckResult(res);
      if (res.available) {
        triggerHaptic('success');
      } else {
        triggerHaptic('warning');
      }
    } catch (err: any) {
      if (err.data && err.data.available === false) {
        setCheckResult(err.data);
        triggerHaptic('warning');
      } else {
        setErrorMessage(err.message || 'Failed to check TIN');
        triggerHaptic('error');
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleRegisterLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setErrorMessage('Company Name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    triggerHaptic('medium');

    try {
      const res = await api.registerLead({
        companyName: companyName.trim(),
        tin,
        address: address.trim() || undefined,
        industry,
      });

      triggerHaptic('success');
      setRegisteredAccounts((prev) => [res.account, ...prev]);
      setShowRegisterForm(false);
      setCheckResult({
        available: false,
        message: `Registered under ${res.account.owner.fullName} on ${res.account.assignedDate}. Duplicate registration blocked.`,
        conflict: {
          companyName: res.account.companyName,
          ownerName: res.account.owner.fullName,
          assignedDate: res.account.assignedDate,
        },
      });
      setCompanyName('');
      setAddress('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed');
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="p-4 rounded-2xl apple-glass-card space-y-1">
        <div className="flex items-center space-x-2 text-[#0071e3] font-semibold text-xs tracking-wider uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>Client Conflict Verification</span>
        </div>
        <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
          Ethiopian TIN Conflict Engine
        </h2>
        <p className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] leading-relaxed">
          Verify 10-digit Ethiopian Taxpayer Identification Numbers before onboarding clients. Prevents lead overlap between sales reps.
        </p>
      </div>

      {/* TIN Lookup Input Card */}
      <div className="p-5 rounded-2xl apple-glass-card space-y-4">
        <form onSubmit={handleCheckTin} className="space-y-3">
          <label className="block text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
            Client TIN Number (10 Digits)
          </label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              value={tin}
              onChange={(e) => handleTinChange(e.target.value)}
              placeholder="e.g. 0012345678"
              className="w-full h-12 pl-4 pr-14 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] text-base font-mono tracking-widest focus:outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20 transition-all"
            />
            <div className="absolute right-3.5 top-3.5 text-[#86868b] font-mono text-xs">
              {tin.length}/10
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isChecking || tin.length !== 10}
            className="w-full h-12 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:bg-black/[0.06] dark:disabled:bg-white/[0.08] disabled:text-[#86868b] text-white font-semibold text-sm flex items-center justify-center space-x-2 apple-press transition-all shadow-xs disabled:shadow-none"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking CRM Database...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Check TIN Availability</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Lookup Result Box */}
      {checkResult && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          {checkResult.available ? (
            /* Available Result -> Option to Register Client Company */
            <div className="p-5 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800/40 space-y-4 shadow-xs">
              <div className="flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-emerald-900 dark:text-emerald-200">TIN Available for Registration</h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-400/90 mt-0.5">
                    No active rep ownership found for TIN <span className="font-mono font-semibold">{tin}</span>. You can register this company directly.
                  </p>
                </div>
              </div>

              {!showRegisterForm && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setShowRegisterForm(true);
                  }}
                  className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center space-x-2 apple-press shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Client Company Now</span>
                </button>
              )}
            </div>
          ) : (
            /* Conflict / Registered Lead Detected */
            <div className="p-5 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-800/40 space-y-3 shadow-xs">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm text-amber-900 dark:text-amber-200">Ownership Conflict Detected</h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                    {checkResult.message}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/80 dark:bg-black/30 border border-amber-200 dark:border-amber-900/40 space-y-1.5 text-xs">
                <div>
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">Registered Company:</span>{' '}
                  <span className="font-semibold text-[#1d1d1f] dark:text-white">
                    {checkResult.conflict?.companyName || 'Existing Account'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">Account Owner:</span>{' '}
                  <span className="font-semibold text-[#0071e3] dark:text-blue-400">
                    {checkResult.conflict?.ownerName || 'Another Sales Rep'}
                  </span>
                </div>
                <div>
                  <span className="text-[#6e6e73] dark:text-[#a1a1a6]">Registration Date:</span>{' '}
                  <span className="text-[#424245] dark:text-zinc-300">{checkResult.conflict?.assignedDate}</span>
                </div>
              </div>
              <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] italic">
                Rule: Lead ownership is strictly protected. Please coordinate with{' '}
                <span className="font-semibold text-[#1d1d1f] dark:text-white">{checkResult.conflict?.ownerName}</span> for internal transfers.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Registration Modal / Intake Form */}
      {showRegisterForm && (
        <div className="p-5 rounded-2xl apple-glass-card space-y-4 shadow-lg">
          <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
            <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#0071e3]" />
              <span>Register Client Company</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowRegisterForm(false)}
              className="text-xs text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleRegisterLead} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium">Company Name *</label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Awash Agro Industrial PLC"
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3]"
              />
            </div>

            <div>
              <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium">Verified TIN (Locked)</label>
              <input
                type="text"
                disabled
                value={tin}
                className="w-full h-11 px-3.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-[#86868b] font-mono"
              />
            </div>

            <div>
              <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium">Office / Factory Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Bole Subcity, Woreda 03, Addis Ababa"
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3]"
              />
            </div>

            <div>
              <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium">Industry Sector</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
              >
                <option value="Retail">Retail</option>
                <option value="Manufacturing">Manufacturing</option>
                <option value="Technology">Technology & Telecom</option>
                <option value="Services">Services</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold flex items-center justify-center space-x-2 apple-press shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Save Client Company to Pipeline</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Recent Registrations in current session */}
      {registeredAccounts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider">
            Recently Registered Companies
          </h3>
          <div className="space-y-2">
            {registeredAccounts.map((acc) => (
              <div
                key={acc.pageId}
                className="p-3.5 rounded-xl apple-glass-card flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">{acc.companyName}</span>
                  <div className="text-[11px] text-[#86868b] font-mono mt-0.5">TIN: {acc.tin}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-[#0071e3] border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40 font-medium">
                    {acc.owner.fullName}
                  </span>
                  <div className="text-[10px] text-[#86868b] mt-1">{acc.assignedDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
