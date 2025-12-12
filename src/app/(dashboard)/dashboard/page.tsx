'use client';

import StatCards from '@/components/dashboard/StatCards';
import ListingsChart from '@/components/dashboard/ListingsChart';
import PropertiesList from '@/components/dashboard/PropertiesList';
import RecentPayments from '@/components/dashboard/RecentPayments';
import { RefreshCcw, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile?.display_name || 'Shazzad'}!</h1>
          <p className="text-slate-500 mt-1">Track and manage your property dashboard efficiently.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-gray-200 text-sm font-medium text-slate-600 text-nowrap">
            <RefreshCcw className="w-4 h-4" />
            <span>Last updated: July 08, 2025</span>
          </div>
          <button className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary-500/30">
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <StatCards />
          <ListingsChart />
        </div>

        {/* Right Column (1/3 width) */}
        <div className="lg:col-span-1 h-full">
          <PropertiesList />
        </div>
      </div>

      {/* Full Width Bottom Section */}
      <RecentPayments />
    </div>
  );
}
