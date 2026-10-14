import { useState, useEffect } from 'react';
import {
  FileCheck,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Phone,
  Calendar,
  User,
  ChevronRight,
  Briefcase,
  Trophy,
  XCircle,
  Clock,
  Zap,
} from 'lucide-react';
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
  const [completingDealId, setCompletingDealId] = useState<string | null>(null);

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

  // Filter chips: All, In Progress, Won, Lost
  const filterStages = ['All', 'In Progress', 'Won', 'Lost'];

  const filteredDeals = deals.filter((d) => {
    if (activeStageFilter === 'All') return true;
    if (activeStageFilter === 'Won') return d.stage === 'Won';
    if (activeStageFilter === 'Lost') return d.stage === 'Lost';
    if (activeStageFilter === 'In Progress') return d.stage !== 'Won' && d.stage !== 'Lost';
    return d.stage === activeStageFilter;
  });

  // Metric counts for Screenshot 4 style dashboard
  const totalCount = deals.length;
  const wonCount = deals.filter((d) => d.stage === 'Won').length;
  const lostCount = deals.filter((d) => d.stage === 'Lost').length;
  const inProgressCount = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Lost').length;

  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case 'Won':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
      case 'Lost':
        return 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40';
      case 'Proposal':
        return 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40';
      case 'Payment Pending Verification':
        return 'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40';
    }
  };

  const handleProofSuccess = (updatedDeal: any) => {
    setDeals((prev) =>
      prev.map((d) => (d.pageId === updatedDeal.pageId ? { ...d, ...updatedDeal } : d))
    );
    setSelectedDealForProof(null);
    setSuccessToast(`Payment receipt saved for "${updatedDeal.title}". Pending Manager Approval.`);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  const handleQuickDealCompleted = async (deal: DealItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletingDealId(deal.pageId);
    triggerHaptic('medium');

    try {
      const res = await api.updateDealStage(deal.pageId, { stage: 'Won' });
      triggerHaptic('success');
      setDeals((prev) =>
        prev.map((d) => (d.pageId === deal.pageId ? { ...d, ...res.deal, stage: 'Won' } : d))
      );
      setSuccessToast(`🎉 "${deal.title}" marked as Deal Completed and moved to WON!`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      triggerHaptic('error');
      setSuccessToast(`Failed to update deal: ${err.message}`);
      setTimeout(() => setSuccessToast(null), 5000);
    } finally {
      setCompletingDealId(null);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7]">
          Deals & Pipeline
        </h2>
        <p className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] mt-1 leading-relaxed">
          Track sales progress, propose generator and pump offers, and complete deals.
        </p>
      </div>

      {/* Modern Notion Overview Cards Grid (matching Screenshot 4 aesthetics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Total Deals Card */}
        <button
          type="button"
          onClick={() => {
            setActiveStageFilter('All');
            triggerHaptic('light');
          }}
          className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all apple-press border ${
            activeStageFilter === 'All'
              ? 'bg-blue-50/80 dark:bg-blue-950/30 border-[#0071e3] shadow-xs'
              : 'bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 hover:border-black/10'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-[#0071e3] dark:text-blue-300 flex items-center justify-center mb-2 shadow-xs">
            <Briefcase className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            All Deals
          </span>
          <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5 font-medium">
            {totalCount} registered
          </span>
        </button>

        {/* Won Deals Card */}
        <button
          type="button"
          onClick={() => {
            setActiveStageFilter('Won');
            triggerHaptic('light');
          }}
          className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all apple-press border ${
            activeStageFilter === 'Won'
              ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 shadow-xs'
              : 'bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 hover:border-black/10'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center mb-2 shadow-xs">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Won Deals
          </span>
          <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5 font-medium">
            {wonCount} won
          </span>
        </button>

        {/* Lost Deals Card */}
        <button
          type="button"
          onClick={() => {
            setActiveStageFilter('Lost');
            triggerHaptic('light');
          }}
          className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all apple-press border ${
            activeStageFilter === 'Lost'
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-500 shadow-xs'
              : 'bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 hover:border-black/10'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center mb-2 shadow-xs">
            <XCircle className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            Lost Deals
          </span>
          <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5 font-medium">
            {lostCount} lost
          </span>
        </button>

        {/* In Progress Card */}
        <button
          type="button"
          onClick={() => {
            setActiveStageFilter('In Progress');
            triggerHaptic('light');
          }}
          className={`p-3.5 rounded-2xl flex flex-col items-center justify-center text-center transition-all apple-press border ${
            activeStageFilter === 'In Progress'
              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-500 shadow-xs'
              : 'bg-white dark:bg-[#1c1c1e] border-black/5 dark:border-white/5 hover:border-black/10'
          }`}
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300 flex items-center justify-center mb-2 shadow-xs">
            <Clock className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
            In Progress
          </span>
          <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5 font-medium">
            {inProgressCount} active
          </span>
        </button>
      </div>

      {/* Success Notification Banner */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/30 text-xs flex items-center space-x-2 animate-in fade-in duration-200 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Stage Filter Chips (All, Won, Lost) */}
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
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all apple-press ${
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
              {deals.length === 0
                ? 'No pipeline deals registered yet.'
                : `No deals found under "${activeStageFilter}".`}
            </p>
            <p className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6]">
              {deals.length === 0
                ? 'Verify a 10-digit TIN in the TIN Lookup tab to register client companies into your pipeline.'
                : 'Try selecting a different filter above.'}
            </p>
          </div>
        ) : (
          filteredDeals.map((deal) => {
            const isWon = deal.stage === 'Won';
            const isLost = deal.stage === 'Lost';
            const isUpdating = completingDealId === deal.pageId;

            return (
              <div
                key={deal.pageId}
                onClick={() => {
                  setSelectedDealForDetail(deal);
                  triggerHaptic('light');
                }}
                className="p-4 rounded-2xl apple-glass-card space-y-3 transition-all cursor-pointer hover:border-[#0071e3]/30 apple-press"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <h3 className="text-sm font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                        {deal.title}
                      </h3>
                      <ChevronRight className="w-3.5 h-3.5 text-[#86868b]" />
                    </div>
                    <div className="flex items-center flex-wrap gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStageBadgeColor(
                          deal.stage
                        )}`}
                      >
                        {deal.stage}
                      </span>
                      {deal.productType && (
                        <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] font-medium flex items-center space-x-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span>{deal.productType}</span>
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
                        <span className="text-[11px] font-sans font-normal text-[#86868b] ml-1">
                          ETB
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Person & TIN */}
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

                {/* Lost Reason if present */}
                {isLost && deal.lostReason && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-700 dark:text-rose-300 text-[11px] italic">
                    Reason: {deal.lostReason}
                  </div>
                )}

                {/* Payment Link Attached indicator */}
                {deal.proofUrl && (
                  <div className="p-2.5 rounded-xl apple-inset flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-[#424245] dark:text-[#a1a1a6]">
                      <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] text-[11px]">
                        Deposit Receipt Attached
                      </span>
                    </div>
                    <a
                      href={deal.proofUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-[#0071e3] hover:underline flex items-center space-x-1 font-medium"
                    >
                      <span>Receipt</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {/* Bottom Card Controls: Deal Completed Button */}
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-[#0071e3] font-medium flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Notes & Details</span>
                  </span>

                  {isWon ? (
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Deal Completed</span>
                    </span>
                  ) : isLost ? (
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center space-x-1 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/30">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Lost Deal</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={(e) => handleQuickDealCompleted(deal, e)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 apple-press shadow-xs disabled:opacity-50"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Deal Completed</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })
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
          onDealUpdated={(updatedDeal) => {
            setDeals((prev) =>
              prev.map((d) => (d.pageId === updatedDeal.pageId ? { ...d, ...updatedDeal } : d))
            );
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
