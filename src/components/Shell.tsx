"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default function Shell({ title, subtitle, name, detail, links, children }: {
  title: string;
  subtitle: string;
  name: string;
  detail: string;
  links: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="w-full md:w-60 bg-green-950 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-green-900">
          <div className="flex items-center gap-2">
            <span className="bg-green-600 font-bold px-2 py-1 rounded">MP</span>
            <div>
              <p className="font-bold leading-none">M-Park</p>
              <p className="text-slate-400 text-xs mt-1">{subtitle}</p>
            </div>
          </div>
        </div>
        <nav className="p-3 flex-1 flex flex-row flex-wrap gap-1 md:block md:space-y-1" aria-label="Dashboard">
          {links.map((l) => {
            const active = pathname === l.href || (l.href !== "/admin" && l.href !== "/customer" && pathname.startsWith(l.href));
            return (
              <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={active ? "block px-3 py-2 rounded-lg bg-green-800 text-white font-semibold" : "block px-3 py-2 rounded-lg text-slate-200 hover:bg-green-900"}>
                {l.label}
              </Link>
            );
          })}
          <LogoutButton />
        </nav>
        <div className="p-4 border-t border-green-900 text-sm">
          <p className="text-slate-400 text-xs">Logged in as</p>
          <p className="font-semibold break-words">{name}</p>
          <p className="text-slate-400 text-xs break-words">{detail}</p>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl w-full">
        <h1 className="text-2xl md:text-3xl font-bold break-words">{title}</h1>
        <div className="mt-5">{children}</div>
      </main>
    </div>
  );
}
