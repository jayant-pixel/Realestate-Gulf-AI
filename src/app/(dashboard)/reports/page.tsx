'use client';

import { useState } from 'react';
import { Calendar, Download, FileText } from 'lucide-react';
import ChartCard from '@/components/ChartCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function Reports() {
  const [dateRange, setDateRange] = useState('month');

  const sampleData = [
    { name: 'Week 1', leads: 12, conversions: 3 },
    { name: 'Week 2', leads: 19, conversions: 5 },
    { name: 'Week 3', leads: 15, conversions: 4 },
    { name: 'Week 4', leads: 22, conversions: 7 },
  ];

  const handleExportPDF = () => {
    alert('PDF export functionality would be implemented with a library like jsPDF');
  };

  const handleExportCSV = () => {
    const csv = [
      ['Period', 'Total Leads', 'Conversions', 'Conversion Rate'],
      ...sampleData.map((item) => [
        item.name,
        item.leads,
        item.conversions,
        `${Math.round((item.conversions / item.leads) * 100)}%`,
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reports & Analytics</h1>
          <p className="text-gray-600">Generate and download performance reports</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
          >
            <FileText className="w-5 h-5" />
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <Calendar className="w-5 h-5 text-gray-600" />
          <div className="flex gap-2">
            {['day', 'week', 'month', 'custom'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  dateRange === range
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {dateRange === 'custom' && (
          <div className="flex gap-4 mb-6">
            <input
              type="date"
              aria-label="Select start date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            <span className="text-gray-600 self-center">to</span>
            <input
              type="date"
              aria-label="Select end date"
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total Leads</h3>
          <p className="text-3xl font-bold text-gray-900">68</p>
          <p className="text-sm text-emerald-600 mt-2">+15% from last period</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Conversion Rate</h3>
          <p className="text-3xl font-bold text-gray-900">28%</p>
          <p className="text-sm text-emerald-600 mt-2">+3% from last period</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Avg Response Time</h3>
          <p className="text-3xl font-bold text-gray-900">1.5s</p>
          <p className="text-sm text-emerald-600 mt-2">-0.3s from last period</p>
        </div>
      </div>

      <ChartCard title="Lead Generation & Conversion Trends" subtitle="Weekly performance overview">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={sampleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip />
            <Legend />
            <Bar dataKey="leads" fill="#06b6d4" name="Total Leads" />
            <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Saved Report Templates</h3>
        <div className="space-y-3">
          {['Weekly Performance Summary', 'Monthly Conversion Report', 'Lead Source Analysis'].map((template) => (
            <div key={template} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">{template}</span>
              </div>
              <button className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Generate
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
