'use client';

import { FormEvent, useState } from 'react';
import { Dashboard } from './dashboard';
import { Icon } from './icons';
import { useAuth } from './auth';

function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    const data = new FormData(event.currentTarget);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');
    try {
      if (mode === 'login') await signIn(email, password);
      else {
        const result = await signUp(email, password);
        if (result.needsConfirmation) setMessage('Check your email to confirm your account, then log in.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#eef3ff] px-5 py-10">
    <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-blue-300/30 blur-3xl" />
    <div className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-indigo-300/30 blur-3xl" />
    <div className="relative w-full max-w-md">
      <div className="mb-7 flex items-center justify-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><Icon name="document" className="h-6 w-6" /></div>
        <div><p className="text-xl font-extrabold tracking-tight text-slate-950">Ledgerly</p><p className="text-xs font-medium text-slate-500">Invoice workspace</p></div>
      </div>

      <section className="rounded-3xl border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-900/10 backdrop-blur sm:p-8">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="Authentication mode">
          <button type="button" onClick={() => { setMode('login'); setError(''); setMessage(''); }} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'login' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Log in</button>
          <button type="button" onClick={() => { setMode('signup'); setError(''); setMessage(''); }} className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Create account</button>
        </div>

        <div className="mt-7 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{mode === 'login' ? 'Welcome back' : 'Start invoicing clearly'}</h1>
          <p className="mt-2 text-base leading-6 text-slate-500">{mode === 'login' ? 'Enter your owner credentials to open your dashboard.' : 'Create an account using the owner email configured for this workspace.'}</p>
        </div>

        <form className="mt-7 space-y-5" onSubmit={submit}>
          <label className="block text-sm font-bold text-slate-700">Email address
            <input name="email" type="email" required autoComplete="email" placeholder="owner@business.rw" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
          </label>
          <label className="block text-sm font-bold text-slate-700">Password
            <input name="password" type="password" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 6 characters" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
          </label>
          {error && <p role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {message && <p className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
          <button disabled={submitting} className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60">{submitting ? 'Please wait…' : mode === 'login' ? 'Open dashboard' : 'Create owner account'}</button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-sm text-slate-500">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Icon name="check" className="h-3.5 w-3.5" /></span>
          Secure authentication powered by Supabase
        </div>
      </section>
      <p className="mt-5 text-center text-sm font-medium text-slate-500">Invoices and totals are displayed in Rwandan francs (RWF).</p>
    </div>
  </main>;
}

export default function Home() {
  const { user, loading, signOut, getAccessToken } = useAuth();
  if (loading) return <main className="grid min-h-screen place-items-center bg-[#f5f7fb]"><div className="text-center"><div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" /><p className="mt-4 text-sm font-medium text-slate-500">Checking your session…</p></div></main>;
  if (!user) return <AuthForm />;
  return <Dashboard email={user.email ?? 'owner'} getToken={getAccessToken} onSignOut={() => void signOut()} />;
}
