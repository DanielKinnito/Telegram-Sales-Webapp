import { ShieldCheck, Sun, Moon } from 'lucide-react';
import type { TelegramUser } from '../lib/telegram';

interface HeaderProps {
  user: TelegramUser;
  activeRole: 'sales_rep' | 'front_desk';
  onRoleChange: (role: 'sales_rep' | 'front_desk') => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  canSwitchRole?: boolean;
  repRoleName?: string;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeRole,
  onRoleChange,
  theme,
  onToggleTheme,
  canSwitchRole = false,
  repRoleName = 'Sales Rep',
}) => {
  return (
    <header className="sticky top-0 z-40 w-full apple-glass px-4 py-2.5 transition-colors">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* User Identity & CRM Sync Status */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-[#0071e3] text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            <span>{user.firstName.charAt(0)}</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="text-sm font-semibold tracking-tight text-[#1d1d1f] dark:text-[#f5f5f7] truncate">
                {user.firstName} {user.lastName || ''}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse shrink-0" />
              <span className="text-[11px] text-[#6e6e73] dark:text-[#a1a1a6] font-medium truncate">
                Notion CRM Connected
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Role Badge or Role Switcher & Theme Toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          {canSwitchRole ? (
            /* Apple Segmented Role Switcher (For Managers only) */
            <div className="apple-segmented flex items-center p-0.5">
              <button
                type="button"
                onClick={() => onRoleChange('sales_rep')}
                className={`px-3 py-1 rounded-full text-xs font-semibold apple-press transition-all ${
                  activeRole === 'sales_rep'
                    ? 'bg-white text-[#1d1d1f] dark:bg-[#323236] dark:text-[#f5f5f7] shadow-xs'
                    : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f]'
                }`}
              >
                Sales Rep
              </button>
              <button
                type="button"
                onClick={() => onRoleChange('front_desk')}
                className={`px-3 py-1 rounded-full text-xs font-semibold apple-press transition-all ${
                  activeRole === 'front_desk'
                    ? 'bg-white text-[#1d1d1f] dark:bg-[#323236] dark:text-[#f5f5f7] shadow-xs'
                    : 'text-[#6e6e73] dark:text-[#a1a1a6] hover:text-[#1d1d1f]'
                }`}
              >
                Front Desk
              </button>
            </div>
          ) : (
            /* Locked Role Pill */
            <div className="px-3 py-1 rounded-full bg-black/[0.05] dark:bg-white/[0.08] border border-black/5 dark:border-white/10 text-xs font-semibold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {repRoleName}
            </div>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Toggle Dark / Light Mode"
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1c1c1e] border border-black/10 dark:border-white/10 text-[#1d1d1f] dark:text-[#f5f5f7] flex items-center justify-center apple-press shadow-xs hover:bg-black/5"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-[#1d1d1f]" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
