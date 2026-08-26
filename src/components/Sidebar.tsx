"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/session";

interface NavItem {
  href: string;
  label: string;
  roles: Array<SessionUser["role"]>;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Branch",
    items: [
      { href: "/branch", label: "Dashboard", roles: ["BRANCH"] },
      { href: "/branch/upload", label: "Upload weekly report", roles: ["BRANCH"] },
      { href: "/branch/reports", label: "My reports", roles: ["BRANCH"] },
    ],
  },
  {
    section: "Head Office",
    items: [
      { href: "/ho", label: "National dashboard", roles: ["HO", "ADMIN"] },
      { href: "/ho/changes", label: "Change monitoring", roles: ["HO", "ADMIN", "BRANCH"] },
    ],
  },
];

export default function Sidebar({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const sections = NAV.map((s) => ({
    ...s,
    items: s.items.filter((i) => i.roles.includes(user.role)),
  })).filter((s) => s.items.length > 0);

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 px-3 py-4">
      {sections.map((section) => (
        <div key={section.section}>
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {section.section}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/branch" && item.href !== "/ho" && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      active
                        ? "bg-slate-800 font-medium text-white"
                        : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-line bg-slate-900 px-4 py-3 lg:hidden">
        <span className="text-sm font-semibold text-white">Sales Report Monitoring</span>
        <button onClick={() => setOpen(!open)} className="rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-800">
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && <div className="border-b border-slate-800 bg-slate-900 lg:hidden">{nav}</div>}

      {/* Desktop rail */}
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="border-b border-slate-800 px-5 py-4">
          <p className="text-sm font-semibold leading-tight text-white">Sales Report</p>
          <p className="text-sm leading-tight text-slate-400">Monitoring</p>
        </div>
        {nav}
        <div className="border-t border-slate-800 px-5 py-4">
          <p className="truncate text-sm font-medium text-white">{user.name}</p>
          <p className="truncate text-xs text-slate-400">
            {user.role === "BRANCH" ? `${user.branchCode} · ${user.branchName}` : user.role}
          </p>
          <form action="/api/auth/logout" method="post">
            <button className="mt-3 text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
