'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, Target, Award } from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ActivityList from '@/components/ActivityList';
import ChartCard from '@/components/ChartCard';
import KPI from '@/components/KPI';
import { supabase } from '@/lib/supabase';
import type { Activity, ConversionAvgs, IntentCount, LeadOverview } from '@/types/db';

export default function DashboardPage() {
  const [overview, setOverview] = useState<LeadOverview | null>(null);
  const [intentCounts, setIntentCounts] = useState<IntentCount[]>([]);
  const [conversionAvgs, setConversionAvgs] = useState<ConversionAvgs | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [overviewRes, intentRes, conversionRes, activitiesRes] = await Promise.all([
        supabase.from('lead_overview').select('*').maybeSingle(),
        supabase.from('insight_intent_counts').select('*'),
        supabase.from('insight_conversion_avgs').select('*').maybeSingle(),
        supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

      if (overviewRes.data) setOverview(overviewRes.data);
      if (intentRes.data) setIntentCounts(intentRes.data);
      if (conversionRes.data) setConversionAvgs(conversionRes.data);
      if (activitiesRes.data) setRecentActivities(activitiesRes.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const intentChartData = intentCounts.map((item) => ({
    name: item.intent_level,
    value: item.count,
  }));

  const conversionChartData = conversionAvgs
    ? [
        { period: '3 Months', probability: Math.round((conversionAvgs.avg_3m || 0) * 100) },
        { period: '6 Months', probability: Math.round((conversionAvgs.avg_6m || 0) * 100) },
        { period: '9 Months', probability: Math.round((conversionAvgs.avg_9m || 0) * 100) },
      ]
    : [];

  const COLORS = ['#06b6d4', '#3b82f6', '#6366f1', '#10b981', '#f59e0b'];

  const highIntentPercent = overview
    ? overview.total_leads > 0
      ? Math.round((overview.high_intent / overview.total_leads) * 100)
      : 0
    : 0;

  const avgConversion = conversionAvgs
    ? Math.round(((conversionAvgs.avg_3m + conversionAvgs.avg_6m + conversionAvgs.avg_9m) / 3) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here&apos;s your Realestate AI overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPI
          title="New Leads Today"
          value={overview?.new_today || 0}
          change="+12% from yesterday"
          changeType="positive"
          icon={Users}
          iconColor="bg-gradient-to-br from-cyan-500 to-blue-600"
        />
        <KPI
          title="High Intent"
          value={`${highIntentPercent}%`}
          change={`${overview?.high_intent || 0} leads`}
          changeType="positive"
          icon={Target}
          iconColor="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
        <KPI
          title="Avg Conversion"
          value={`${avgConversion}%`}
          change="3-9 month outlook"
          changeType="neutral"
          icon={TrendingUp}
          iconColor="bg-gradient-to-br from-blue-500 to-cyan-600"
        />
        <KPI
          title="Closed Deals"
          value={overview?.closed_deals || 0}
          change={`${overview?.total_leads || 0} total leads`}
          changeType="positive"
          icon={Award}
          iconColor="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Buyer Intent Distribution" subtitle="Lead categorization by intent level">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={intentChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(props) => {
                  const name = props.name ?? '';
                  const percent = typeof props.percent === 'number' ? props.percent : 0;
                  return `${name}: ${(percent * 100).toFixed(0)}%`;
                }}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {intentChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Conversion Probability Forecast" subtitle="Average conversion rates over time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={conversionChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="probability"
                stroke="#06b6d4"
                strokeWidth={3}
                dot={{ fill: '#06b6d4', r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Recent Activity Feed" subtitle="Latest updates across all leads">
        <ActivityList activities={recentActivities} />
      </ChartCard>
    </div>
  );
}
