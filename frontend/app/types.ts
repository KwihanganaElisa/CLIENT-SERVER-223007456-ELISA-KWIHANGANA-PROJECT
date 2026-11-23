export type InvoiceStatus = 'draft' | 'unpaid' | 'paid' | 'void';

export type InvoiceLine = {
  item: string;
  qty: number;
  price: string;
};

export type Invoice = {
  id: number;
  client: number;
  client_name: string;
  invoice_no: number;
  total: string;
  status: InvoiceStatus;
  created_at: string;
  lines: InvoiceLine[];
};

export type Client = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type PaginatedInvoices = {
  count: number;
  next: string | null;
  previous: string | null;
  results: Invoice[];
};

export type AgingBucket = {
  key: string;
  label: string;
  count: number;
  total: string;
};

export type AgingReport = {
  total_outstanding: string;
  invoice_count: number;
  buckets: AgingBucket[];
};

export type InvoiceSummary = {
  total_invoices: number;
  total_billed: string;
  paid_total: string;
  outstanding_total: string;
  draft_count: number;
};

