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
  BadgePercent
} from 'lucide-react';
import { api, type DealItem, type ActivityItem } from '../lib/api';
import { triggerHaptic } from '../lib/telegram';

interface CompanyDetailModalProps {
  deal: DealItem;
  onClose: () => void;
  onOpenPaymentModal: () => void;
}

export const CompanyDetailModal: React.FC<CompanyDetailModalProps> = ({
  deal,
  onClose,
  onOpenPaymentModal,
}) => {
  const [activeTab, setActiveTab] = useState<'notes' | 'call'>('notes');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // New Note State
  const [noteContent, setNoteContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Call Scheduler State
  const todayStr = new Date().toISOString().split('T')[0]!;
  const [callDate, setCallDate] = useState(todayStr);
  const [callTime, setCallTime] = useState('10:00');
  const [callObjective, setCallObjective] = useState('');
  const [isSchedulingCall, setIsSchedulingCall] = useState(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const displayName = deal.companyName || deal.title.replace(/ Order$/, '');

  useEffect(() => {
    loadActivities();
  }, [deal.pageId]);

  const loadActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const res = await api.getActivities(deal.pageId, displayName);
      setActivities(res.activities || []);
    } catch (err: any) {
      console.warn('Could not load activities:', err.message);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    setIsSavingNote(true);
    triggerHaptic('medium');

    try {
      const res = await api.addActivity(deal.pageId, {
        type: 'Note',
        content: noteContent.trim(),
        companyName: displayName,
        contactPerson: deal.contactPerson || undefined,
        contactPhone: deal.contactPhone || undefined,
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
      const res = await api.addActivity(deal.pageId, {
        type: 'Call',
        content: callObjective.trim(),
        scheduledDate: callDate,
        scheduledTime: callTime,
        companyName: displayName,
        contactPerson: deal.contactPerson || undefined,
        contactPhone: deal.contactPhone || undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        
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
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-[#0071e3] border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40">
                {deal.stage}
              </span>
              {deal.tin && (
                <span className="text-[11px] font-mono text-[#86868b]">
                  TIN: {deal.tin}
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
                  {deal.contactPerson || 'Direct Company Inquiry'}
                </span>
                {deal.contactPhone && (
                  <a
                    href={`tel:${deal.contactPhone}`}
                    className="inline-flex items-center space-x-1 text-[11px] text-[#0071e3] hover:underline mt-0.5 font-medium"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{deal.contactPhone}</span>
                  </a>
                )}
              </div>

              {/* Address / Location */}
              {deal.address && (
                <div>
                  <span className="text-[11px] text-[#86868b] block mb-0.5">Location</span>
                  <span className="font-medium text-[#1d1d1f] dark:text-[#f5f5f7] block truncate">
                    {deal.address}
                  </span>
                </div>
              )}
            </div>

            {/* Third-Party Commission Section */}
            {deal.isCommission && (
              <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-start space-x-2">
                <BadgePercent className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <span className="font-semibold text-purple-700 dark:text-purple-300">
                    Third-Party Commission Deal
                  </span>
                  <div className="text-[#6e6e73] dark:text-[#a1a1a6] mt-0.5">
                    Beneficiary: <span className="font-medium text-[#1d1d1f] dark:text-white">{deal.beneficiaryName || 'Registered Intermediary'}</span>
                    {deal.beneficiaryPhone && (
                      <>
                        {' · '}
                        <a href={`tel:${deal.beneficiaryPhone}`} className="text-[#0071e3] hover:underline font-mono">
                          {deal.beneficiaryPhone}
                        </a>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Row: Payment Link Trigger */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 text-xs">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#0071e3]" />
              <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">
                {deal.proofUrl ? 'Receipt Link Attached' : 'Attach Deposit Receipt'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                onOpenPaymentModal();
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs apple-press shadow-xs"
            >
              {deal.proofUrl ? 'Update Receipt Link' : 'Attach Link'}
            </button>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-black/5 dark:bg-white/10 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('notes');
              }}
              className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                  : 'text-[#86868b]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Progress Notes</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setActiveTab('call');
              }}
              className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'call'
                  ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                  : 'text-[#86868b]'
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Schedule Call</span>
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
                          <span className={`font-semibold px-2 py-0.5 rounded-full ${
                            act.type === 'Call'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}>
                            {act.type}
                          </span>
                          <span>{act.activityDate} {act.scheduledTime ? `at ${act.scheduledTime}` : ''}</span>
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

          {/* Tab 2: Call Scheduler with Bot Reminder */}
          {activeTab === 'call' && (
            <div className="space-y-3.5 animate-in fade-in duration-200">
              <div className="p-3 rounded-xl bg-blue-50 text-[#0071e3] border border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40 text-xs flex items-start space-x-2">
                <BellRing className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  When you schedule a call, our Telegram bot will automatically dispatch a high-priority reminder alert to you on this date!
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
        </div>
      </div>
    </div>
  );
};
