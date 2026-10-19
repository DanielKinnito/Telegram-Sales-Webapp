import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Calendar,
  Clock,
  Phone,
  User,
  Plus,
  Loader2,
  CheckCircle2,
  BellRing,
  ShieldCheck,
  FileText,
  BadgePercent,
  XCircle,
  Trophy,
  Zap,
  ArrowRight,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api, type DealItem, type ActivityItem, type InventoryItem, type LineItem } from '../lib/api';
import { triggerHaptic } from '../lib/telegram';

interface CompanyDetailModalProps {
  deal: DealItem;
  onClose: () => void;
  onOpenPaymentModal: () => void;
  onDealUpdated?: (updatedDeal: DealItem) => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  deal,
  onClose,
  onOpenPaymentModal,
  onDealUpdated,
}) => {
  const [currentDeal, setCurrentDeal] = useState<DealItem>(deal);
  const [activeTab, setActiveTab] = useState<'notes' | 'offer' | 'call' | 'lost'>('notes');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Won / Completion State
  const [isCompletingDeal, setIsCompletingDeal] = useState(false);

  // Proposed Offer State
  const [equipmentType, setEquipmentType] = useState(deal.productType || '');
  const [offerAmount, setOfferAmount] = useState<string>(
    deal.offerAmount ? String(deal.offerAmount) : deal.amount ? String(deal.amount) : ''
  );
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [activeDropdownIndex, setActiveDropdownIndex] = useState<number | null>(null);
  const [expandedSpecsIndex, setExpandedSpecsIndex] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    if (deal.lineItems && deal.lineItems.length > 0) {
      return deal.lineItems;
    }
    const initialPrice = deal.offerAmount
      ? Math.round(deal.offerAmount / 1.15)
      : deal.amount
      ? Math.round(deal.amount / 1.15)
      : 0;
    return [
      {
        itemNo: 1,
        itemCode: '',
        productName: deal.productType || '',
        productDescription: '',
        quantity: 1,
        unitPrice: initialPrice,
        totalPrice: initialPrice,
      },
    ];
  });

  // Lost Deal State
  const [lostReason, setLostReason] = useState(deal.lostReason || '');
  const [isSubmittingLost, setIsSubmittingLost] = useState(false);

  // New Note State
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Call Scheduler State
  const todayStr = new Date().toISOString().split('T')[0]!;
  const [callDate, setCallDate] = useState(todayStr);
  const [callTime, setCallTime] = useState('10:00');
  const [callObjective, setCallObjective] = useState('');
  const [isSchedulingCall, setIsSchedulingCall] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const displayName = currentDeal.companyName || currentDeal.title.replace(/ Order$/, '');

  useEffect(() => {
    loadActivities();
    api.getCatalog()
      .then((res) => {
        if (res?.catalog) setCatalog(res.catalog);
      })
      .catch((err) => console.warn('Could not load inventory catalog:', err.message));
  }, [currentDeal.pageId]);

  const handleItemChange = (index: number, field: keyof LineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index]!, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Math.max(1, Number(value) || 1) : item.quantity;
        const price = field === 'unitPrice' ? Math.max(0, Number(value) || 0) : item.unitPrice;
        item.quantity = qty;
        item.unitPrice = price;
        item.totalPrice = qty * price;
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleSelectCatalogItem = (index: number, catItem: InventoryItem) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const current = updated[index]!;
      const qty = current.quantity || 1;
      updated[index] = {
        ...current,
        itemCode: catItem.itemCode,
        productName: catItem.productName,
        productDescription: catItem.productDescription,
        unitPrice: catItem.unitPrice,
        totalPrice: catItem.unitPrice * qty,
      };
      return updated;
    });
    setActiveDropdownIndex(null);
    triggerHaptic('light');
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        itemNo: prev.length + 1,
        itemCode: '',
        productName: '',
        productDescription: '',
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
      },
    ]);
    triggerHaptic('medium');
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((item, idx) => ({ ...item, itemNo: idx + 1 }))
    );
    triggerHaptic('light');
  };

  const subtotalBeforeVat = lineItems.reduce(
    (acc, curr) => acc + (curr.totalPrice ?? ((curr.quantity || 1) * (curr.unitPrice || 0))),
    0
  );
  const vatAmount = Math.round(subtotalBeforeVat * 0.15);
  const calculatedGrandTotal = subtotalBeforeVat + vatAmount;

  const loadActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const res = await api.getActivities(currentDeal.pageId, displayName);
      setActivities(res.activities || []);
    } catch (err: any) {
      console.warn('Could not load activities:', err.message);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleMarkWon = async () => {
    setIsCompletingDeal(true);
    triggerHaptic('medium');

    try {
      const res = await api.updateDealStage(currentDeal.pageId, {
        stage: 'Won',
      });
      triggerHaptic('success');
      const updated = { ...currentDeal, ...res.deal, stage: 'Won' as const };
      setCurrentDeal(updated);
      if (onDealUpdated) onDealUpdated(updated);
      setNotification({
        type: 'success',
        message: '🎉 Deal marked as Completed & moved to WON pipeline!',
      });
      loadActivities();
    } catch (err: any) {
      triggerHaptic('error');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to complete deal.',
      });
    } finally {
      setIsCompletingDeal(false);
    }
  };

  const handleSubmitOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryName =
      lineItems
        .map((i) => i.productName.trim())
        .filter(Boolean)
        .join(' + ') || equipmentType.trim();

    if (!primaryName) {
      setNotification({
        type: 'error',
        message: 'Please specify at least one product name in the quote.',
      });
      return;
    }

    const finalAmount =
      calculatedGrandTotal > 0
        ? calculatedGrandTotal
        : parseFloat(offerAmount.replace(/,/g, ''));

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid numeric offer amount.',
      });
      return;
    }

    setIsSubmittingOffer(true);
    triggerHaptic('medium');

    try {
      const res = await api.submitProposedOffer(currentDeal.pageId, {
        productType: primaryName,
        offerAmount: finalAmount,
        lineItems,
        companyName: displayName,
      });

      triggerHaptic('success');
      const updated = {
        ...currentDeal,
        ...res.deal,
        productType: primaryName,
        offerAmount: finalAmount,
        amount: finalAmount,
        lineItems,
      };
      setCurrentDeal(updated);
      setEquipmentType(primaryName);
      setOfferAmount(finalAmount.toLocaleString());
      if (onDealUpdated) onDealUpdated(updated);
      setNotification({
        type: 'success',
        message: `Proposal saved: ${primaryName} for ${finalAmount.toLocaleString()} ETB (15% VAT incl.)!`,
      });
      loadActivities();
    } catch (err: any) {
      triggerHaptic('error');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to submit offer.',
      });
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleMarkLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostReason.trim()) {
      setNotification({
        type: 'error',
        message: 'Please provide a reason for the lost deal.',
      });
      return;
    }

    setIsSubmittingLost(true);
    triggerHaptic('warning');

    try {
      const res = await api.updateDealStage(currentDeal.pageId, {
        stage: 'Lost',
        reason: lostReason.trim(),
      });

      triggerHaptic('success');
      const updated = {
        ...currentDeal,
        ...res.deal,
        stage: 'Lost' as const,
        lostReason: lostReason.trim(),
      };
      setCurrentDeal(updated);
      if (onDealUpdated) onDealUpdated(updated);
      setNotification({
        type: 'success',
        message: 'Deal has been marked as Lost and moved to the Lost pipeline.',
      });
      loadActivities();
    } catch (err: any) {
      triggerHaptic('error');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to mark deal as lost.',
      });
    } finally {
      setIsSubmittingLost(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setIsSavingNote(true);
    triggerHaptic('medium');

    try {
      const res = await api.addActivity(currentDeal.pageId, {
        type: 'Note',
        content: noteContent.trim(),
        companyName: displayName,
        contactPerson: currentDeal.contactPerson || undefined,
        contactPhone: currentDeal.contactPhone || undefined,
      });

      triggerHaptic('success');
      setActivities((prev) => [res.activity, ...prev]);
      setNoteContent('');
      setNotification({
        type: 'success',
        message: 'Progress note recorded in CRM timeline.',
      });
      setTimeout(() => setNotification(null), 4000);
    } catch (err: any) {
      triggerHaptic('error');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to save note.',
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleScheduleCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callObjective.trim()) return;

    setIsSchedulingCall(true);
    triggerHaptic('medium');

    try {
      const res = await api.addActivity(currentDeal.pageId, {
        type: 'Call',
        content: callObjective.trim(),
        scheduledDate: callDate,
        scheduledTime: callTime,
        companyName: displayName,
        contactPerson: currentDeal.contactPerson || undefined,
        contactPhone: currentDeal.contactPhone || undefined,
      });

      triggerHaptic('success');
      setActivities((prev) => [res.activity, ...prev]);
      setCallObjective('');
      setNotification({
        type: 'success',
        message: `Call scheduled for ${callDate}! The Telegram Bot will send a reminder notification.`,
      });
      setTimeout(() => setNotification(null), 6000);
    } catch (err: any) {
      triggerHaptic('error');
      setNotification({
        type: 'error',
        message: err.message || 'Failed to schedule call.',
      });
    } finally {
      setIsSchedulingCall(false);
    }
  };

  const handleDownloadInvoice = async () => {
    setIsDownloadingPdf(true);
    triggerHaptic('medium');
    try {
      await api.downloadProformaInvoice(currentDeal.pageId, displayName);
      triggerHaptic('success');
      setNotification({
        type: 'success',
        message: '📄 Proforma Invoice sent to your Telegram chat!',
      });
      setTimeout(() => setNotification(null), 5000);
    } catch (err: any) {
      triggerHaptic('error');
      setNotification({
        type: 'error',
        message: `Failed: ${err.message}`,
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-black/10 dark:border-white/10 flex items-start justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0071e3]">
                <Building2 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight">
                {displayName}
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${
                  currentDeal.stage === 'Won'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                    : currentDeal.stage === 'Lost'
                    ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                    : 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40'
                }`}
              >
                {currentDeal.stage}
              </span>
              {currentDeal.tin && (
                <span className="text-[11px] font-mono text-[#86868b]">
                  TIN: {currentDeal.tin}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Notification Toast */}
          {notification && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center space-x-2 animate-in fade-in duration-200 ${
                notification.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40'
                  : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800/40'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notification.message}</span>
            </div>
          )}

          {/* Contact & Broker Profile Card */}
          <div className="p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Contact Person */}
              <div>
                <span className="text-[11px] text-[#86868b] flex items-center space-x-1 mb-0.5">
                  <User className="w-3 h-3" />
                  <span>Key Contact</span>
                </span>
                <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] block">
                  {currentDeal.contactPerson || 'Direct Company Inquiry'}
                </span>
                {currentDeal.contactPhone && (
                  <a
                    href={`tel:${currentDeal.contactPhone}`}
                    className="inline-flex items-center space-x-1 text-[11px] text-[#0071e3] hover:underline mt-0.5 font-medium"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{currentDeal.contactPhone}</span>
                  </a>
                )}
              </div>

              {/* Address / Location */}
              {currentDeal.address && (
                <div>
                  <span className="text-[11px] text-[#86868b] block mb-0.5">Location</span>
                  <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block truncate">
                    {currentDeal.address}
                  </span>
                </div>
              )}
            </div>

            {/* Equipment or Offer Summary if recorded */}
            {(currentDeal.productType || currentDeal.amount) && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[11px] text-[#86868b] block">Proposed Equipment</span>
                  <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                    {currentDeal.productType || 'Standard Equipment'}
                  </span>
                </div>
                {currentDeal.amount != null && (
                  <div className="text-right">
                    <span className="text-[11px] text-[#86868b] block">Offer (VAT Incl.)</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {Number(currentDeal.amount).toLocaleString()} ETB
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Third-Party Commission Section */}
            {currentDeal.isCommission && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-start space-x-2">
                <BadgePercent className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    Third-Party Commission Deal
                  </span>
                  <div className="text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5">
                    Beneficiary: <span className="font-medium text-[#1d1d1f] dark:text-white">{currentDeal.beneficiaryName || 'Registered Intermediary'}</span>
                    {currentDeal.beneficiaryPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${currentDeal.beneficiaryPhone}`} className="text-[#0071e3] hover:underline font-mono">
                          {currentDeal.beneficiaryPhone}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Action Row: WON DEAL / Deal Completed CTA */}
          {currentDeal.stage === 'Won' ? (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs">
              <div className="flex items-center space-x-2 text-emerald-800 dark:text-emerald-300 font-bold">
                <Trophy className="w-4 h-4 text-emerald-600" />
                <span>Deal Completed & Won</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={isDownloadingPdf}
                  onClick={handleDownloadInvoice}
                  className="px-2.5 py-1 rounded-xl bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] font-semibold text-[11px] apple-press flex items-center space-x-1 disabled:opacity-50"
                  title="Download Proforma Invoice PDF"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  <span>Proforma PDF</span>
                </button>
                {currentDeal.proofUrl ? (
                  <a
                    href={currentDeal.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold underline flex items-center space-x-1"
                  >
                    <span>Receipt</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenPaymentModal}
                    className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-medium text-[11px] apple-press"
                  >
                    Attach Receipt
                  </button>
                )}
              </div>
            </div>
          ) : currentDeal.stage === 'Lost' ? (
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-xs">
              <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-bold">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Deal Marked as Lost</span>
              </div>
              {currentDeal.lostReason && (
                <span className="text-[11px] text-rose-600 dark:text-rose-400 italic max-w-[200px] truncate">
                  "{currentDeal.lostReason}"
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 text-xs">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#0071e3]" />
                <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold">
                  Deal Actions
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  disabled={isDownloadingPdf}
                  onClick={handleDownloadInvoice}
                  className="px-2.5 py-1.5 rounded-xl bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] font-semibold text-xs apple-press flex items-center space-x-1 disabled:opacity-50"
                  title="Download Proforma Invoice PDF"
                >
                  {isDownloadingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>Proforma PDF</span>
                </button>
                <button
                  type="button"
                  disabled={isCompletingDeal}
                  onClick={handleMarkWon}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs apple-press shadow-xs flex items-center space-x-1 disabled:opacity-50"
                >
                  {isCompletingDeal ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Trophy className="w-3.5 h-3.5" />
                      <span>WON</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    onOpenPaymentModal();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-[#424245] dark:text-[#a1a1a6] font-semibold text-xs apple-press"
                >
                  {currentDeal.proofUrl ? 'Update Link' : 'Attach Link'}
                </button>
              </div>
            </div>
          )}

          {/* Segmented Mode Switcher (4 Tabs) */}
          <div className="grid grid-cols-4 p-1 rounded-xl bg-black/5 dark:bg-white/10 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('notes');
              }}
              className={`py-2 rounded-lg flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                  : 'text-[#86868b]'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Notes</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('offer');
              }}
              className={`py-2 rounded-lg flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'offer'
                  ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                  : 'text-[#86868b]'
              }`}
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span>Proposed Offer</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('call');
              }}
              className={`py-2 rounded-lg flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'call'
                  ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                  : 'text-[#86868b]'
              }`}
            >
              <BellRing className="w-3 h-3" />
              <span>Call</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('lost');
              }}
              className={`py-2 rounded-lg flex items-center justify-center space-x-1 transition-all ${
                activeTab === 'lost'
                  ? 'bg-white dark:bg-zinc-800 text-rose-600 dark:text-rose-400 shadow-xs font-bold'
                  : 'text-[#86868b]'
              }`}
            >
              <XCircle className="w-3 h-3 text-rose-500" />
              <span>Lost Deal</span>
            </button>
          </div>

          {/* Tab 1: Progress Tracker Notes */}
          {activeTab === 'notes' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <form onSubmit={handleAddNote} className="space-y-2">
                <textarea
                  rows={2}
                  required
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Type progress update note (e.g. Delivered sample catalog to GM, awaiting budget review)..."
                  className="w-full p-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] transition-colors resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingNote || !noteContent.trim()}
                    className="px-4 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 apple-press shadow-xs"
                  >
                    {isSavingNote ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Save Progress Note</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Timeline List */}
              <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
                <h4 className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                  Activity Timeline
                </h4>
                {isLoadingActivities ? (
                  <div className="p-4 text-center text-xs text-[#86868b] flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0071e3]" />
                    <span>Loading timeline...</span>
                  </div>
                ) : activities.length === 0 ? (
                  <p className="p-4 text-center text-xs text-[#86868b]">
                    No progress notes logged yet. Add your first update above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activities.map((act) => (
                      <div
                        key={act.pageId}
                        className="p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/5 dark:border-white/5 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-[#86868b]">
                          <span
                            className={`font-semibold px-2 py-0.5 rounded-full ${
                              act.type === 'Call'
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                            }`}
                          >
                            {act.type}
                          </span>
                          <span>
                            {act.activityDate} {act.scheduledTime ? `at ${act.scheduledTime}` : ''}
                          </span>
                        </div>
                        <p className="text-[#1d1d1f] dark:text-[#f5f5f7] leading-relaxed pt-0.5">
                          {act.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Proposed Offer (Equipment & Multi-Item Price) */}
          {activeTab === 'offer' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-xs">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#1d1d1f] dark:text-[#f5f5f7] flex items-start space-x-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Compose formal equipment quotation with dynamic catalog autocomplete. VAT (15%) and totals are calculated in real time.
                </span>
              </div>

              <form onSubmit={handleSubmitOffer} className="space-y-4">
                {/* Dynamic Line Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                      Quoted Equipment / Line Items ({lineItems.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="px-2.5 py-1 rounded-lg bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] font-semibold text-xs flex items-center space-x-1 apple-press transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {lineItems.map((item, index) => {
                    const filteredCatalog = catalog.filter(
                      (c) =>
                        !item.productName ||
                        c.productName.toLowerCase().includes(item.productName.toLowerCase()) ||
                        c.itemCode.toLowerCase().includes(item.productName.toLowerCase())
                    );
                    const isSpecsOpen = expandedSpecsIndex === index;

                    return (
                      <div
                        key={index}
                        className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-3 relative"
                      >
                        {/* Item Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-blue-500/10 text-[#0071e3] text-[11px] font-bold flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
                              Line Item #{index + 1}
                            </span>
                            {item.itemCode && (
                              <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-mono text-[#86868b]">
                                {item.itemCode}
                              </span>
                            )}
                          </div>
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(index)}
                              className="p-1 rounded-md text-[#86868b] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Product Name Autocomplete */}
                        <div className="relative">
                          <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium text-[11px]">
                            Product / Equipment Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={item.productName}
                            onChange={(e) => {
                              handleItemChange(index, 'productName', e.target.value);
                              setActiveDropdownIndex(index);
                            }}
                            onFocus={() => setActiveDropdownIndex(index)}
                            placeholder="Type to search stock (e.g. YC345GF, ATS, Pump)..."
                            className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3]"
                          />

                          {/* Autocomplete Dropdown */}
                          {activeDropdownIndex === index && filteredCatalog.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 rounded-xl shadow-xl divide-y divide-black/5 dark:divide-white/5">
                              {filteredCatalog.map((cat) => (
                                <button
                                  key={cat.id || cat.itemCode}
                                  type="button"
                                  onClick={() => handleSelectCatalogItem(index, cat)}
                                  className="w-full text-left p-2.5 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-colors flex items-start justify-between space-x-2"
                                >
                                  <div>
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-mono text-[10px] font-bold text-[#0071e3]">
                                        [{cat.itemCode}]
                                      </span>
                                      <span className="font-semibold text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                                        {cat.productName}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-[#86868b] line-clamp-1 mt-0.5">
                                      {cat.productDescription.split('\n')[0]}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                      ETB {cat.unitPrice.toLocaleString()}
                                    </span>
                                    <p className="text-[10px] text-[#86868b]">
                                      Stock: {cat.quantityInStock}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Collapsible Technical Specifications */}
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSpecsIndex(isSpecsOpen ? null : index)
                            }
                            className="text-[11px] font-medium text-[#0071e3] flex items-center space-x-1 hover:underline mb-1"
                          >
                            {isSpecsOpen ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                            <span>
                              {isSpecsOpen
                                ? 'Hide Technical Specifications'
                                : 'Edit Technical Specifications (Optional)'}
                            </span>
                          </button>
                          {isSpecsOpen && (
                            <textarea
                              rows={3}
                              value={item.productDescription || ''}
                              onChange={(e) =>
                                handleItemChange(index, 'productDescription', e.target.value)
                              }
                              placeholder="Engine, alternator, standby/prime ratings, voltage, RPM..."
                              className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[11px] text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] resize-none"
                            />
                          )}
                        </div>

                        {/* Qty & Price */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                          <div>
                            <label className="block text-[#86868b] text-[10px] font-medium mb-1">
                              Qty
                            </label>
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.quantity || 1}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'quantity',
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] font-mono focus:outline-none focus:border-[#0071e3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#86868b] text-[10px] font-medium mb-1">
                              Unit Price (Excl. VAT)
                            </label>
                            <input
                              type="number"
                              min="0"
                              required
                              value={item.unitPrice || 0}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  'unitPrice',
                                  Math.max(0, parseFloat(e.target.value) || 0)
                                )
                              }
                              className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] font-mono focus:outline-none focus:border-[#0071e3]"
                            />
                          </div>
                          <div>
                            <label className="block text-[#86868b] text-[10px] font-medium mb-1">
                              Line Total
                            </label>
                            <div className="w-full h-9 px-2.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] font-mono font-semibold flex items-center justify-end">
                              ETB {((item.quantity || 1) * (item.unitPrice || 0)).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="w-full py-2.5 rounded-xl border border-dashed border-[#0071e3]/30 hover:border-[#0071e3] text-[#0071e3] font-semibold text-xs flex items-center justify-center space-x-1.5 apple-press transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add Another Item</span>
                  </button>
                </div>

                {/* Financial Summary Card */}
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-black/10 dark:border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[#86868b] text-xs">
                    <span>Subtotal (Excl. VAT):</span>
                    <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                      ETB {subtotalBeforeVat.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#86868b] text-xs">
                    <span>VAT (15%):</span>
                    <span className="font-mono text-[#1d1d1f] dark:text-[#f5f5f7]">
                      ETB {vatAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-black/10 dark:border-white/10 flex items-center justify-between font-bold text-sm">
                    <span className="text-[#1d1d1f] dark:text-[#f5f5f7]">Grand Total (VAT Incl.):</span>
                    <span className="font-mono text-[#0071e3]">
                      ETB {calculatedGrandTotal.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Submit & PDF Actions */}
                <button
                  type="submit"
                  disabled={isSubmittingOffer || lineItems.length === 0}
                  className="w-full h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold flex items-center justify-center space-x-2 apple-press shadow-xs disabled:opacity-50"
                >
                  {isSubmittingOffer ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Save & Record Offer</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    type="button"
                    disabled={isDownloadingPdf}
                    onClick={handleDownloadInvoice}
                    className="w-full h-11 rounded-xl bg-[#0071e3]/10 hover:bg-[#0071e3]/20 text-[#0071e3] font-semibold text-xs apple-press flex items-center justify-center space-x-2 disabled:opacity-50 border border-[#0071e3]/20"
                  >
                    {isDownloadingPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#0071e3]" />
                    ) : (
                      <FileText className="w-4 h-4 text-[#0071e3]" />
                    )}
                    <span>Download Official Proforma Invoice (PDF)</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tab 3: Call Scheduler with Bot Reminder */}
          {activeTab === 'call' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="p-3 rounded-xl bg-blue-50 text-[#0071e3] border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40 text-xs flex items-start space-x-2">
                <BellRing className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  When you schedule a call, our Telegram bot will automatically dispatch a reminder alert to you on this date!
                </span>
              </div>

              <form onSubmit={handleScheduleCall} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium">
                    Call Objective / Agenda *
                  </label>
                  <input
                    type="text"
                    required
                    value={callObjective}
                    onChange={(e) => setCallObjective(e.target.value)}
                    placeholder="e.g. Follow up on price quotation & payment terms"
                    className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-[#0071e3]" />
                      <span>Call Date *</span>
                    </label>
                    <input
                      type="date"
                      required
                      min={todayStr}
                      value={callDate}
                      onChange={(e) => setCallDate(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-[#0071e3]" />
                      <span>Time (Optional)</span>
                    </label>
                    <input
                      type="time"
                      value={callTime}
                      onChange={(e) => setCallTime(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSchedulingCall || !callObjective.trim()}
                  className="w-full mt-2 h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold flex items-center justify-center space-x-2 apple-press shadow-xs disabled:opacity-50"
                >
                  {isSchedulingCall ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <BellRing className="w-4 h-4" />
                      <span>Schedule Call & Set Bot Reminder</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Tab 4: Lost Deal Form */}
          {activeTab === 'lost' && (
            <div className="space-y-3.5 animate-in fade-in duration-200 text-xs">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[#1d1d1f] dark:text-[#f5f5f7] flex items-start space-x-2">
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>
                  Marking this deal as Lost moves it from active negotiation to the Lost section. A reason is required for sales review.
                </span>
              </div>

              <form onSubmit={handleMarkLost} className="space-y-3">
                <div>
                  <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-semibold">
                    Reason for Lost Deal *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    placeholder="Specify reason (e.g. Client selected competitor due to lower pricing, project cancelled, or delayed budget)..."
                    className="w-full p-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-rose-500 transition-colors resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingLost || !lostReason.trim()}
                  className="w-full mt-2 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center space-x-2 apple-press shadow-xs disabled:opacity-50"
                >
                  {isSubmittingLost ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Mark as Lost</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
