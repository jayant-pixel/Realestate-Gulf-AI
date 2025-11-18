import Image from 'next/image';

export interface PropertyMenuItem {
  id?: string;
  title?: string;
  subtitle?: string;
  price?: number;
  amenities?: string[];
  highlights?: string;
  availability?: string;
  media?: string;
}

export interface PropertyDetail {
  id?: string;
  name?: string;
  location?: string;
  base_price?: number;
  amenities?: string[];
  highlights?: string;
  availability?: string;
  hero_image?: string;
  description?: string;
  unit_types?: string[];
  faqs?: { question: string; answer: string }[];
  [key: string]: unknown;
}

interface PropertyShowcaseProps {
  menuItems: PropertyMenuItem[];
  onSelect?: (propertyId: string) => void;
  selectedPropertyId?: string;
  detail?: PropertyDetail | null;
  className?: string;
}

const currency = (value?: number) =>
  typeof value === 'number' ? `$${value.toLocaleString()}` : undefined;

export function PropertyShowcase({
  menuItems,
  onSelect,
  selectedPropertyId,
  detail,
  className,
}: PropertyShowcaseProps) {
  return (
    <div
      className={`grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] ${className ?? ''}`}
    >
      <div className="space-y-3 overflow-y-auto pr-2">
        {menuItems.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6 text-sm text-slate-400">
            Ask the concierge for available listings to populate this panel.
          </div>
        ) : (
          menuItems.map((item) => (
            <button
              key={item.id ?? item.title}
              onClick={() => item.id && onSelect?.(item.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition
              ${
                selectedPropertyId === item.id
                  ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_30px_rgba(45,212,191,0.25)]'
                  : 'border-white/5 bg-slate-900/50 hover:border-cyan-400/40 hover:bg-slate-900/70'
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-base font-semibold text-white">{item.title}</p>
                  {item.subtitle && (
                    <p className="text-sm text-slate-400">{item.subtitle}</p>
                  )}
                </div>
                {currency(item.price) && (
                  <p className="text-sm font-semibold text-cyan-300">
                    {currency(item.price)}
                  </p>
                )}
              </div>
              {item.amenities && item.amenities.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.amenities.slice(0, 4).map((amenity) => (
                    <span
                      key={amenity}
                      className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-100"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              )}
              {item.highlights && (
                <p className="mt-3 text-xs text-slate-400">{item.highlights}</p>
              )}
            </button>
          ))
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        {detail ? (
          <div className="flex h-full flex-col">
            {detail.hero_image && (
              <div className="relative h-56 w-full overflow-hidden">
                <Image
                  src={detail.hero_image}
                  alt={detail.name ?? 'Property hero'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 space-y-4 p-6">
              <div>
                <h3 className="text-2xl font-semibold text-white">
                  {detail.name ?? 'Property'}
                </h3>
                <p className="text-sm text-slate-400">{detail.location}</p>
                {currency(detail.base_price) && (
                  <p className="mt-2 text-lg font-semibold text-cyan-300">
                    Starting {currency(detail.base_price)}
                  </p>
                )}
              </div>

              {detail.highlights && (
                <div>
                  <p className="text-sm font-medium text-slate-300">Highlights</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">
                    {detail.highlights}
                  </p>
                </div>
              )}

              {detail.amenities && detail.amenities.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-300">Amenities</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.amenities.map((amenity) => (
                      <span
                        key={amenity}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.unit_types && detail.unit_types.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-300">Available Units</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.unit_types.map((unit) => (
                      <span
                        key={unit}
                        className="rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-100"
                      >
                        {unit}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detail.faqs && detail.faqs.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-300">FAQs</p>
                  {detail.faqs.slice(0, 3).map((faq) => (
                    <div key={faq.question} className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-semibold text-slate-200">{faq.question}</p>
                      <p className="mt-1 text-xs text-slate-400">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-10 text-sm text-slate-400">
            Select a property to see full details, floor plans, and FAQs.
          </div>
        )}
      </div>
    </div>
  );
}

export default PropertyShowcase;
