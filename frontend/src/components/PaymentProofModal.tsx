import { useState } from 'react';
import { X, ExternalLink, AlertCircle, Loader2, Link2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api, type DealItem } from '../lib/api';
import { triggerHaptic } from '../lib/telegram';

interface PaymentProofModalProps {
  deal: DealItem;
  onClose: () => void;
  onSuccess: (updatedDeal: any) => void;
}

export const PaymentProofModal: React.FC<PaymentProofModalProps> = ({
  deal,
  onClose,
  onSuccess,
}) => {
  const [proofUrl, setProofUrl] = useState(deal.proofUrl || '');
  const [depositRef, setDepositRef] = useState(deal.depositRef || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isValidHttpUrl = (str: string) => {
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleTestLink = () => {
    if (!proofUrl.trim() || !isValidHttpUrl(proofUrl.trim())) {
      setErrorMessage('Please enter a valid web URL starting with https:// or http://');
      triggerHaptic('error');
      return;
    }
    triggerHaptic('light');
    window.open(proofUrl.trim(), '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUrl = proofUrl.trim();
    if (!cleanUrl) {
      setErrorMessage('Bank transaction link is required.');
      triggerHaptic('error');
      return;
    }

    if (!isValidHttpUrl(cleanUrl)) {
      setErrorMessage('Please enter a valid web link starting with https:// or http://');
      triggerHaptic('error');
      return;
    }

    setIsSubmitting(true);
    triggerHaptic('medium');

    try {
      const res = await api.submitPaymentProof(
        deal.pageId,
        cleanUrl,
        depositRef.trim() || undefined
      );

      triggerHaptic('success');
      onSuccess(res.deal);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit payment link.');
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl apple-glass-card border border-black/10 dark:border-white/10 p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#0071e3] dark:text-blue-400 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f] dark:text-white">Bank Payment Link</h3>
              <p className="text-xs text-[#6e6e73] dark:text-zinc-400 mt-0.5">{deal.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 text-[#6e6e73] dark:text-zinc-400 hover:text-[#1d1d1f] dark:hover:text-white flex items-center justify-center apple-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount Pill */}
        <div className="p-3.5 rounded-xl apple-inset flex items-center justify-between">
          <span className="text-xs text-[#6e6e73] dark:text-zinc-400 font-medium">Deal Amount</span>
          <span className="text-sm font-bold font-mono text-[#1d1d1f] dark:text-white">
            {deal.amount ? `${deal.amount.toLocaleString()} ETB` : 'Negotiating / TBD'}
          </span>
        </div>

        {/* Explanatory Banner */}
        <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed space-y-1">
          <div className="flex items-center space-x-1.5 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>SMS or Mobile Banking Share Link</span>
          </div>
          <p>
            Paste the official transaction link from your bank's confirmation SMS (e.g. CBE, Telebirr, Dashen) or tap "Share Receipt" in your banking app to copy the link.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Transaction URL Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[#1d1d1f] dark:text-zinc-300 font-semibold">
                Transaction Share Link *
              </label>
              {proofUrl && isValidHttpUrl(proofUrl) && (
                <button
                  type="button"
                  onClick={handleTestLink}
                  className="text-[11px] text-[#0071e3] dark:text-blue-400 hover:underline flex items-center space-x-1 font-medium"
                >
                  <span>Test Link</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>
            <input
              type="url"
              required
              value={proofUrl}
              onChange={(e) => {
                setProofUrl(e.target.value);
                setErrorMessage(null);
              }}
              placeholder="https://... (Paste official transaction link)"
              className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] font-mono text-xs focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors shadow-inner"
            />
          </div>

          {/* Optional Reference or Bank Name */}
          <div>
            <label className="block text-[#1d1d1f] dark:text-zinc-300 mb-1.5 font-semibold">
              Bank / Reference Note <span className="text-[#86868b] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={depositRef}
              onChange={(e) => setDepositRef(e.target.value)}
              placeholder="Enter bank name or deposit reference number"
              className="w-full h-10 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] text-xs focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
            />
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={isSubmitting || !proofUrl.trim()}
            className="w-full mt-2 h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold flex items-center justify-center space-x-2 apple-press shadow-sm disabled:opacity-50 transition-all active:scale-[0.98]"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Link & Send for Manager Approval</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
