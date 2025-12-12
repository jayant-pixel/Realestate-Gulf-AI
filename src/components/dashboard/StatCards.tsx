import { DollarSign, Home, Building2 } from 'lucide-react';

import { LucideIcon } from 'lucide-react';

interface Stat {
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down';
    icon: LucideIcon;
    color: string;
    bgColor: string;
    textColor: string;
    detail: string;
}

const stats: Stat[] = [
    {
        title: 'Total Revenue',
        value: '$23,569.00',
        change: '+12%',
        trend: 'up',
        icon: DollarSign,
        color: 'text-primary-500',
        bgColor: 'bg-primary-50',
        textColor: 'text-green-500',
        detail: 'from last month'
    },
    {
        title: 'Total Properties Sale',
        value: '904',
        change: '-8.5%',
        trend: 'down',
        icon: Home,
        color: 'text-primary-500',
        bgColor: 'bg-primary-50',
        textColor: 'text-red-500',
        detail: 'from last month'
    },
    {
        title: 'Total Properties Rent',
        value: '573',
        change: '+5.7%',
        trend: 'up',
        icon: Building2,
        color: 'text-primary-500',
        bgColor: 'bg-primary-50',
        textColor: 'text-green-500',
        detail: 'from last month'
    },
];

export default function StatCards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                    <div key={index} className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 flex flex-col justify-between h-[180px]">
                        <div className="flex justify-between items-start">
                            <span className="text-slate-500 font-medium">{stat.title}</span>
                            <div className={`p-2.5 rounded-full ${stat.bgColor}`}>
                                <Icon className={`w-5 h-5 ${stat.color}`} />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-3xl font-bold text-slate-900 mb-2">{stat.value}</h3>
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`font-bold ${stat.textColor} bg-opacity-10 px-2 py-0.5 rounded-full ${stat.textColor.replace('text-', 'bg-')}`}>
                                    {stat.change}
                                </span>
                                <span className="text-slate-400">{stat.detail}</span>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
