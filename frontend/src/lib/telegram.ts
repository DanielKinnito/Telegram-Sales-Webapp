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

export function getTelegramInitData(): string {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initData) {
    const raw = (window as any).Telegram.WebApp.initData;
    if (raw && raw.length > 10) return raw;
  }
  return DEV_FALLBACK_INIT_DATA;
}

export function getTelegramUser(): TelegramUser {
  if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp?.initDataUnsafe?.user) {
    const u = (window as any).Telegram.WebApp.initDataUnsafe.user;
    return {
      id: u.id,
      firstName: u.first_name || 'Staff',
      lastName: u.last_name || undefined,
      username: u.username || undefined,
    };
  }
  return {
    id: 6191728928,
    firstName: 'Tester',
    lastName: 'One',
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
