"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DEMO = [
  { label: "Branch — Sampit", email: "smp@company.com" },
  { label: "Head Office", email: "ho@company.com" },
  { label: "Admin", email: "admin@company.com" },
];

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("smp@company.com");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Sign in failed.");
      setBusy(false);
      return;
    }
    router.replace(body.redirect);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">Sales Report Monitoring</h1>
          <p className="mt-1 text-sm text-slate-400">Weekly branch reporting and national recap.</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required className="field" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 rounded-lg border border-slate-700 bg-slate-800/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Prototype accounts</p>
          <ul className="mt-2 space-y-1.5">
            {DEMO.map((d) => (
              <li key={d.email}>
                <button
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword("password"); }}
                  className="w-full text-left text-sm text-slate-300 hover:text-white"
                >
                  {d.label} <span className="text-slate-500">· {d.email}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Password for every account: password</p>
        </div>
      </div>
    </div>
  );
}
