'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

import type { AIAvatar, PublicLink } from '@/types/db';
import type { PropertyDetail, PropertyMenuItem } from '@/components/PropertyShowcase';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

type TimelineRole = 'agent' | 'visitor' | 'system';

interface TimelineEntry {
  id: string;
  role: TimelineRole;
  text: string;
  timestamp: Date;
}

interface LiveKitDataMessage {
  type: string;
  payload?: Record<string, unknown>;
  topic?: string;
}

interface EstateOverlayProps {
  visitorName: string;
  roomName: string;
  link?: PublicLink | null;
  avatar?: AIAvatar | null;
}

export default function EstateOverlay({ visitorName, roomName, link, avatar }: EstateOverlayProps) {
  const room = useRoomContext();
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [menuItems, setMenuItems] = useState<PropertyMenuItem[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>();
  const [propertyDetail, setPropertyDetail] = useState<PropertyDetail | null>(null);
  const [leadStatus, setLeadStatus] = useState<string | null>(null);

  const appendTimeline = useCallback((role: TimelineRole, text: string) => {
    if (!text) return;
    setTimeline((prev) => {
      const nextEntry: TimelineEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        text,
        timestamp: new Date(),
      };
      const entries = [...prev, nextEntry];
      if (entries.length > 20) {
        return entries.slice(entries.length - 20);
      }
      return entries;
    });
  }, []);

  const sendVisitorEvent = useCallback(
    (payload: Record<string, unknown>, topic = 'visitor') => {
      if (!room) return;
      try {
        const encoded = encoder.encode(JSON.stringify(payload));
        room.localParticipant?.publishData(encoded, { reliable: true, topic });
      } catch (err) {
        console.warn('[EstateOverlay] Failed to publish visitor event', err);
      }
    },
    [room],
  );

  useEffect(() => {
    if (!room) return;

    const handleConnected = () => {
      appendTimeline('system', "You're connected. Estate Buddy is listening.");
    };

    const handleData = (
      payload: Uint8Array,
      _participant: unknown,
      _kind: unknown,
      topic?: string | null,
    ) => {
      let message: LiveKitDataMessage | null = null;

      try {
        message = JSON.parse(decoder.decode(payload)) as LiveKitDataMessage;
      } catch (err) {
        console.warn('[EstateOverlay] Unable to decode data payload', err);
        return;
      }

      if (!message || typeof message.type !== 'string') return;
      const data = message.payload ?? {};

      if (topic === 'ui.overlay' || message.type === 'ui.overlay') {
        const kind = String((message.payload as { kind?: string } | undefined)?.kind ?? '');
        if (!kind) return;
        if (kind === 'properties.menu') {
          const items = Array.isArray(data.items) ? (data.items as PropertyMenuItem[]) : [];
          setMenuItems(items);
          if (items.length > 0) {
            appendTimeline(
              'system',
              `Showing ${items.length} property option${items.length === 1 ? '' : 's'} on the showcase panel.`,
            );
          }
          return;
        }
        if (kind === 'properties.detail') {
          const detailRecord = (data.property ?? data.detail) as PropertyDetail | undefined;
          if (detailRecord) {
            setPropertyDetail(detailRecord);
            if (detailRecord.id) {
              setSelectedPropertyId(String(detailRecord.id));
            }
          }
          return;
        }
        if (kind === 'leads.created' && data.fullName) {
          appendTimeline('system', `Lead captured for ${String(data.fullName)}.`);
          setLeadStatus('Lead captured');
          return;
        }
        if (kind === 'leads.activity' && data.message) {
          appendTimeline('system', String(data.message));
          return;
        }
        return;
      }

      if (message.type === 'agent.message') {
        appendTimeline('agent', String(data.text ?? data.message ?? ''));
        return;
      }

      if (message.type === 'visitor.message') {
        appendTimeline('visitor', String(data.text ?? ''));
        return;
      }

      if (message.type === 'system.notice' || message.type === 'system.message') {
        appendTimeline('system', String(data.text ?? ''));
        return;
      }
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.DataReceived, handleData);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [appendTimeline, room]);

  const handleSelectProperty = useCallback(
    (propertyId: string) => {
      setSelectedPropertyId(propertyId);
      sendVisitorEvent({
        type: 'visitor.selectProperty',
        payload: { propertyId },
      });
    },
    [sendVisitorEvent],
  );

  const hasOverlayContent = useMemo(() => {
    return menuItems.length > 0 || Boolean(propertyDetail) || Boolean(leadStatus);
  }, [leadStatus, menuItems.length, propertyDetail]);

  if (!hasOverlayContent) {
    return null;
  }

  return (
    <div className="estate-overlay">
      <div className="estate-overlay__card">
        <header className="estate-overlay__header">
          <div>
            <p className="estate-overlay__eyebrow">Estate Buddy Concierge</p>
            <h2 className="estate-overlay__title">{link?.title ?? avatar?.name ?? 'Property Concierge'}</h2>
            <p className="estate-overlay__subtitle">
              {link?.config?.welcomeMessage ?? 'Explore curated listings, ask questions, and capture your preferences in real time.'}
            </p>
          </div>
          <div className="estate-overlay__meta">
            <span className="estate-overlay__badge">Room: {roomName}</span>
            <span className="estate-overlay__badge">Visitor: {visitorName}</span>
            {leadStatus ? <span className="estate-overlay__badge estate-overlay__badge--accent">{leadStatus}</span> : null}
          </div>
        </header>

        <div className="estate-overlay__content">
          <section className="estate-overlay__conversation" aria-live="polite">
            <h3 className="estate-overlay__section-title">Conversation</h3>
            {timeline.length === 0 ? (
              <p className="estate-overlay__placeholder">
                Estate Buddy will share updates and follow-ups here throughout your tour.
              </p>
            ) : (
              <ul className="estate-overlay__timeline">
                {timeline.map((entry) => (
                  <li key={entry.id} className={`estate-overlay__timeline-item estate-overlay__timeline-item--${entry.role}`}>
                    <span className="estate-overlay__timeline-label">
                      {entry.role === 'agent'
                        ? avatar?.name ?? 'Estate Buddy'
                        : entry.role === 'visitor'
                          ? visitorName
                          : 'System'}
                    </span>
                    <p>{entry.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="estate-overlay__properties">
            <h3 className="estate-overlay__section-title">Featured Properties</h3>
            <EstatePropertyPanel
              menuItems={menuItems}
              selectedPropertyId={selectedPropertyId}
              propertyDetail={propertyDetail}
              onSelect={handleSelectProperty}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

function EstatePropertyPanel({
  menuItems,
  selectedPropertyId,
  propertyDetail,
  onSelect,
}: {
  menuItems: PropertyMenuItem[];
  selectedPropertyId?: string;
  propertyDetail: PropertyDetail | null;
  onSelect: (propertyId: string) => void;
}) {
  if (menuItems.length === 0 && !propertyDetail) {
    return (
      <div className="estate-overlay__placeholder">
        Ask Estate Buddy about available listings to see curated options here.
      </div>
    );
  }

  return (
    <div className="estate-property-panel">
      <aside className="estate-property-panel__menu">
        {menuItems.map((item, index) => {
          const hasId = item.id !== undefined && item.id !== null && item.id !== '';
          const propertyId = hasId ? String(item.id) : '';
          const key = hasId ? propertyId : String(item.title ?? index);
          const isActive = hasId && selectedPropertyId === propertyId;
          return (
            <button
              key={key}
              type="button"
              onClick={() => hasId && onSelect(propertyId)}
              disabled={!hasId}
              className={`estate-property-panel__menu-item${isActive ? ' estate-property-panel__menu-item--active' : ''}`}
            >
              <span className="estate-property-panel__menu-title">{item.title ?? 'Listing'}</span>
              {item.subtitle ? (
                <span className="estate-property-panel__menu-subtitle">{item.subtitle}</span>
              ) : null}
              {typeof item.price === 'number' ? (
                <span className="estate-property-panel__menu-price">${item.price.toLocaleString()}</span>
              ) : null}
            </button>
          );
        })}
      </aside>

      <div className="estate-property-panel__detail">
        {propertyDetail ? (
          <div className="estate-property-card">
            {propertyDetail.hero_image ? (
              <div className="estate-property-card__hero">
                <Image
                  src={propertyDetail.hero_image}
                  alt={propertyDetail.name ?? 'Property hero'}
                  fill
                  sizes="(min-width: 768px) 600px, 100vw"
                  className="estate-property-card__hero-image"
                />
              </div>
            ) : null}
            <div className="estate-property-card__body">
              <h4 className="estate-property-card__title">{propertyDetail.name ?? 'Featured property'}</h4>
              {propertyDetail.location ? (
                <p className="estate-property-card__location">{propertyDetail.location}</p>
              ) : null}
              {typeof propertyDetail.base_price === 'number' ? (
                <p className="estate-property-card__price">Starting ${propertyDetail.base_price.toLocaleString()}</p>
              ) : null}
              {propertyDetail.highlights ? (
                <p className="estate-property-card__highlights">{propertyDetail.highlights}</p>
              ) : null}

              {Array.isArray(propertyDetail.amenities) && propertyDetail.amenities.length > 0 ? (
                <div className="estate-property-card__amenities">
                  {propertyDetail.amenities.slice(0, 6).map((amenity) => (
                    <span key={amenity} className="estate-property-card__chip">
                      {amenity}
                    </span>
                  ))}
                </div>
              ) : null}

              {Array.isArray(propertyDetail.unit_types) && propertyDetail.unit_types.length > 0 ? (
                <div className="estate-property-card__units">
                  <span className="estate-property-card__units-label">Available Units:</span>
                  <div className="estate-property-card__units-list">
                    {propertyDetail.unit_types.map((unit) => (
                      <span key={unit} className="estate-property-card__chip estate-property-card__chip--accent">
                        {unit}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="estate-overlay__placeholder">
            Select a property on the left to see pricing, amenities, and floor plan highlights.
          </div>
        )}
      </div>
    </div>
  );
}
