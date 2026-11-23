// The base URL of your Django backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api';

import type { AgingReport, Client, Invoice, InvoiceStatus, InvoiceSummary, PaginatedInvoices } from './types';

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || payload.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}

export async function getCurrentUser(token: string) {
  return apiFetch<{ id: string; email: string; role: string | null }>('/auth/me/', token);
}

export async function getInvoices(token: string, page = 1, pageSize = 10, search = '', status = '') {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  return apiFetch<PaginatedInvoices>(`/invoices/?${params}`, token);
}

export async function getClients(token: string) {
  return apiFetch<Client[]>('/clients/', token);
}

export async function createClient(token: string, data: { name: string; email: string }) {
  return apiFetch<Client>('/clients/', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createInvoice(token: string, data: {
  client_id: number;
  status: InvoiceStatus;
  lines: Array<{ item: string; qty: number; price: string }>;
}) {
  return apiFetch<Invoice>('/invoices/', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateInvoiceStatus(token: string, id: number, status: InvoiceStatus) {
  return apiFetch<Invoice>(`/invoices/${id}/`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteInvoice(token: string, id: number) {
  return apiFetch<null>(`/invoices/${id}/`, token, { method: 'DELETE' });
}

export async function getUnpaidAging(token: string) {
  return apiFetch<AgingReport>('/analytics/unpaid-by-age/', token);
}

export async function getInvoiceSummary(token: string) {
  return apiFetch<InvoiceSummary>('/analytics/summary/', token);
}
