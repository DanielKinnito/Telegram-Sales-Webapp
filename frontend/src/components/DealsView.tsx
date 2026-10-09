import { useState, useEffect } from 'react';
import { FileCheck, CheckCircle2, ShieldCheck, ExternalLink, ArrowRight, Loader2, Phone, Calendar, User, ChevronRight } from 'lucide-react';
import { api, type DealItem } from '../lib/api';
import { PaymentProofModal } from './PaymentProofModal';
import { CompanyDetailModal } from './CompanyDetailModal';
import { triggerHaptic } from '../lib/telegram';

export const DealsView: React.FC = () => {
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStageFilter, setActiveStageFilter] = useState<string>('All');
  const [selectedDealForProof, setSelectedDealForProof] = useState<DealItem | null>(null);
  const [selectedDealForDetail, setSelectedDealForDetail] = useState<DealItem | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    api.getDeals()
      .then((res) => {
        if (res.deals) {
          setDeals(res.deals);
        }
      })
      .catch((err) => {
        console.warn('Could not load deals:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const filterStages = ['All', 'Proposal', 'Payment Pending Verification', 'Won', 'New'];

  const filteredDeals = deals.filter((d) => {
    if (activeStageFilter === 'All') return true;
    return d.stage === activeStageFilter;
  });

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case 'New':
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40';
      case 'Proposal':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40';
      case 'Payment Pending Verification':
        return 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';
      case 'Won':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
      default:
        return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    }
  };

  const handleProofSuccess = (updatedDeal: any) => {
    setDeals((prev) =>
      prev.map((d) => (d.pageId === updatedDeal.pageId ? { ...d, ...updatedDeal } : d))
    );
    setSelectedDealForProof(null);
    setSuccessToast(`Payment link saved for "${updatedDeal.title}". Pending Manager Approval.`);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          Deals & Payment Pipeline
        </h2>
        <p className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] mt-1 leading-relaxed">
          Track sales deal progress and attach bank transaction confirmation links for executive review.
        </p>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 text-xs flex items-center space-x-2 animate-in fade-in duration-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Stage Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {filterStages.map((stage) => {
          const isActive = activeStageFilter === stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => {
                setActiveStageFilter(stage);
                triggerHaptic('light');
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all apple-press ${
                isActive
                  ? 'bg-[#1d1d1f] text-white dark:bg-[#f5f5f7] dark:text-[#1d1d1f] shadow-sm'
                  : 'bg-white text-[#424245] border border-black/10 dark:bg-[#1c1c1e] dark:text-[#a1a1a6] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              {stage}
            </button>
          );
        })}
      </div>

      {/* Deal Pipeline Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-[#86868b] text-xs apple-glass-card rounded-2xl flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#0071e3]" />
            <span>Loading pipeline deals from Notion CRM...</span>
          </div>
        ) : filteredDeals.length === 0 ? (
          <div className="p-8 text-center text-[#86868b] text-xs apple-glass-card rounded-2xl space-y-2">
            <p className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">
              {deals.length === 0 ? 'No pipeline deals registered yet.' : `No deals found matching filter "${activeStageFilter}".`}
            </p>
            <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">
              {deals.length === 0
                ? 'Verify a 10-digit TIN in the TIN Lookup tab to register client companies into your pipeline.'
                : 'Try selecting a different stage filter above.'}
            </p>
          </div>
        ) : (
          filteredDeals.map((deal) => (
            <div
              key={deal.pageId}
              onClick={() => {
                setSelectedDealForDetail(deal);
                triggerHaptic('light');
              }}
              className="p-4 rounded-2xl apple-glass-card space-y-3.5 transition-all cursor-pointer hover:border-[#0071e3]/30 apple-press"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-1.5">
                    <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                      {deal.title}
                    </h3>
                    <ChevronRight className="w-3.5 h-3.5 text-[#86868b]" />
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStageBadgeColor(
                        deal.stage
                      )}`}
                    >
                      {deal.stage}
                    </span>
                    {deal.depositRef && (
                      <span className="text-[11px] font-mono text-[#6e6e73] dark:text-[#a1a1a6]">
                        {deal.depositRef}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {deal.amount != null
                      ? `${Number(deal.amount).toLocaleString()}`
                      : 'Negotiating'}
                    {deal.amount != null && (
                      <span className="text-[11px] font-sans font-normal text-[#86868b] ml-1">ETB</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact Person / Quick Information if available */}
              {(deal.contactPerson || deal.tin) && (
                <div className="flex items-center flex-wrap gap-3 text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] pt-0.5">
                  {deal.contactPerson && (
                    <div className="flex items-center space-x-1">
                      <User className="w-3 h-3 text-[#0071e3]" />
                      <span>{deal.contactPerson}</span>
                    </div>
                  )}
                  {deal.contactPhone && (
                    <div className="flex items-center space-x-1 font-mono text-[#0071e3]">
                      <Phone className="w-3 h-3" />
                      <span>{deal.contactPhone}</span>
                    </div>
                  )}
                  {deal.tin && (
                    <span className="font-mono text-[#86868b]">
                      TIN: {deal.tin}
                    </span>
                  )}
                </div>
              )}

              {/* Payment Link Preview if present */}
              {deal.proofUrl && (
                <div className="p-3 rounded-xl apple-inset flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2 text-[#424245] dark:text-[#a1a1a6]">
                    <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7]">Bank Transaction Link Attached</span>
                  </div>
                  <a
                    href={deal.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] text-[#0071e3] hover:underline flex items-center space-x-1 font-medium"
                  >
                    <span>Open Bank Receipt</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Action Button: Attach Bank Link & Progress Details */}
              <div className="pt-0.5 flex items-center justify-between">
                <span className="text-[11px] text-[#0071e3] font-medium flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>Notes & Call Reminders</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDealForProof(deal);
                    triggerHaptic('medium');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white text-xs font-semibold flex items-center space-x-1.5 apple-press shadow-xs"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>
                    {deal.stage === 'Payment Pending Verification' || deal.stage === 'Won'
                      ? 'Update Payment Link'
                      : 'Attach Payment Link'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Company Detail / Progress Notes / Call Scheduler Modal */}
      {selectedDealForDetail && (
        <CompanyDetailModal
          deal={selectedDealForDetail}
          onClose={() => setSelectedDealForDetail(null)}
          onOpenPaymentModal={() => {
            setSelectedDealForProof(selectedDealForDetail);
            setSelectedDealForDetail(null);
          }}
        />
      )}

      {/* Payment Proof Modal Dialog */}
      {selectedDealForProof && (
        <PaymentProofModal
          deal={selectedDealForProof}
          onClose={() => setSelectedDealForProof(null)}
          onSuccess={handleProofSuccess}
        />
      )}
    </div>
  );
};
