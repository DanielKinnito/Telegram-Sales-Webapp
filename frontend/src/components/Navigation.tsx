import { Search, Briefcase, UserCheck } from 'lucide-react';
import { triggerHaptic } from '../lib/telegram';

export type TabType = 'tin_lookup' | 'deals' | 'walk_in';

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'tin_lookup' as TabType, label: 'TIN Lookup', icon: Search },
    { id: 'deals' as TabType, label: 'Deals & Proofs', icon: Briefcase },
    { id: 'walk_in' as TabType, label: 'Walk-In Intake', icon: UserCheck },
  ];

  const handleTabClick = (tabId: TabType) => {
    if (activeTab !== tabId) {
      triggerHaptic('light');
      onTabChange(tabId);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-[max(14px,env(safe-area-inset-bottom))] flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm apple-glass rounded-full px-2 py-1 flex items-center justify-around shadow-xl border border-black/10 dark:border-white/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`flex-1 py-1.5 px-2 rounded-full flex flex-col items-center space-y-0.5 apple-press transition-all ${
                isActive
                  ? 'bg-black/[0.06] dark:bg-white/10 text-[#0071e3] dark:text-[#2997ff] font-semibold'
                  : 'text-[#86868b] dark:text-[#a1a1a6] hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#0071e3] dark:text-[#2997ff]' : 'text-current'}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
