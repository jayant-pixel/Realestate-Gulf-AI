import { MoreHorizontal, Search, Filter, ArrowUpDown } from 'lucide-react';

const payments = [
    {
        id: '23487',
        date: 'July 08, 2025',
        property: 'Oak Grove Estates',
        address: '159 Elm St, Springfield, USA',
        customer: 'David Martinez',
        avatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=100&q=80',
        type: 'Rent',
        amount: '$293.00',
        status: 'Pending',
        statusColor: 'bg-yellow-100 text-yellow-700'
    },
    {
        id: '23488',
        date: 'July 09, 2025',
        property: 'Maple Heights',
        address: '78 Maple Ave, Springfield, USA',
        customer: 'Sarah Johnson',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80',
        type: 'Rent',
        amount: '$320.00',
        status: 'Failed',
        statusColor: 'bg-red-100 text-red-700'
    },
    {
        id: '23489',
        date: 'July 10, 2025',
        property: 'Pine Valley',
        address: '12 Pine Ln, Springfield, USA',
        customer: 'Michael Brown',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80',
        type: 'Sale',
        amount: '$1,200.00',
        status: 'Completed',
        statusColor: 'bg-green-100 text-green-700'
    }
];

export default function RecentPayments() {
    return (
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 mt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <h3 className="font-bold text-lg text-slate-800">Recent Payments</h3>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search"
                            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 w-48"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-slate-600 hover:bg-gray-50">
                        <Filter className="w-4 h-4" /> Filter
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-medium text-slate-600 hover:bg-gray-50">
                        <ArrowUpDown className="w-4 h-4" /> Sort by
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-gray-100">
                            <th className="px-4 py-3 font-medium">Payment ID</th>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Property Info</th>
                            <th className="px-4 py-3 font-medium">Customer Name</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Amount</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {payments.map((payment) => (
                            <tr key={payment.id} className="group hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                <td className="px-4 py-4 font-medium text-slate-900">
                                    <div className="flex items-center gap-2">
                                        <input type="checkbox" className="rounded border-gray-300 text-primary-500 focus:ring-primary-200" />
                                        {payment.id}
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-slate-600">{payment.date}</td>
                                <td className="px-4 py-4">
                                    <div>
                                        <div className="font-bold text-slate-800">{payment.property}</div>
                                        <div className="text-xs text-slate-400">{payment.address}</div>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <img src={payment.avatar} alt={payment.customer} className="w-8 h-8 rounded-full object-cover" />
                                        <span className="font-medium text-slate-700">{payment.customer}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="px-2.5 py-1 rounded-full border border-green-200 text-green-700 text-xs font-medium">
                                        {payment.type}
                                    </span>
                                </td>
                                <td className="px-4 py-4 font-bold text-slate-900">{payment.amount}</td>
                                <td className="px-4 py-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${payment.statusColor} border border-transparent`}>
                                        {payment.status}
                                    </span>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <button className="p-1 text-slate-400 hover:text-slate-600">
                                        <MoreHorizontal className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
