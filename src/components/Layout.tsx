'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  BarChart3,
  Database,
  Bot,
  LogOut,
  Building2,
  ClipboardList,
  KanbanSquare,
} from 'lucide-react';

export default function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  const mainMenu = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Agents', href: '/agents', icon: Users },
    { name: 'Clients', href: '/clients', icon: Users },
    { name: 'Analytics', href: '/reports', icon: BarChart3 },
    { name: 'Calendar', href: '/calendar', icon: ClipboardList },
    { name: 'Messages', href: '/conversations', icon: MessageSquare },
  ];

  const salesChannel = [
    { name: 'Properties', href: '/dashboard', icon: Building2 }, // Temporary link
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Transactions', href: '/pipeline', icon: KanbanSquare },
    { name: 'Discounts', href: '/discounts', icon: Database },
  ];

  const bottomMenu = [
    { name: 'Settings', href: '/settings', icon: Bot }, // Using Bot as placeholder for settings icon if needed or import Settings
    { name: 'Help Center', href: '/help', icon: ClipboardList },
    { name: 'Feedback', href: '/feedback', icon: MessageSquare },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-slate-600" suppressHydrationWarning>
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-gray-100 flex-shrink-0 flex flex-col fixed top-0 bottom-0 z-50">
        <div className="h-20 flex items-center px-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white font-bold text-lg">
              G
            </div>
            <span className="text-xl font-bold text-slate-800">Glamhaven</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-none">
          {/* Main Menu */}
          <div>
            <h3 className="px-4 text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Main Menu</h3>
            <div className="space-y-1">
              {mainMenu.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${active
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary-500' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sales Channel */}
          <div>
            <h3 className="px-4 text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Sales Chanel</h3>
            <div className="space-y-1">
              {salesChannel.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium ${active
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'
                      }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-primary-500' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Menu */}
        <div className="p-4 border-t border-gray-100 space-y-1">
          {bottomMenu.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-gray-50 hover:text-slate-900 transition-colors text-sm font-medium"
              >
                <Icon className="w-5 h-5 text-slate-400" />
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center text-sm text-slate-500">
            <span className="hover:text-slate-900 cursor-pointer">Home</span>
            <span className="mx-2">/</span>
            <span className="font-medium text-slate-900">Dashboard</span>
          </div>

          <div className="flex items-center gap-6">
            <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
              <Bot className="w-5 h-5" /> {/* Placeholder for Bell */}
            </button>

            <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-900">{profile?.display_name || 'Shazzad Shoikat'}</p>
                <p className="text-xs text-slate-500">Sales Manager</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden ring-2 ring-white shadow-sm">
                {/* Avatar placeholder if no image */}
                <div className="w-full h-full flex items-center justify-center bg-primary-100 text-primary-600 font-bold">
                  {profile?.display_name?.[0] || 'S'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
