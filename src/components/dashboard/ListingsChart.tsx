'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MoreHorizontal, RefreshCcw } from 'lucide-react';

const data = [
    { name: 'Sunday', rent: 400, sale: 240 },
    { name: 'Monday', rent: 300, sale: 139 },
    { name: 'Tuesday', rent: 200, sale: 980 },
    { name: 'Wednesday', rent: 278, sale: 390 },
    { name: 'Thursday', rent: 189, sale: 480 },
    { name: 'Friday', rent: 239, sale: 380 },
    { name: 'Saturday', rent: 349, sale: 430 },
];

export default function ListingsChart() {
    return (
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-bold text-lg text-slate-800">Total Listings</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-2xl font-bold text-slate-900">834</span>
                        <span className="text-sm font-medium text-green-500">↑ 10.5%</span>
                        <span className="text-xs text-slate-400">Last updated: July 08, 2025</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50">
                        Weekly <MoreHorizontal className="w-3 h-3" />
                    </button>
                    <button className="p-1.5 rounded-lg border border-gray-200 text-slate-400 hover:text-primary-500 hover:border-primary-200 transition-colors">
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs mb-4 justify-end">
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary-500"></div>
                    <span className="text-slate-500">Property Rent</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm bg-primary-200"></div>
                    <span className="text-slate-500">Property Sale</span>
                </div>
            </div>

            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barGap={8}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                            tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip
                            cursor={{ fill: '#F1F5F9' }}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                        />
                        <Bar dataKey="rent" fill="#F97316" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="sale" fill="#FED7AA" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
