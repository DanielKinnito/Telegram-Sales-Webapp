import { useEffect, useState } from 'react';
import { Header } from './components/Header';
import { Navigation, type TabType } from './components/Navigation';
import { TinLookupView } from './components/TinLookupView';
import { DealsView } from './components/DealsView';
import { FrontDeskView } from './components/FrontDeskView';
import { getTelegramUser, expandTelegramViewport, triggerHaptic } from './lib/telegram';
import { api, type AuthMeResponse } from './lib/api';

export function App() {
  const [user, setUser] = useState(getTelegramUser());
  const [activeRole, setActiveRole] = useState<'sales_rep' | 'front_desk'>('sales_rep');
  const [activeTab, setActiveTab] = useState<TabType>('tin_lookup');
  const [canSwitchRole, setCanSwitchRole] = useState(false);
  const [repRoleName, setRepRoleName] = useState('Sales Rep');

  // Theme State: Default to Light mode primarily
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('twa_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    expandTelegramViewport();
    setUser(getTelegramUser());

    // Fetch Notion CRM Profile to display true CRM name and enforce role
    api.getMe()
      .then((res: AuthMeResponse) => {
        if (res.rep) {
          setRepRoleName(res.rep.role);

          // Update user display to registered CRM Full Name (e.g. "Tester" instead of raw Telegram account)
          setUser((prev) => ({
            ...prev,
            firstName: res.rep!.fullName,
            lastName: undefined,
          }));

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
        }
      })
      .catch((err) => {
        console.warn('Could not fetch CRM profile:', err);
      });
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
      {/* Apple Frosted Sticky Header */}
      <Header
        user={user}
        activeRole={activeRole}
        onRoleChange={handleRoleChange}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        canSwitchRole={canSwitchRole}
        repRoleName={repRoleName}
      />

      {/* Main View Area with Safe-Area & Max Width centering */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-4 pb-[max(90px,calc(env(safe-area-inset-bottom)+80px))]">
        {activeTab === 'tin_lookup' && <TinLookupView />}
        {activeTab === 'deals' && <DealsView />}
        {activeTab === 'walk_in' && activeRole === 'front_desk' && <FrontDeskView />}
      </main>

      {/* Floating Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        activeRole={canSwitchRole ? 'manager' : activeRole}
      />
    </div>
  );
}

export default App;
