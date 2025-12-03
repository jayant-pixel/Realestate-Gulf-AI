'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

import type { AIAvatar, PublicLink } from '@/types/db';
import type { PropertyDetail, PropertyMenuItem } from '@/components/PropertyShowcase';
import {
  type ClientDirectionsRPC,
  type ClientLeadsRPC,
  type ClientPropertiesRPC,
  type OverlayPayload,
  type VisitorRPCPayload,
} from '@/types/livekit';
import PropertyShowcase from '@/components/PropertyShowcase';

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
  const [directions, setDirections] = useState<ClientDirectionsRPC | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [ctaBusy, setCtaBusy] = useState(false);
  const lastOverlayIdRef = useRef<string>();
  const menuCacheRef = useRef<PropertyMenuItem[]>([]);
  const detailCacheRef = useRef<PropertyDetail | null>(null);
  const directionsCacheRef = useRef<ClientDirectionsRPC | null>(null);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = window.setTimeout(() => setStatusBanner(null), 4500);
    return () => window.clearTimeout(timer);
  }, [statusBanner]);

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
    (message: VisitorRPCPayload) => {
      if (!room) return;
      try {
        const encoded = encoder.encode(JSON.stringify(message));
        room.localParticipant?.publishData(encoded, { reliable: true, topic: message.type });
      } catch (err) {
        console.warn('[EstateOverlay] Failed to publish visitor event', err);
      }
    },
    [room],
  );

  const sendOverlayAck = useCallback(
    (overlayId?: string, status: 'rendered' | 'cleared' = 'rendered') => {
      if (!overlayId) return;
      sendVisitorEvent({ type: 'agent.overlayAck', payload: { overlayId, status } });
    },
    [sendVisitorEvent],
  );

  useEffect(() => {
    if (!room) return;

    const replayCached = () => {
      if (menuCacheRef.current.length) {
        setMenuItems(menuCacheRef.current);
      }
      if (detailCacheRef.current) {
        setPropertyDetail(detailCacheRef.current);
      }
      if (directionsCacheRef.current) {
        setDirections(directionsCacheRef.current);
      }
      if (lastOverlayIdRef.current) {
        sendOverlayAck(lastOverlayIdRef.current, 'rendered');
      }
    };

    const handleConnected = () => {
      appendTimeline('system', "You're connected. Estate Buddy is listening.");
      replayCached();
    };

    const applyOverlayPayload = (overlay: OverlayPayload) => {
      const kind = overlay.kind;
      if (overlay.overlayId) {
        lastOverlayIdRef.current = overlay.overlayId;
      }
      if (kind === 'properties.menu') {
        const items = Array.isArray(overlay.items) ? (overlay.items as PropertyMenuItem[]) : [];
        setMenuItems(items);
        menuCacheRef.current = items;
        if (items.length > 0) {
          appendTimeline(
            'system',
            `Showing ${items.length} property option${items.length === 1 ? '' : 's'} on the showcase panel.`,
          );
        }
        sendOverlayAck(overlay.overlayId);
        return;
      }
      if (kind === 'properties.detail') {
        const detailRecord = (overlay.property ?? overlay.item) as PropertyDetail | undefined;
        if (detailRecord) {
          setPropertyDetail(detailRecord);
          detailCacheRef.current = detailRecord;
          if (detailRecord.id) {
            setSelectedPropertyId(String(detailRecord.id));
          }
        }
        sendOverlayAck(overlay.overlayId);
        return;
      }
      if (kind === 'directions.show') {
        const payload: ClientDirectionsRPC = {
          action: 'show',
          overlayId: overlay.overlayId,
          locations: overlay.locations,
        };
        setDirections(payload);
        directionsCacheRef.current = payload;
        sendOverlayAck(overlay.overlayId);
        return;
      }
      if (kind === 'directions.clear') {
        setDirections(null);
        directionsCacheRef.current = null;
        sendOverlayAck(overlay.overlayId, 'cleared');
        return;
      }
      if (kind === 'leads.created') {
        setLeadStatus('Lead captured');
        setStatusBanner(`Lead captured for ${overlay.fullName ?? 'visitor'}`);
        appendTimeline('system', `Lead captured for ${overlay.fullName ?? 'visitor'}.`);
        sendOverlayAck(overlay.overlayId);
        return;
      }
      if (kind === 'leads.activity') {
        if (overlay.message) {
          appendTimeline('system', String(overlay.message));
        }
        sendOverlayAck(overlay.overlayId);
      }
    };

    const handleClientProperties = (payload: ClientPropertiesRPC) => {
      if (payload.action === 'menu') {
        const items = Array.isArray(payload.items) ? payload.items : [];
        setMenuItems(items);
        menuCacheRef.current = items;
        if (payload.overlayId) {
          lastOverlayIdRef.current = payload.overlayId;
          sendOverlayAck(payload.overlayId);
        }
      } else if (payload.action === 'detail') {
        const detailRecord = payload.item as PropertyDetail;
        setPropertyDetail(detailRecord);
        detailCacheRef.current = detailRecord;
        if (payload.overlayId) {
          lastOverlayIdRef.current = payload.overlayId;
          sendOverlayAck(payload.overlayId);
        }
        if (detailRecord?.id) {
          setSelectedPropertyId(String(detailRecord.id));
        }
      }
    };

    const handleClientLeads = (payload: ClientLeadsRPC) => {
      if (payload.action === 'created') {
        setLeadStatus('Lead captured');
        setStatusBanner(`Lead created for ${payload.fullName ?? 'visitor'}`);
        appendTimeline('system', `Lead captured for ${payload.fullName ?? 'visitor'}.`);
        sendOverlayAck(payload.overlayId);
      }
      if (payload.action === 'activity' && payload.message) {
        appendTimeline('system', payload.message);
        sendOverlayAck(payload.overlayId);
      }
    };

    const handleDirections = (payload: ClientDirectionsRPC) => {
      if (payload.action === 'clear') {
        setDirections(null);
        directionsCacheRef.current = null;
        sendOverlayAck(payload.overlayId, 'cleared');
      } else {
        setDirections(payload);
        directionsCacheRef.current = payload;
        sendOverlayAck(payload.overlayId);
      }
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
        applyOverlayPayload(data as OverlayPayload);
        return;
      }

      if (message.type === 'client.properties') {
        handleClientProperties(data as ClientPropertiesRPC);
        return;
      }

      if (message.type === 'client.leads') {
        handleClientLeads(data as ClientLeadsRPC);
        return;
      }

      if (message.type === 'client.directions') {
        handleDirections(data as ClientDirectionsRPC);
        return;
      }

      if (message.type === 'agent.message') {
        appendTimeline('agent', String((data as { text?: string; message?: string }).text ?? (data as { message?: string }).message ?? ''));
        return;
      }

      if (message.type === 'visitor.message') {
        appendTimeline('visitor', String((data as { text?: string }).text ?? ''));
        return;
      }

      if (message.type === 'system.notice' || message.type === 'system.message') {
        appendTimeline('system', String((data as { text?: string }).text ?? ''));
      }
    };

    room.on(RoomEvent.Connected, handleConnected);
    room.on(RoomEvent.Reconnected, replayCached);
    room.on(RoomEvent.DataReceived, handleData);

    return () => {
      room.off(RoomEvent.Connected, handleConnected);
      room.off(RoomEvent.Reconnected, replayCached);
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [appendTimeline, room, sendOverlayAck]);

  const handleSelectProperty = useCallback(
    (propertyId: string) => {
      setSelectedPropertyId(propertyId);
      sendVisitorEvent({
        type: 'visitor.selectProperty',
        payload: { propertyId, overlayId: lastOverlayIdRef.current },
      });
    },
    [sendVisitorEvent],
  );

  const handleRequestTour = useCallback(
    (propertyId?: string) => {
      setCtaBusy(true);
      sendVisitorEvent({
        type: 'visitor.requestTour',
        payload: { propertyId, overlayId: lastOverlayIdRef.current },
      });
      setStatusBanner('Tour requested. We will confirm availability shortly.');
      setTimeout(() => setCtaBusy(false), 1200);
    },
    [sendVisitorEvent],
  );

  const handleRequestBrochure = useCallback(
    (propertyId?: string) => {
      setCtaBusy(true);
      sendVisitorEvent({
        type: 'visitor.requestBrochure',
        payload: { propertyId, overlayId: lastOverlayIdRef.current },
      });
      setStatusBanner('Brochure request sent to the agent.');
      setTimeout(() => setCtaBusy(false), 1200);
    },
    [sendVisitorEvent],
  );

  const handleShareContact = useCallback(
    (propertyId?: string) => {
      setCtaBusy(true);
      const fullName = visitorName || 'Visitor';
      sendVisitorEvent({
        type: 'visitor.shareContact',
        payload: { fullName, overlayId: lastOverlayIdRef.current, propertyId },
      });
      setStatusBanner('Sharing your contact with the agent…');
      setTimeout(() => setCtaBusy(false), 1200);
    },
    [sendVisitorEvent, visitorName],
  );

  const hasOverlayContent = useMemo(() => {
    return menuItems.length > 0 || Boolean(propertyDetail) || Boolean(leadStatus) || Boolean(directions);
  }, [directions, leadStatus, menuItems.length, propertyDetail]);

  if (!hasOverlayContent) {
    return null;
  }

  return (
    <div className="estate-overlay">
      {statusBanner ? (
        <div className="mb-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow">
          {statusBanner}
        </div>
      ) : null}
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
          <section className="estate-overlay__properties">
            <h3 className="estate-overlay__section-title">Featured Properties</h3>
            <PropertyShowcase
              menuItems={menuItems}
              selectedPropertyId={selectedPropertyId}
              detail={propertyDetail}
              onSelect={handleSelectProperty}
              onRequestTour={handleRequestTour}
              onRequestBrochure={handleRequestBrochure}
              onShareContact={handleShareContact}
              ctaDisabled={ctaBusy}
            />
          </section>

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

            {directions?.locations && directions.locations.length > 0 ? (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-800">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">Directions</p>
                <ul className="space-y-2">
                  {directions.locations.map((location) => (
                    <li key={`${location.label}-${location.address ?? ''}`} className="rounded-xl bg-white/80 px-3 py-2 shadow-sm">
                      <p className="font-semibold text-slate-900">{location.label}</p>
                      {location.address ? <p className="text-xs text-slate-600">{location.address}</p> : null}
                      {location.notes ? <p className="text-xs text-slate-500">{location.notes}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
