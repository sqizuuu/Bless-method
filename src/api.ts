import { User, VideoJob, PointTransaction, PointsStatus, SystemStatus } from './types.js';

const TOKEN_KEY = 'bless_method_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    if (isJson) {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } else {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage);
  }

  return (isJson ? await response.json() : null) as T;
}

export const api = {
  // Auth
  async register(email: string, password: string, displayName?: string) {
    const data = await request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    setStoredToken(data.token);
    return data;
  },

  async login(email: string, password: string) {
    const data = await request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    return data;
  },

  async getOAuthConfig() {
    return request<{
      appUrl: string;
      google: { configured: boolean; clientId: string | null; callbackUrl: string };
      discord: { configured: boolean; clientId: string | null; callbackUrl: string };
    }>('/api/auth/oauth-config');
  },

  async getOAuthUrl(provider: 'google' | 'discord') {
    return request<{ url: string; needsConfig?: boolean }>('/api/auth/oauth-url/' + provider);
  },

  async simulateOAuthLogin(provider: 'google' | 'discord', email?: string, displayName?: string) {
    const data = await request<{ token: string; user: User }>('/api/auth/oauth-simulate', {
      method: 'POST',
      body: JSON.stringify({ provider, email, displayName }),
    });
    setStoredToken(data.token);
    return data;
  },

  async getMe() {
    return request<{ user: User }>('/api/auth/me');
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  // Points
  async getPointsStatus() {
    return request<PointsStatus>('/api/points/status');
  },

  async claimWeeklyReward() {
    return request<{ success: boolean; message: string; newBalance: number; transaction: PointTransaction }>(
      '/api/points/claim-weekly',
      { method: 'POST' }
    );
  },

  async getTransactions() {
    return request<PointTransaction[]>('/api/points/transactions');
  },

  // Shop
  async getShopPackages() {
    return request<{
      configured: boolean;
      hasWebhook: boolean;
      packages: any[];
      instructions: string;
    }>('/api/shop/packages');
  },

  async simulateTestPurchase(packageId: string) {
    return request<{
      success: boolean;
      package: any;
      receiptId: string;
      newBalance: number;
      transaction: PointTransaction;
    }>('/api/shop/simulate-test-purchase', {
      method: 'POST',
      body: JSON.stringify({ packageId }),
    });
  },

  // Video Jobs
  async uploadVideo(file: File) {
    const formData = new FormData();
    formData.append('video', file);
    return request<{
      tempFileId: string;
      originalFilename: string;
      metadata: any;
    }>('/api/jobs/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async useSampleClip() {
    return request<{
      tempFileId: string;
      originalFilename: string;
      metadata: any;
    }>('/api/jobs/use-sample', {
      method: 'POST',
    });
  },

  async startJob(params: {
    tempFileId: string;
    originalFilename: string;
    optimizationLevel: string;
    tiktokPreset: boolean;
    aspectRatioMode: string;
    engine?: string;
    processingMode?: string;
    gamingMontagePreset?: boolean;
    optionalFilters?: { unsharp?: boolean; colorBoost?: boolean };
  }) {
    return request<{
      success: boolean;
      job: VideoJob;
      pointCost: number;
      newPointsBalance: number;
    }>('/api/jobs/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getJob(id: string) {
    return request<VideoJob>(`/api/jobs/${id}`);
  },

  async cancelJob(id: string) {
    return request<{ success: boolean; job: VideoJob; newBalance: number }>(`/api/jobs/${id}/cancel`, {
      method: 'POST',
    });
  },

  async deleteJob(id: string) {
    return request<{ success: boolean }>(`/api/jobs/${id}`, {
      method: 'DELETE',
    });
  },

  async getUserJobs() {
    return request<VideoJob[]>('/api/jobs');
  },

  // System
  async getSystemStatus() {
    return request<SystemStatus>('/api/system/status');
  },
};
