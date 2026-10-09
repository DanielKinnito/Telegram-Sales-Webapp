import { getTelegramInitData, type TelegramUser } from './telegram';

export interface CheckTinResponse {
  available: boolean;
  message: string;
  conflict?: {
    companyName: string;
    ownerName: string;
    assignedDate: string;
  };
}

export interface RegisterLeadInput {
  companyName: string;
  tin: string;
  address?: string;
  industry?: string;
}

export interface RegisterLeadResponse {
  success: boolean;
  account: {
    pageId: string;
    companyName: string;
    tin: string;
    assignedDate: string;
    owner: {
      telegramId: string;
      fullName: string;
    };
  };
}

export interface AssignWalkInInput {
  companyName: string;
  tin: string;
  address?: string;
  industry?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface AssignWalkInResponse {
  success: boolean;
  account: {
    pageId: string;
    companyName: string;
    tin: string;
    assignedDate: string;
    assignedRep: {
      telegramId: string;
      fullName: string;
    };
  };
  notificationSent: boolean;
}

export interface DealItem {
  pageId: string;
  title: string;
  stage: 'New' | 'Contacted' | 'Proposal' | 'Payment Pending Verification' | 'Won' | 'Lost';
  amount: number | null;
  depositRef?: string | null;
  proofUrl?: string | null;
}

export interface SubmitPaymentProofResponse {
  success: boolean;
  deal: {
    pageId: string;
    title: string;
    stage: string;
    amount: number | null;
    depositRef: string;
    proofUrl: string;
  };
  managersNotified: number;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const initData = getTelegramInitData();
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `tma ${initData}`);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // 1. Leads & TIN Check
  checkTin: async (tin: string): Promise<CheckTinResponse> => {
    return request<CheckTinResponse>('/api/leads/check-tin', {
      method: 'POST',
      body: JSON.stringify({ tin }),
    });
  },

  registerLead: async (input: RegisterLeadInput): Promise<RegisterLeadResponse> => {
    return request<RegisterLeadResponse>('/api/leads/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 2. Queue & Walk-In Assignment
  assignWalkIn: async (input: AssignWalkInInput): Promise<AssignWalkInResponse> => {
    return request<AssignWalkInResponse>('/api/queue/assign', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  // 3. Deals & Payment Proofs (Bank Transaction Share Link)
  submitPaymentProof: async (
    dealId: string,
    proofUrl: string,
    depositRef?: string
  ): Promise<SubmitPaymentProofResponse> => {
    return request<SubmitPaymentProofResponse>(`/api/deals/${dealId}/payment-proof`, {
      method: 'POST',
      body: JSON.stringify({ proofUrl, depositRef }),
    });
  },

  getDeal: async (dealId: string): Promise<{ success: boolean; deal: DealItem }> => {
    return request<{ success: boolean; deal: DealItem }>(`/api/deals/${dealId}`);
  },

  getDeals: async (): Promise<{ success: boolean; deals: DealItem[] }> => {
    return request<{ success: boolean; deals: DealItem[] }>('/api/deals');
  },

  getMe: async (): Promise<AuthMeResponse> => {
    return request<AuthMeResponse>('/api/auth/me');
  },
};

export interface AuthMeResponse {
  success: boolean;
  user: TelegramUser;
  rep?: {
    pageId: string;
    fullName: string;
    role: 'Sales Rep' | 'Front Desk' | 'Manager';
    status: 'Active' | 'Pending Approval' | 'Inactive';
    phone?: string;
  } | null;
}
