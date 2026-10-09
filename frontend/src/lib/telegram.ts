/**
 * Telegram WebApp Integration & Fallback Provider.
 * Allows running seamlessly inside Telegram Mini App or in standard browser for testing.
 */

// Fallback initData for local testing outside Telegram (using Tester One credentials)
const DEV_FALLBACK_INIT_DATA =
  'auth_date=1791474394&user=%7B%22id%22%3A6191728928%2C%22first_name%22%3A%22Tester%22%2C%22last_name%22%3A%22One%22%7D&hash=07eb3c9a32089e4252c2a43120a0e65bc172c860550d1460dc8469badefdab81';

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName?: string | undefined;
  username?: string | undefined;
}

function isLocalDev(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
}

/**
 * Extracts and parses tgWebAppData directly from URL hash or query params
 * Handles edge cases where window.Telegram.WebApp script takes a frame to bind.
 */
function extractUrlTelegramData(): { initData: string; user: TelegramUser | null } {
  if (typeof window === 'undefined') return { initData: '', user: null };

  let raw = '';
  // Check location hash first (#tgWebAppData=...)
  if (window.location.hash) {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    raw = params.get('tgWebAppData') || '';
  }

  // Check search query (?tgWebAppData=...)
  if (!raw && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    raw = params.get('tgWebAppData') || '';
  }

  if (!raw) return { initData: '', user: null };

  try {
    const dataParams = new URLSearchParams(raw);
    const userJson = dataParams.get('user');
    if (userJson) {
      const u = JSON.parse(decodeURIComponent(userJson));
      return {
        initData: raw,
        user: {
          id: u.id,
          firstName: u.first_name || 'Staff',
          lastName: u.last_name || undefined,
          username: u.username || undefined,
        },
      };
    }
  } catch {
    // Ignore parse error
  }

  return { initData: raw, user: null };
}

export function getTelegramInitData(): string {
  if (typeof window !== 'undefined') {
    // 1. Check official Telegram WebApp SDK
    const sdkRaw = (window as any).Telegram?.WebApp?.initData;
    if (sdkRaw && sdkRaw.length > 10) return sdkRaw;

    // 2. Check URL parameters fallback
    const { initData } = extractUrlTelegramData();
    if (initData && initData.length > 10) return initData;

    // 3. Check sessionStorage cache
    const cached = sessionStorage.getItem('tg_init_data');
    if (cached && cached.length > 10) return cached;
  }

  // Only use Tester One mock in local dev environment
  if (isLocalDev()) {
    return DEV_FALLBACK_INIT_DATA;
  }

  return '';
}

export function getTelegramUser(): TelegramUser {
  if (typeof window !== 'undefined') {
    // 1. Check official Telegram WebApp SDK
    const u = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    if (u && u.id) {
      const userObj: TelegramUser = {
        id: u.id,
        firstName: u.first_name || 'Staff',
        lastName: u.last_name || undefined,
        username: u.username || undefined,
      };
      try {
        sessionStorage.setItem('tg_user', JSON.stringify(userObj));
      } catch {}
      return userObj;
    }

    // 2. Check URL parameters
    const { user: parsedUser, initData } = extractUrlTelegramData();
    if (parsedUser && parsedUser.id) {
      try {
        sessionStorage.setItem('tg_user', JSON.stringify(parsedUser));
        if (initData) sessionStorage.setItem('tg_init_data', initData);
      } catch {}
      return parsedUser;
    }

    // 3. Check sessionStorage
    try {
      const cached = sessionStorage.getItem('tg_user');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Ignore
    }
  }

  // Fallback: only mock Tester One when running on local machine
  if (isLocalDev()) {
    return {
      id: 6191728928,
      firstName: 'Tester',
      lastName: 'One',
    };
  }

  return {
    id: 0,
    firstName: 'Sales',
    lastName: 'Representative',
  };
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning') {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.HapticFeedback) {
    const haptic = (window as any).Telegram.WebApp.HapticFeedback;
    try {
      if (type === 'success' || type === 'error' || type === 'warning') {
        haptic.notificationOccurred(type);
      } else {
        haptic.impactOccurred(type);
      }
    } catch {
      // safe fallback
    }
  }
}

export function expandTelegramViewport() {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
    try {
      (window as any).Telegram.WebApp.ready();
      (window as any).Telegram.WebApp.expand();
    } catch {
      // safe fallback
    }
  }
}
