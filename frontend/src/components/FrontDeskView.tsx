import { useState, useEffect } from 'react';
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Package,
  Plus,
  Minus,
  RefreshCw,
  Layers,
  ShieldCheck,
  X
} from 'lucide-react';
import { api, type AssignWalkInResponse, type InventoryItem } from '../lib/api';
import { triggerHaptic } from '../lib/telegram';

interface FrontDeskViewProps {
  activeRole?: 'sales_rep' | 'front_desk' | 'manager';
}

export const FrontDeskView: React.FC<FrontDeskViewProps> = ({ activeRole = 'front_desk' }) => {
  const [activeSubTab, setActiveSubTab] = useState<'walk_in' | 'inventory'>('walk_in');

  // --- Walk-In State ---
  const [companyName, setCompanyName] = useState('');
  const [tin, setTin] = useState('');
  const [address, setAddress] = useState('');
  const [industry, setIndustry] = useState('Manufacturing');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false);
  const [assignmentResult, setAssignmentResult] = useState<AssignWalkInResponse | null>(null);
  const [walkInError, setWalkInError] = useState<string | null>(null);

  // --- Inventory State ---
  const [catalog, setCatalog] = useState<InventoryItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [inventoryNotification, setInventoryNotification] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Stock Adjustment & New Item Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'adjust_existing' | 'add_new'>('adjust_existing');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(1);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState<false | 'request' | 'direct'>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Item State
  const [newItemCode, setNewItemCode] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState<number>(0);
  const [newInitialStock, setNewInitialStock] = useState<number>(1);

  useEffect(() => {
    if (activeSubTab === 'inventory') {
      loadCatalog();
    }
  }, [activeSubTab]);

  const loadCatalog = async (forceRefresh = false) => {
    setIsLoadingCatalog(true);
    try {
      const res = await api.getCatalog(forceRefresh);
      if (res?.catalog) {
        setCatalog(res.catalog);
      }
    } catch (err: any) {
      console.warn('Failed to load inventory catalog:', err);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  // Walk-In Handlers
  const handleTinChange = (val: string) => {
    const sanitized = val.replace(/\D/g, '').slice(0, 10);
    setTin(sanitized);
    setWalkInError(null);
  };

  const handleAssignWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      setWalkInError('Company Name is required.');
      triggerHaptic('error');
      return;
    }

    if (tin.length !== 10) {
      setWalkInError('TIN must be strictly 10 numeric digits.');
      triggerHaptic('error');
      return;
    }

    setIsSubmittingWalkIn(true);
    setWalkInError(null);
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
      setCompanyName('');
      setTin('');
      setAddress('');
      setContactName('');
      setContactPhone('');
    } catch (err: any) {
      setWalkInError(err.message || 'Walk-in assignment failed');
      triggerHaptic('error');
    } finally {
      setIsSubmittingWalkIn(false);
    }
  };

  // Inventory Handlers
  const openAdjustmentModal = (
    item?: InventoryItem,
    mode: 'adjust_existing' | 'add_new' = 'adjust_existing'
  ) => {
    setModalMode(mode);
    setSelectedItem(item || (catalog.length > 0 ? catalog[0]! : null));
    setAdjustmentType('add');
    setAdjustmentAmount(1);
    setAdjustmentReason('');
    setNewItemCode('');
    setNewProductName('');
    setNewProductDescription('');
    setNewUnitPrice(0);
    setNewInitialStock(1);
    setModalError(null);
    setIsAdjustmentModalOpen(true);
    triggerHaptic('light');
  };

  const handleStockAdjustmentSubmit = async (mode: 'request' | 'direct') => {
    setModalError(null);

    // MODE 1: PROPOSE OR ADD NEW INVENTORY ITEM
    if (modalMode === 'add_new') {
      if (!newItemCode.trim()) {
        setModalError('Item Code is required (e.g. GF3-30KW).');
        triggerHaptic('error');
        return;
      }
      if (!newProductName.trim()) {
        setModalError('Product Name is required (e.g. 30kW Silent Diesel Generator Set).');
        triggerHaptic('error');
        return;
      }
      if (newInitialStock <= 0) {
        setModalError('Initial Stock units must be at least 1 unit.');
        triggerHaptic('error');
        return;
      }
      if (!adjustmentReason.trim()) {
        setModalError('Please provide a documentation reason or note for this new item.');
        triggerHaptic('error');
        return;
      }

      setIsSubmittingAdjustment(mode);
      triggerHaptic('medium');

      try {
        if (mode === 'direct' && activeRole === 'manager') {
          await api.directAdjustStock({
            isNewItem: true,
            itemCode: newItemCode.trim(),
            productName: newProductName.trim(),
            productDescription: newProductDescription.trim() || undefined,
            unitPrice: newUnitPrice > 0 ? newUnitPrice : undefined,
            newQuantity: newInitialStock,
            reason: adjustmentReason.trim(),
          });
          triggerHaptic('success');
          setInventoryNotification({
            type: 'success',
            title: 'New Product Added Immediately',
            message: `${newProductName.trim()} (${newItemCode.trim().toUpperCase()}) added to Notion inventory with ${newInitialStock} units stock by Manager override.`,
          });
        } else {
          const res = await api.requestStockAdjustment({
            isNewItem: true,
            itemCode: newItemCode.trim(),
            productName: newProductName.trim(),
            productDescription: newProductDescription.trim() || undefined,
            unitPrice: newUnitPrice > 0 ? newUnitPrice : undefined,
            delta: newInitialStock,
            reason: adjustmentReason.trim(),
          });
          triggerHaptic('success');
          setInventoryNotification({
            type: 'success',
            title: 'Dispatched to Executive Managers',
            message: `New item proposal for ${newProductName.trim()} (${newInitialStock} units) forwarded to ${res.managersNotified || 'executive'} manager(s) on Telegram for approval.`,
          });
        }

        setIsAdjustmentModalOpen(false);
        loadCatalog(true);
      } catch (err: any) {
        triggerHaptic('error');
        const errMsg = err.message || 'Failed to submit new product proposal.';
        setModalError(errMsg);
        setInventoryNotification({
          type: 'error',
          title: 'Proposal Failed',
          message: errMsg,
        });
      } finally {
        setIsSubmittingAdjustment(false);
      }
      return;
    }

    // MODE 2: ADJUST EXISTING ITEM
    if (!selectedItem) {
      setModalError('Please select an equipment model from the catalog.');
      return;
    }
    if (adjustmentAmount <= 0) {
      setModalError('Adjustment amount must be at least 1 unit.');
      return;
    }
    if (!adjustmentReason.trim()) {
      setModalError('Please provide a reason or note for this inventory adjustment.');
      return;
    }

    const delta = adjustmentType === 'add' ? adjustmentAmount : -adjustmentAmount;
    setIsSubmittingAdjustment(mode);
    triggerHaptic('medium');

    try {
      if (mode === 'direct' && activeRole === 'manager') {
        await api.directAdjustStock({
          itemCode: selectedItem.itemCode,
          delta,
          reason: adjustmentReason.trim(),
        });
        triggerHaptic('success');
        setInventoryNotification({
          type: 'success',
          title: 'Stock Updated Immediately',
          message: `${selectedItem.productName} stock adjusted by ${delta > 0 ? `+${delta}` : delta} units by Manager override.`,
        });
      } else {
        const res = await api.requestStockAdjustment({
          itemCode: selectedItem.itemCode,
          productName: selectedItem.productName,
          delta,
          reason: adjustmentReason.trim(),
        });
        triggerHaptic('success');
        setInventoryNotification({
          type: 'success',
          title: 'Dispatched to Executive Managers',
          message: `Stock request for ${selectedItem.productName} (${delta > 0 ? `+${delta}` : delta} units) forwarded to ${res.managersNotified || 'executive'} manager(s) on Telegram for approval.`,
        });
      }

      setIsAdjustmentModalOpen(false);
      loadCatalog(true);
    } catch (err: any) {
      triggerHaptic('error');
      const errMsg = err.message || 'Failed to submit stock adjustment.';
      setModalError(errMsg);
      setInventoryNotification({
        type: 'error',
        title: 'Adjustment Failed',
        message: errMsg,
      });
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      {/* View Header with Segmented Navigation */}
      <div className="space-y-3">
        <div>
          <div className="flex items-center space-x-2 text-[#0071e3] dark:text-blue-400 font-semibold text-xs tracking-wider uppercase">
            <UserCheck className="w-4 h-4" />
            <span>Reception Desk & Operations Portal</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-[#1d1d1f] dark:text-white mt-1">
            {activeSubTab === 'walk_in' ? 'Walk-In & Lead Assignment' : 'Stock & Inventory Management'}
          </h2>
          <p className="text-xs text-[#6e6e73] dark:text-zinc-400 mt-1">
            {activeSubTab === 'walk_in'
              ? 'Intake new office visitors. Assigns company leads fairly to the next available sales representative via round-robin.'
              : 'Review live equipment stock and propose inventory adjustments for executive manager approval.'}
          </p>
        </div>

        {/* Top Segmented Tabs */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveSubTab('walk_in');
            }}
            className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeSubTab === 'walk_in'
                ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Walk-In Lead Intake</span>
          </button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setActiveSubTab('inventory');
            }}
            className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeSubTab === 'inventory'
                ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5 text-amber-500" />
            <span>Stock & Inventory</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: WALK-IN LEAD INTAKE                                */}
      {/* ========================================================= */}
      {activeSubTab === 'walk_in' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Error Message */}
          {walkInError && (
            <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center space-x-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{walkInError}</span>
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
                  <span className="font-semibold text-[#1d1d1f] dark:text-white">
                    {assignmentResult.account.companyName}
                  </span>
                </div>
                <div>
                  <span className="text-[#6e6e73] dark:text-zinc-400">TIN:</span>{' '}
                  <span className="font-mono text-[#1d1d1f] dark:text-white">{assignmentResult.account.tin}</span>
                </div>
                <div>
                  <span className="text-[#6e6e73] dark:text-zinc-400">Assigned Sales Rep:</span>{' '}
                  <span className="font-semibold text-[#0071e3] dark:text-blue-400">
                    {assignmentResult.account.assignedRep.fullName} (ID:{' '}
                    {assignmentResult.account.assignedRep.telegramId})
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
          <form
            onSubmit={handleAssignWalkIn}
            className="space-y-4 apple-glass-card p-5 rounded-2xl border border-black/10 dark:border-white/10 text-xs shadow-sm"
          >
            {/* Company Name */}
            <div>
              <label className="block text-[#1d1d1f] dark:text-zinc-300 mb-1.5 font-medium">
                Company Name *
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
                className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
              />
            </div>

            {/* 10-Digit TIN */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[#1d1d1f] dark:text-zinc-300 font-medium">Customer TIN *</label>
                <span
                  className={`font-mono text-[11px] ${
                    tin.length === 10
                      ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                      : 'text-[#86868b]'
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
                placeholder="Enter 10-digit TIN"
                className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] font-mono tracking-wider focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-[#1d1d1f] dark:text-zinc-300 mb-1.5 font-medium">
                Industry Sector
              </label>
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
                placeholder="Enter company address"
                className="w-full h-11 px-3.5 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] focus:bg-white dark:focus:bg-zinc-900 transition-colors"
              />
            </div>

            {/* Contact Person Details */}
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-black/5 dark:border-white/5">
              <div>
                <label className="block text-[#6e6e73] dark:text-zinc-400 mb-1 font-medium">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Enter contact full name"
                  className="w-full h-10 px-3 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] transition-colors"
                />
              </div>
              <div>
                <label className="block text-[#6e6e73] dark:text-zinc-400 mb-1 font-medium">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+251 900 000 000"
                  className="w-full h-10 px-3 rounded-xl bg-[#fbfbfd] dark:bg-zinc-900 border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-white placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmittingWalkIn || tin.length !== 10}
              className="w-full mt-2 h-12 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white font-semibold flex items-center justify-center space-x-2 apple-press transition-all shadow-sm active:scale-[0.98]"
            >
              {isSubmittingWalkIn ? (
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
      )}

      {/* ========================================================= */}
      {/* TAB 2: STOCK & INVENTORY MANAGEMENT                       */}
      {/* ========================================================= */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-4 animate-in fade-in duration-200 text-xs">
          {/* Notification Banner */}
          {inventoryNotification && (
            <div
              className={`p-4 rounded-2xl border space-y-1 animate-in fade-in ${
                inventoryNotification.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800/40 text-rose-900 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-xs">
                <div className="flex items-center space-x-1.5">
                  {inventoryNotification.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  )}
                  <span>{inventoryNotification.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setInventoryNotification(null)}
                  className="p-1 hover:opacity-70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] leading-relaxed pl-5.5">
                {inventoryNotification.message}
              </p>
            </div>
          )}

          {/* Action Header Card */}
          <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">
                Live Inventory Stock ({catalog.length} Models)
              </span>
              <p className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium text-xs">
                {activeRole === 'manager'
                  ? 'Manage catalog stock balance directly or review requests.'
                  : 'Request stock restock or deduction for manager review.'}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => loadCatalog(true)}
                disabled={isLoadingCatalog}
                className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/10 text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white apple-press transition-colors"
                title="Refresh catalog"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCatalog ? 'animate-spin text-[#0071e3]' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => openAdjustmentModal()}
                className="px-3 py-2 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs flex items-center space-x-1.5 apple-press shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adjust Stock</span>
              </button>
            </div>
          </div>

          {/* Catalog Item Cards */}
          {isLoadingCatalog && catalog.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#86868b] flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#0071e3]" />
              <span>Fetching live catalog from Notion CRM...</span>
            </div>
          ) : catalog.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#86868b] apple-glass-card rounded-2xl">
              No inventory catalog found. Please check Notion database configuration.
            </div>
          ) : (
            <div className="space-y-3">
              {catalog.map((item) => (
                <div
                  key={item.id || item.itemCode}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 space-y-3 shadow-xs"
                >
                  {/* Top Bar: Code, Status, Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-[#0071e3] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40">
                        {item.itemCode}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          item.quantityInStock > 3
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                            : item.quantityInStock > 0
                            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                            : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                        }`}
                      >
                        {item.quantityInStock > 3
                          ? 'In Stock'
                          : item.quantityInStock > 0
                          ? 'Low Stock'
                          : 'Out of Stock'}
                      </span>
                    </div>

                    <span className="font-mono text-xs font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                      ETB {item.unitPrice.toLocaleString()}
                    </span>
                  </div>

                  {/* Product Name & Specs */}
                  <div>
                    <h4 className="font-bold text-sm text-[#1d1d1f] dark:text-[#f5f5f7]">
                      {item.productName}
                    </h4>
                    {item.productDescription && (
                      <p className="text-[11px] text-[#86868b] leading-relaxed mt-1 line-clamp-2 whitespace-pre-line">
                        {item.productDescription}
                      </p>
                    )}
                  </div>

                  {/* Stock Count & Quick Action */}
                  <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs">
                      <span className="text-[#86868b]">Quantity in Stock:</span>
                      <span className="font-mono font-bold text-[#1d1d1f] dark:text-[#f5f5f7] text-sm">
                        {item.quantityInStock} units
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => openAdjustmentModal(item)}
                      className="px-3 py-1.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-[#0071e3]/10 hover:text-[#0071e3] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-xs flex items-center space-x-1.5 apple-press transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Request Edit</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ========================================================= */}
          {/* MODAL: STOCK ADJUSTMENT & NEW ITEM CREATION               */}
          {/* ========================================================= */}
          {isAdjustmentModalOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-[#1c1c1e] rounded-t-3xl sm:rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0071e3]">
                      <Package className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="font-bold text-sm text-[#1d1d1f] dark:text-[#f5f5f7]">
                        {modalMode === 'add_new' ? 'Add New Product to Inventory' : 'Stock Adjustment Request'}
                      </h3>
                      <p className="text-[11px] text-[#86868b]">
                        Manager alert will include full item & stock specifications.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="p-1 rounded-full text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Sub-Tab Toggle: Adjust Existing vs Add New Item */}
                <div className="grid grid-cols-2 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setModalMode('adjust_existing');
                      setModalError(null);
                      if (!selectedItem && catalog.length > 0) {
                        setSelectedItem(catalog[0]!);
                      }
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                      modalMode === 'adjust_existing'
                        ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-[#0071e3]" />
                    <span>Existing Catalog Item</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic('light');
                      setModalMode('add_new');
                      setModalError(null);
                    }}
                    className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                      modalMode === 'add_new'
                        ? 'bg-white dark:bg-zinc-800 text-[#1d1d1f] dark:text-white shadow-xs font-bold'
                        : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Add New Product</span>
                  </button>
                </div>

                {/* Inline Error Message */}
                {modalError && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                    <span className="leading-tight">{modalError}</span>
                  </div>
                )}

                {/* TAB 1: ADJUST EXISTING INVENTORY ITEM */}
                {modalMode === 'adjust_existing' && (
                  <div className="space-y-4">
                    {/* Item Dropdown Selector */}
                    <div>
                      <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-semibold text-[11px]">
                        Select Equipment Model *
                      </label>
                      <select
                        value={selectedItem?.itemCode || ''}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setModalMode('add_new');
                            return;
                          }
                          const found = catalog.find((i) => i.itemCode === e.target.value);
                          if (found) setSelectedItem(found);
                        }}
                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                      >
                        {catalog.map((i) => (
                          <option key={i.itemCode} value={i.itemCode}>
                            {i.itemCode} — {i.productName} ({i.quantityInStock} in stock)
                          </option>
                        ))}
                        <option value="__add_new__">+ Add New Equipment Model...</option>
                      </select>
                    </div>

                    {/* Selected Item Detail Card */}
                    {selectedItem && (
                      <div className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[#0071e3]">
                            {selectedItem.itemCode}
                          </span>
                          <span className="text-[#86868b] text-[11px]">
                            Current: <strong className="text-[#1d1d1f] dark:text-white">{selectedItem.quantityInStock} units</strong>
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-[#1d1d1f] dark:text-[#f5f5f7]">
                          {selectedItem.productName}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-[#86868b]">
                          <span>Catalog Price: <strong>ETB {selectedItem.unitPrice.toLocaleString()}</strong></span>
                        </div>
                        {selectedItem.productDescription && (
                          <p className="text-[10px] text-[#86868b] line-clamp-1 italic pt-0.5">
                            {selectedItem.productDescription.split('\n')[0]}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Adjustment Mode Segmented Control */}
                    <div>
                      <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-semibold text-[11px]">
                        Adjustment Type *
                      </label>
                      <div className="grid grid-cols-2 p-1 rounded-xl bg-black/[0.05] dark:bg-white/[0.06] text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setAdjustmentType('add')}
                          className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                            adjustmentType === 'add'
                              ? 'bg-emerald-600 text-white shadow-xs font-bold'
                              : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Restock / Add Stock</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjustmentType('deduct')}
                          className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                            adjustmentType === 'deduct'
                              ? 'bg-rose-600 text-white shadow-xs font-bold'
                              : 'text-[#86868b] hover:text-[#1d1d1f] dark:hover:text-white'
                          }`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                          <span>Deduction / Audit</span>
                        </button>
                      </div>
                    </div>

                    {/* Amount & Calculation Preview */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium text-[11px]">
                          Units to {adjustmentType === 'add' ? 'Add' : 'Deduct'} *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#86868b] mb-1 font-medium text-[11px]">
                          New Resulting Stock
                        </label>
                        <div className="w-full h-10 px-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 text-xs font-mono font-bold text-[#0071e3] flex items-center justify-end">
                          {selectedItem
                            ? Math.max(
                                0,
                                selectedItem.quantityInStock +
                                  (adjustmentType === 'add' ? adjustmentAmount : -adjustmentAmount)
                              )
                            : 0}{' '}
                          units
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ADD NEW PRODUCT TO INVENTORY */}
                {modalMode === 'add_new' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-semibold text-[11px]">
                          Item Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={newItemCode}
                          onChange={(e) => setNewItemCode(e.target.value.toUpperCase())}
                          placeholder="e.g. GF3-30KW"
                          className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                        />
                      </div>
                      <div>
                        <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-semibold text-[11px]">
                          Initial Stock to Add *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={newInitialStock}
                          onChange={(e) => setNewInitialStock(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-semibold text-[11px]">
                        Full Product Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        placeholder="e.g. 30kW Silent Diesel Generator Set"
                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium text-[11px]">
                        Catalog Price (ETB)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={newUnitPrice || ''}
                        onChange={(e) => setNewUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                        placeholder="e.g. 750000"
                        className="w-full h-10 px-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs font-mono text-[#1d1d1f] dark:text-[#f5f5f7] focus:outline-none focus:border-[#0071e3]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium text-[11px]">
                        Technical Specifications & Details
                      </label>
                      <textarea
                        rows={2}
                        value={newProductDescription}
                        onChange={(e) => setNewProductDescription(e.target.value)}
                        placeholder="e.g. Standby: 33kVA, Prime: 30kVA, Engine: Yuchai 4-cylinder, 1500 RPM, 50Hz, Soundproof Enclosure..."
                        className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] resize-none"
                      />
                    </div>
                  </div>
                )}

                {/* Reason Input (Common for both) */}
                <div>
                  <label className="block text-[#1d1d1f] dark:text-[#f5f5f7] mb-1 font-medium text-[11px]">
                    Reason / Documentation Note *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder={
                      modalMode === 'add_new'
                        ? 'e.g. Received new shipment from port, registering new product line...'
                        : 'e.g. Received shipment container #2 from Akaki customs, physical stock audit correction...'
                    }
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-xs text-[#1d1d1f] dark:text-[#f5f5f7] placeholder-[#86868b] focus:outline-none focus:border-[#0071e3] resize-none"
                  />
                </div>

                {/* Submit Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    disabled={isSubmittingAdjustment !== false || !adjustmentReason.trim()}
                    onClick={() => handleStockAdjustmentSubmit('request')}
                    className="w-full h-11 rounded-xl bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold flex items-center justify-center space-x-2 apple-press shadow-xs disabled:opacity-50"
                  >
                    {isSubmittingAdjustment === 'request' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send Detailed Alert to Managers</span>
                      </>
                    )}
                  </button>

                  {/* Manager Direct Override Option */}
                  {activeRole === 'manager' && (
                    <button
                      type="button"
                      disabled={isSubmittingAdjustment !== false || !adjustmentReason.trim()}
                      onClick={() => handleStockAdjustmentSubmit('direct')}
                      className="w-full h-10 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] text-[#1d1d1f] dark:text-[#f5f5f7] font-semibold text-xs flex items-center justify-center space-x-1.5 apple-press disabled:opacity-50"
                    >
                      {isSubmittingAdjustment === 'direct' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>
                            {modalMode === 'add_new'
                              ? 'Direct Add Product (Manager)'
                              : 'Direct Stock Override (Manager)'}
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
