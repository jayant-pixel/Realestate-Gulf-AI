import { MapPin, RefreshCcw } from 'lucide-react';

const properties = [
    {
        name: 'Sierra Lakeview Estate',
        location: 'Lake Tahoe, California',
        price: '$625,000',
        period: '/month',
        image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80'
    },
    {
        name: 'Canyon Ridge Retreat',
        location: 'Sedona, Arizona, USA',
        price: '$750,000',
        period: '/month',
        image: 'https://images.unsplash.com/photo-1600596542815-2495db9dc2c3?auto=format&fit=crop&w=400&q=80'
    },
    {
        name: 'Oceanfront Paradise',
        location: 'Miami Beach, Florida',
        price: '$1,200,000',
        period: '/month',
        image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=400&q=80'
    },
    {
        name: 'Urban Loft Living',
        location: 'New York City, NY',
        price: '$4,500',
        period: '/month',
        image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&q=80'
    }
];

export default function PropertiesList() {
    return (
        <div className="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100 h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg text-slate-800">My Properties</h3>
                <button className="p-1.5 rounded-lg border border-gray-200 text-slate-400 hover:text-primary-500 hover:border-primary-200 transition-colors">
                    <RefreshCcw className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-4">
                {properties.map((property, index) => (
                    <div key={index} className="flex gap-4 p-3 rounded-2xl border border-gray-50 hover:bg-gray-50 hover:border-gray-100 transition-all cursor-pointer group">
                        <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                            <img src={property.image} alt={property.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                        <div className="flex flex-col justify-center gap-1">
                            <h4 className="font-bold text-slate-900 text-sm">{property.name}</h4>
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-[140px]">{property.location}</span>
                            </div>
                            <div className="text-sm">
                                <span className="font-bold text-primary-500">{property.price}</span>
                                <span className="text-slate-400 text-xs"> {property.period}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
