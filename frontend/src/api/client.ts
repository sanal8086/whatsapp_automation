const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (tenantId) {
    headers['X-Tenant-ID'] = tenantId;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errMessage = `Error ${res.status}: ${res.statusText}`;
    let errData = null;
    try {
      errData = await res.json();
      if (typeof errData.detail === 'string') {
        errMessage = errData.detail;
      } else if (errData.detail && typeof errData.detail === 'object') {
        errMessage = errData.detail.message || JSON.stringify(errData.detail);
      }
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errMessage, errData);
  }

  return res.json();
}

export async function apiDownload(endpoint: string, filename: string): Promise<void> {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!res.ok) {
    let errMessage = `Export failed: ${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      errMessage = data.detail || errMessage;
    } catch {
      // non-JSON error body
    }
    throw new Error(errMessage);
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const token = localStorage.getItem('token');
  const tenantId = localStorage.getItem('tenant_id');

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) headers['X-Tenant-ID'] = tenantId;

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    let errMessage = `Error ${res.status}: ${res.statusText}`;
    let errData = null;
    try {
      errData = await res.json();
      errMessage = errData.detail || errMessage;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, errMessage, errData);
  }

  return res.json();
}
