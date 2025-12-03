export type OverlayKind =
  | 'properties.menu'
  | 'properties.detail'
  | 'directions.show'
  | 'directions.clear'
  | 'leads.created'
  | 'leads.activity';

export interface PropertyItem {
  id: string;
  name: string;
  location?: string;
  price?: number;
  availability?: string;
  hero_image?: string;
  amenities?: string[];
  unit_types?: string[];
  highlights?: string;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface PropertyMenuPayload {
  action: 'menu';
  overlayId?: string;
  items: PropertyItem[];
  filters?: Record<string, unknown>;
  query?: string;
}

export interface PropertyDetailPayload {
  action: 'detail';
  overlayId?: string;
  item: PropertyItem;
  faqs?: Array<{ question: string; answer: string }>;
}

export interface LeadCreatedPayload {
  action: 'created';
  overlayId?: string;
  leadId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
}

export interface LeadActivityPayload {
  action: 'activity';
  overlayId?: string;
  leadId?: string;
  message: string;
  type?: string;
}

export interface DirectionsPayload {
  action: 'show' | 'clear';
  overlayId?: string;
  locations?: Array<{
    label: string;
    address?: string;
    lat?: number;
    lng?: number;
    notes?: string;
  }>;
}

export type ClientPropertiesRPC = PropertyMenuPayload | PropertyDetailPayload;
export type ClientLeadsRPC = LeadCreatedPayload | LeadActivityPayload;
export type ClientDirectionsRPC = DirectionsPayload;

export interface OverlayPayload {
  kind: OverlayKind;
  overlayId?: string;
  items?: PropertyItem[];
  item?: PropertyItem;
  property?: PropertyItem;
  faqs?: Array<{ question: string; answer: string }>;
  filters?: Record<string, unknown>;
  query?: string;
  leadId?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  message?: string;
  type?: string;
  locations?: DirectionsPayload['locations'];
}

export type VisitorRPCPayload =
  | { type: 'visitor.selectProperty'; payload: { propertyId: string; overlayId?: string } }
  | { type: 'visitor.requestTour'; payload: { propertyId?: string; overlayId?: string } }
  | { type: 'visitor.requestBrochure'; payload: { propertyId?: string; overlayId?: string } }
  | {
      type: 'visitor.shareContact';
      payload: { fullName: string; phone?: string; email?: string; overlayId?: string };
    }
  | { type: 'agent.overlayAck'; payload: { overlayId?: string; status?: 'rendered' | 'cleared' } };

