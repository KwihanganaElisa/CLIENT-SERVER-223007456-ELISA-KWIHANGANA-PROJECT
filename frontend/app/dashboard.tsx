'use client';

import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  createClient,
  createInvoice,
  deleteInvoice,
  getClients,
  getInvoiceSummary,
  getInvoices,
  getUnpaidAging,
  updateInvoiceStatus,
} from './api';
import { Icon } from './icons';
import type {
  AgingReport,
  Client,
  Invoice,
  InvoiceStatus,
  InvoiceSummary,
  PaginatedInvoices,
} from './types';

type View = 'dashboard' | 'invoices' | 'clients';
type GetToken = () => Promise<string | null>;

const emptyInvoices: PaginatedInvoices = { count: 0, next: null, previous: null, results: [] };
const emptySummary: InvoiceSummary = {
  total_invoices: 0,
  total_billed: '0',
  paid_total: '0',
  outstanding_total: '0',
  draft_count: 0,
};
const emptyAging: AgingReport = { total_outstanding: '0', invoice_count: 0, buckets: [] };

const money = new Intl.NumberFormat('en-RW', {
  style: 'currency',
  currency: 'RWF',
  currencyDisplay: 'code',
  maximumFractionDigits: 0,
});
const date = new Intl.DateTimeFormat('en-RW', { day: '2-digit', month: 'short', year: 'numeric' });

function formatMoney(value: string | number) {
  return money.format(Number(value) || 0);
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  const classes: Record<InvoiceStatus, string> = {
    paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
    unpaid: 'bg-amber-50 text-amber-700 ring-amber-600/15',
    draft: 'bg-slate-100 text-slate-600 ring-slate-500/15',
    void: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${classes[status]}`}>{status}</span>;
}

function Modal({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button aria-label="Close dialog" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className={`relative max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>{children}</div>
    </div>
  );
}

function InvoiceForm({ clients, onClose, onCreated, onAddClient, getToken }: {
  clients: Client[];
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
  onAddClient: () => void;
  getToken: GetToken;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? 0);
  const [status, setStatus] = useState<InvoiceStatus>('unpaid');
  const [lines, setLines] = useState([{ id: 1, item: '', qty: 1, price: '' }]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const total = lines.reduce((sum, line) => sum + line.qty * (Number(line.price) || 0), 0);

  function updateLine(id: number, field: 'item' | 'qty' | 'price', value: string) {
    setLines((current) => current.map((line) => line.id === id ? {
      ...line,
      [field]: field === 'qty' ? Math.max(1, Number(value)) : value,
    } : line));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!clientId) return setError('Choose a client before creating the invoice.');
    if (lines.some((line) => !line.item.trim() || !line.price || Number(line.price) < 0)) {
      return setError('Complete every line item with a description, quantity, and price.');
    }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired. Please log in again.');
      const invoice = await createInvoice(token, {
        client_id: clientId,
        status,
        lines: lines.map(({ item, qty, price }) => ({ item: item.trim(), qty, price })),
      });
      onCreated(invoice);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the invoice.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div><p className="text-sm font-semibold text-blue-600">New document</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Create invoice</h2></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Icon name="close" className="h-5 w-5" /></button>
      </div>
      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Client
            <select value={clientId} onChange={(event) => setClientId(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
              {!clients.length && <option value={0}>No clients available</option>}
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Initial status
            <select value={status} onChange={(event) => setStatus(event.target.value as InvoiceStatus)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-normal text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10">
              <option value="unpaid">Unpaid</option><option value="draft">Draft</option>
            </select>
          </label>
        </div>
        {!clients.length && <button type="button" onClick={onAddClient} className="text-sm font-semibold text-blue-600 hover:text-blue-700">Add your first client</button>}

        <div>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-900">Line items</h3><span className="text-sm text-slate-500">Total is calculated by the server</span></div>
          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={line.id} className="grid grid-cols-[1fr_70px_110px_36px] gap-2 rounded-xl bg-slate-50 p-3">
                <input aria-label={`Item ${index + 1}`} placeholder="Service or item" value={line.item} onChange={(event) => updateLine(line.id, 'item', event.target.value)} className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base outline-none focus:border-blue-500" />
                <input aria-label="Quantity" type="number" min="1" value={line.qty} onChange={(event) => updateLine(line.id, 'qty', event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-base outline-none focus:border-blue-500" />
                <input aria-label="Price" type="number" min="0" step="0.01" placeholder="0.00" value={line.price} onChange={(event) => updateLine(line.id, 'price', event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-base outline-none focus:border-blue-500" />
                <button type="button" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} className="text-slate-400 hover:text-rose-600 disabled:opacity-30"><Icon name="trash" className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setLines((current) => [...current, { id: Date.now(), item: '', qty: 1, price: '' }])} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-600"><Icon name="plus" className="h-4 w-4" /> Add line item</button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-white"><span className="text-sm font-medium text-slate-300">Live total</span><span className="text-2xl font-bold">{formatMoney(total)}</span></div>
        {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">{saving ? 'Creating…' : 'Create invoice'}</button></div>
    </form>
  );
}

function ClientForm({ onClose, onCreated, getToken }: { onClose: () => void; onCreated: (client: Client) => void; getToken: GetToken }) {
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSaving(true);
    const data = new FormData(event.currentTarget);
    try {
      const token = await getToken();
      if (!token) throw new Error('Your session has expired.');
      onCreated(await createClient(token, { name: String(data.get('name')), email: String(data.get('email')) }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not add the client.'); }
    finally { setSaving(false); }
  }
  return <form onSubmit={submit}>
    <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-sm font-semibold text-blue-600">Address book</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Add client</h2></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><Icon name="close" className="h-5 w-5" /></button></div>
    <div className="space-y-4 p-6"><label className="block text-sm font-semibold text-slate-700">Business or client name<input name="name" required className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label><label className="block text-sm font-semibold text-slate-700">Email address<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-base font-normal outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" /></label>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</div>
    <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button disabled={saving} className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Add client'}</button></div>
  </form>;
}

function InvoiceDetail({ invoice, onClose, onStatus, onDelete }: { invoice: Invoice; onClose: () => void; onStatus: (status: InvoiceStatus) => void; onDelete: () => void }) {
  return <Modal onClose={onClose} wide><div className="print-area">
    <div className="flex items-start justify-between border-b border-slate-100 px-7 py-6"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">Invoice</p><h2 className="mt-1 text-3xl font-bold text-slate-950">#{invoice.invoice_no}</h2></div><div className="flex items-center gap-2 no-print"><button onClick={() => window.print()} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Print invoice"><Icon name="print" className="h-5 w-5" /></button><button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close"><Icon name="close" className="h-5 w-5" /></button></div></div>
    <div className="p-7">
      <div className="grid gap-6 border-b border-slate-100 pb-7 sm:grid-cols-3"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill to</p><p className="mt-2 font-semibold text-slate-900">{invoice.client_name}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Issued</p><p className="mt-2 font-semibold text-slate-900">{date.format(new Date(invoice.created_at))}</p></div><div><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Status</p><div className="mt-2"><StatusBadge status={invoice.status} /></div></div></div>
      <div className="mt-7 overflow-hidden rounded-xl border border-slate-200"><table className="w-full"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Qty</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{invoice.lines.map((line, index) => <tr key={`${line.item}-${index}`}><td className="px-4 py-4 font-medium text-slate-800">{line.item}</td><td className="px-4 py-4 text-right text-slate-600">{line.qty}</td><td className="px-4 py-4 text-right text-slate-600">{formatMoney(line.price)}</td><td className="px-4 py-4 text-right font-semibold text-slate-900">{formatMoney(line.qty * Number(line.price))}</td></tr>)}</tbody></table></div>
      <div className="mt-6 flex justify-end"><div className="w-64 rounded-xl bg-slate-900 p-5 text-white"><div className="flex items-center justify-between"><span className="text-sm text-slate-300">Total due</span><span className="text-2xl font-bold">{formatMoney(invoice.total)}</span></div></div></div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 no-print"><button onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"><Icon name="trash" className="h-4 w-4" /> Delete</button><div className="flex flex-wrap gap-2"><span className="self-center text-sm text-slate-500">Change status:</span>{(['draft', 'unpaid', 'paid', 'void'] as InvoiceStatus[]).map((status) => <button key={status} disabled={invoice.status === status} onClick={() => onStatus(status)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold capitalize text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:bg-slate-100 disabled:text-slate-400">{status}</button>)}</div></div>
    </div>
  </div></Modal>;
}

function InvoiceTable({ invoices, loading, onSelect }: { invoices: Invoice[]; loading: boolean; onSelect: (invoice: Invoice) => void }) {
  if (loading) return <div className="space-y-3 p-5">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (!invoices.length) return <div className="grid place-items-center px-6 py-16 text-center"><div className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400"><Icon name="document" className="h-6 w-6" /></div><h3 className="mt-4 font-bold text-slate-900">No invoices found</h3><p className="mt-1 max-w-xs text-sm text-slate-500">Create an invoice or adjust your search and status filters.</p></div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[680px]"><thead><tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wider text-slate-400"><th className="px-6 py-4">Invoice</th><th className="px-4 py-4">Client</th><th className="px-4 py-4">Issued</th><th className="px-4 py-4">Status</th><th className="px-6 py-4 text-right">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={invoice.id} onClick={() => onSelect(invoice)} className="cursor-pointer transition hover:bg-slate-50/80"><td className="px-6 py-4 font-bold text-slate-900">#{invoice.invoice_no}</td><td className="px-4 py-4 font-medium text-slate-700">{invoice.client_name}</td><td className="px-4 py-4 text-sm text-slate-500">{date.format(new Date(invoice.created_at))}</td><td className="px-4 py-4"><StatusBadge status={invoice.status} /></td><td className="px-6 py-4 text-right font-bold text-slate-900">{formatMoney(invoice.total)}</td></tr>)}</tbody></table></div>;
}

export function Dashboard({ email, getToken, onSignOut }: { email: string; getToken: GetToken; onSignOut: () => void }) {
  const [view, setView] = useState<View>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [invoiceData, setInvoiceData] = useState(emptyInvoices);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [aging, setAging] = useState(emptyAging);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [error, setError] = useState('');
  const [invoiceForm, setInvoiceForm] = useState(false);
  const [clientForm, setClientForm] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => { const timeout = window.setTimeout(() => { setPage(1); setAppliedSearch(search); }, 300); return () => window.clearTimeout(timeout); }, [search]);

  const loadInvoices = useCallback(async () => {
    setLoading(true); setError('');
    try { const token = await getToken(); if (!token) return; setInvoiceData(await getInvoices(token, page, 10, appliedSearch, statusFilter)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load invoices.'); }
    finally { setLoading(false); }
  }, [appliedSearch, getToken, page, statusFilter]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true); setError('');
    try {
      const token = await getToken(); if (!token) return;
      const [clientData, report, totals, recent] = await Promise.all([getClients(token), getUnpaidAging(token), getInvoiceSummary(token), getInvoices(token, 1, 5)]);
      setClients(clientData); setAging(report); setSummary(totals); setRecentInvoices(recent.results);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not load the dashboard.'); }
    finally { setOverviewLoading(false); }
  }, [getToken]);

  useEffect(() => { void loadInvoices(); }, [loadInvoices]);
  useEffect(() => { void loadOverview(); }, [loadOverview]);

  async function refresh() { await Promise.all([loadInvoices(), loadOverview()]); }
  function navigate(next: View) { setView(next); setMobileNav(false); }
  async function changeStatus(status: InvoiceStatus) {
    if (!selectedInvoice) return;
    try { const token = await getToken(); if (!token) return; const updated = await updateInvoiceStatus(token, selectedInvoice.id, status); setSelectedInvoice(updated); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update the invoice.'); }
  }
  async function removeInvoice() {
    if (!selectedInvoice || !window.confirm(`Delete invoice #${selectedInvoice.invoice_no}? This cannot be undone.`)) return;
    try { const token = await getToken(); if (!token) return; await deleteInvoice(token, selectedInvoice.id); setSelectedInvoice(null); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not delete the invoice.'); }
  }

  const totalPages = Math.max(1, Math.ceil(invoiceData.count / 10));
  const maxAging = Math.max(...aging.buckets.map((bucket) => Number(bucket.total)), 1);
  const displayName = email.split('@')[0].replace(/[._-]/g, ' ');
  const navItems: Array<{ id: View; label: string; icon: 'dashboard' | 'invoice' | 'clients' }> = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard' }, { id: 'invoices', label: 'Invoices', icon: 'invoice' }, { id: 'clients', label: 'Clients', icon: 'clients' },
  ];

  return <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[#111827] px-4 py-6 text-white transition-transform lg:translate-x-0 ${mobileNav ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center gap-3 px-2"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600"><Icon name="document" className="h-5 w-5" /></div><div><p className="text-lg font-bold">Ledgerly</p><p className="text-xs text-slate-400">Invoice workspace</p></div></div>
      <nav className="mt-10 space-y-1">{navItems.map((item) => <button key={item.id} onClick={() => navigate(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${view === item.id ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><Icon name={item.icon} className="h-5 w-5" />{item.label}</button>)}</nav>
      <div className="mt-auto border-t border-white/10 pt-4"><div className="flex items-center gap-3 rounded-xl px-2 py-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-300">{displayName.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold capitalize">{displayName}</p><p className="text-xs text-slate-400">Owner</p></div><button onClick={onSignOut} title="Log out" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><Icon name="logout" className="h-4 w-4" /></button></div></div>
    </aside>
    {mobileNav && <button className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}

    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur md:px-8">
        <div className="flex items-center gap-3"><button onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-slate-600 lg:hidden"><Icon name="menu" className="h-5 w-5" /></button><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Owner workspace</p><h1 className="text-xl font-bold capitalize text-slate-950">{view === 'dashboard' ? 'Dashboard' : view}</h1></div></div>
        <button onClick={() => setInvoiceForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"><Icon name="plus" className="h-4 w-4" /><span className="hidden sm:inline">New invoice</span></button>
      </header>

      <main className="mx-auto max-w-7xl p-5 md:p-8">
        {error && <div role="alert" className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><button onClick={() => void refresh()} className="font-bold underline">Try again</button></div>}

        {view === 'dashboard' && <>
          <div className="mb-7"><h2 className="text-2xl font-bold text-slate-950">Good day, <span className="capitalize">{displayName}</span></h2><p className="mt-1 text-slate-500">Here is how your invoicing is looking today.</p></div>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Total billed', value: formatMoney(summary.total_billed), note: `${summary.total_invoices} invoices`, icon: 'wallet' as const, color: 'bg-blue-50 text-blue-600' },
              { label: 'Collected', value: formatMoney(summary.paid_total), note: 'Paid invoices', icon: 'check' as const, color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Outstanding', value: formatMoney(summary.outstanding_total), note: `${aging.invoice_count} awaiting payment`, icon: 'clock' as const, color: 'bg-amber-50 text-amber-600' },
              { label: 'Drafts', value: String(summary.draft_count), note: 'Need attention', icon: 'document' as const, color: 'bg-violet-50 text-violet-600' },
            ].map((card) => <article key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{overviewLoading ? '—' : card.value}</p></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${card.color}`}><Icon name={card.icon} className="h-5 w-5" /></div></div><p className="mt-4 text-xs font-medium text-slate-400">{card.note}</p></article>)}
          </section>
          <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex items-center justify-between px-6 py-5"><div><h3 className="font-bold text-slate-950">Recent invoices</h3><p className="mt-1 text-sm text-slate-500">Your latest billing activity</p></div><button onClick={() => navigate('invoices')} className="text-sm font-bold text-blue-600 hover:text-blue-700">View all</button></div><InvoiceTable invoices={recentInvoices} loading={overviewLoading} onSelect={setSelectedInvoice} /></div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"><div><h3 className="font-bold text-slate-950">Unpaid invoice aging</h3><p className="mt-1 text-sm text-slate-500">Outstanding balance by age</p></div><div className="mt-7 space-y-5">{aging.buckets.length ? aging.buckets.map((bucket) => <div key={bucket.key}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold text-slate-600">{bucket.label}</span><span className="font-bold text-slate-900">{formatMoney(bucket.total)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(4, Number(bucket.total) / maxAging * 100)}%` }} /></div><p className="mt-1 text-xs text-slate-400">{bucket.count} invoice{bucket.count === 1 ? '' : 's'}</p></div>) : <div className="py-10 text-center text-sm text-slate-500">No unpaid invoices. Nice work.</div>}</div></div>
          </section>
        </>}

        {view === 'invoices' && <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold text-slate-950">All invoices</h2><p className="mt-1 text-sm text-slate-500">{invoiceData.count} total documents</p></div><div className="flex flex-col gap-3 sm:flex-row"><label className="relative"><Icon name="search" className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client or number" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 sm:w-60" /></label><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"><option value="">All statuses</option><option value="draft">Draft</option><option value="unpaid">Unpaid</option><option value="paid">Paid</option><option value="void">Void</option></select></div></div><InvoiceTable invoices={invoiceData.results} loading={loading} onSelect={setSelectedInvoice} /><div className="flex items-center justify-between border-t border-slate-100 px-6 py-4"><p className="text-sm text-slate-500">Page {page} of {totalPages}</p><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40">Previous</button><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 disabled:opacity-40">Next</button></div></div></section>}

        {view === 'clients' && <section><div className="mb-6 flex items-center justify-between"><div><h2 className="text-2xl font-bold text-slate-950">Clients</h2><p className="mt-1 text-slate-500">People and businesses you invoice.</p></div><button onClick={() => setClientForm(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-300 hover:text-blue-700"><Icon name="plus" className="h-4 w-4" /> Add client</button></div>{overviewLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-white" />)}</div> : clients.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{clients.map((client) => <article key={client.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 font-bold text-blue-600">{client.name.slice(0,2).toUpperCase()}</div><div className="min-w-0"><h3 className="truncate font-bold text-slate-900">{client.name}</h3><p className="truncate text-sm text-slate-500">{client.email}</p></div></div><p className="mt-5 text-xs font-medium text-slate-400">Added {date.format(new Date(client.created_at))}</p></article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><Icon name="clients" className="mx-auto h-8 w-8 text-slate-300" /><h3 className="mt-4 font-bold text-slate-900">No clients yet</h3><p className="mt-1 text-sm text-slate-500">Add a client before creating your first invoice.</p></div>}</section>}
      </main>
    </div>

    {invoiceForm && <Modal onClose={() => setInvoiceForm(false)} wide><InvoiceForm clients={clients} getToken={getToken} onClose={() => setInvoiceForm(false)} onAddClient={() => { setInvoiceForm(false); setClientForm(true); }} onCreated={(invoice) => { setInvoiceForm(false); setSelectedInvoice(invoice); void refresh(); }} /></Modal>}
    {clientForm && <Modal onClose={() => setClientForm(false)}><ClientForm getToken={getToken} onClose={() => setClientForm(false)} onCreated={(client) => { setClients((current) => [client, ...current]); setClientForm(false); }} /></Modal>}
    {selectedInvoice && <InvoiceDetail invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} onStatus={(next) => void changeStatus(next)} onDelete={() => void removeInvoice()} />}
  </div>;
}
