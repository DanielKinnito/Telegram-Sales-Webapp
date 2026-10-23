import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Navigation, type TabType } from './components/Navigation';
import { TinLookupView } from './components/TinLookupView';
import { DealsView } from './components/DealsView';
import { FrontDeskView } from './components/FrontDeskView';
import { getTelegramUser, expandTelegramViewport, triggerHaptic } from './lib/telegram';
import { api, type AuthMeResponse } from './lib/api';
import { ShieldAlert, Clock, Loader2, Send } from 'lucide-react';

export function App() {
  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'pending' | 'unauthorized'>(() => {
    try {
      const cached = localStorage.getItem('crm_rep_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.fullName) return 'authorized';
      }
    } catch {}
    return 'checking';
  });

  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem('crm_rep_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.fullName) {
          const cleanFullName = parsed.fullName.split('\n')[0].trim();
          return {
            id: parsed.telegramId || 0,
            firstName: cleanFullName,
            lastName: undefined,
          };
        }
      }
    } catch {}
    return getTelegramUser();
  });

  const [activeRole, setActiveRole] = useState<'sales_rep' | 'front_desk'>(() => {
    try {
      const cached = localStorage.getItem('crm_rep_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.role === 'Front Desk') return 'front_desk';
      }
    } catch {}
    return 'sales_rep';
  });

  const [activeTab, setActiveTab] = useState<TabType>('tin_lookup');
  const [canSwitchRole, setCanSwitchRole] = useState(() => {
    try {
      const cached = localStorage.getItem('crm_rep_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.role === 'Manager') return true;
      }
    } catch {}
    return false;
  });
  const [repRoleName, setRepRoleName] = useState(() => {
    try {
      const cached = localStorage.getItem('crm_rep_profile');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.role) return parsed.role;
      }
    } catch {}
    return 'Sales Rep';
  });

  // Theme State: Default to Light mode primarily
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('twa_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  const fetchCrmProfile = (retryCount = 0) => {
    api.getMe()
      .then((res: AuthMeResponse) => {
        if (res.rep && res.rep.status === 'Active') {
          setRepRoleName(res.rep.role);

          // Persist registered CRM profile in localStorage
          const cleanFullName = res.rep.fullName.split('\n')[0].trim();
          try {
            localStorage.setItem(
              'crm_rep_profile',
              JSON.stringify({
                fullName: cleanFullName,
                role: res.rep.role,
                telegramId: res.user?.id,
              })
            );
          } catch {}

          // Update user display to registered CRM Full Name
          setUser({
            id: res.user?.id || 0,
            firstName: cleanFullName,
            lastName: undefined,
          });

          if (res.rep.role === 'Front Desk') {
            setActiveRole('front_desk');
            setActiveTab('walk_in');
            setCanSwitchRole(false);
          } else if (res.rep.role === 'Manager') {
            setCanSwitchRole(true);
          } else {
            // Standard Sales Rep: strictly restricted from Front Desk
            setActiveRole('sales_rep');
            setActiveTab('tin_lookup');
            setCanSwitchRole(false);
          }
          setAuthStatus('authorized');
        } else if (res.rep && res.rep.status === 'Pending Approval') {
          try {
            localStorage.removeItem('crm_rep_profile');
          } catch {}
          setUser({
            id: res.user?.id || 0,
            firstName: res.rep.fullName,
            lastName: undefined,
          });
          setAuthStatus('pending');
        } else {
          // Unregistered or Inactive staff
          try {
            localStorage.removeItem('crm_rep_profile');
          } catch {}
          setAuthStatus('unauthorized');
        }
      })
      .catch((err) => {
        console.warn('Could not fetch CRM profile:', err);
        if (retryCount < 2) {
          setTimeout(() => fetchCrmProfile(retryCount + 1), 500);
        } else {
          // Check if we have a valid cached active profile
          try {
            const cached = localStorage.getItem('crm_rep_profile');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed.fullName) {
                setUser({
                  id: parsed.telegramId || 0,
                  firstName: parsed.fullName,
                  lastName: undefined,
                });
                setRepRoleName(parsed.role || 'Sales Rep');
                setAuthStatus('authorized');
                return;
              }
            }
          } catch {}
          // Only switch to unauthorized if never authorized to prevent kicking active users during network blips
          setAuthStatus((prev) => (prev === 'authorized' ? 'authorized' : 'unauthorized'));
        }
      });
  };

  useEffect(() => {
    expandTelegramViewport();
    fetchCrmProfile();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCrmProfile();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('twa_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    triggerHaptic('light');
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleRoleChange = (newRole: 'sales_rep' | 'front_desk') => {
    triggerHaptic('medium');
    setActiveRole(newRole);
    if (newRole === 'front_desk') {
      setActiveTab('walk_in');
    } else {
      setActiveTab('tin_lookup');
    }
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-[#000000] text-[#f5f5f7]' : 'bg-[#f5f5f7] text-[#1d1d1f]'} flex flex-col font-sans transition-colors duration-200 selection:bg-blue-600/30`}>
      {/* Apple Frosted Sticky Header (Only visible if checking or authorized) */}
      {authStatus !== 'unauthorized' && authStatus !== 'pending' && (
        <Header
          user={user}
          activeRole={activeRole}
          onRoleChange={handleRoleChange}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          canSwitchRole={canSwitchRole}
          repRoleName={repRoleName}
        />
      )}

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-[max(90px,calc(env(safe-area-inset-bottom)+80px))]">
        {authStatus === 'checking' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#0071e3] flex items-center justify-center shadow-xs">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Connecting to Sales CRM
              </h3>
              <p className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] mt-1 max-w-xs mx-auto">
                Verifying your authorized account in Notion database...
              </p>
            </div>
          </div>
        )}

        {authStatus === 'pending' && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-6 space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center shadow-xs">
              <Clock className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Registration Pending Approval
              </h3>
              <p className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] max-w-xs mx-auto leading-relaxed">
                Welcome, <strong className="text-[#1d1d1f] dark:text-[#f5f5f7]">{user.firstName}</strong>. Your account registration is currently pending manager approval. Please wait for an Executive Manager to approve your access.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setAuthStatus('checking');
                fetchCrmProfile();
              }}
              className="apple-button-primary px-6 py-2.5 rounded-full text-xs font-semibold shadow-xs"
            >
              Check Status Again
            </button>
          </div>
        )}

        {authStatus === 'unauthorized' && (
          <div className="flex flex-col items-center justify-center min-h-[65vh] text-center p-6 space-y-4 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-200 dark:border-rose-800/40 flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
                Access Restricted
              </h3>
              <p className="text-xs text-[#6e6e73] dark:text-[#a1a1a6] max-w-xs mx-auto leading-relaxed">
                This CRM application is strictly restricted to registered and approved team members. Unregistered or unapproved users cannot access the portal.
              </p>
            </div>
            <div className="flex flex-col w-full max-w-xs space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('medium');
                  if ((window as any).Telegram?.WebApp?.openTelegramLink) {
                    (window as any).Telegram.WebApp.openTelegramLink('https://t.me/sales_miniapp_bot');
                  } else {
                    window.open('https://t.me/sales_miniapp_bot', '_blank');
                  }
                }}
                className="apple-button-primary py-3 px-4 rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 shadow-xs"
              >
                <Send className="w-4 h-4" />
                <span>Register via Telegram Bot</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setAuthStatus('checking');
                  fetchCrmProfile();
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-semibold text-[#6e6e73] dark:text-[#a1a1a6] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Retry Verification
              </button>
            </div>
          </div>
        )}

        {authStatus === 'authorized' && (
          <>
            {activeTab === 'tin_lookup' && <TinLookupView />}
            {activeTab === 'deals' && <DealsView />}
            {activeTab === 'walk_in' && (activeRole === 'front_desk' || canSwitchRole) && (
              <FrontDeskView activeRole={canSwitchRole ? 'manager' : activeRole} />
            )}
          </>
        )}
      </main>

      {/* Floating Bottom Navigation (Only visible when authorized) */}
      {authStatus === 'authorized' && (
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          activeRole={canSwitchRole ? 'manager' : activeRole}
        />
      )}
    </div>
  );
}

export default App;
