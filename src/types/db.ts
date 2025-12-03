export interface Property {
  id: string;
  name: string;
  location: string;
  unit_types: string[];
  base_price: number;
  amenities: string[];
  highlights: string;
  availability: string;
  updated_at: string;
}

export interface PropertyFAQ {
  id: string;
  property_id: string;
  question: string;
  answer: string;
  lang: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  property_type: string;
  preferred_location: string;
  budget: number;
  intent_level: 'low' | 'medium' | 'high';
  conversion_probability: {
    '3m': number;
    '6m': number;
    '9m': number;
  };
  stage:
    | 'new'
    | 'contacted'
    | 'qualified'
    | 'follow_up'
    | 'site_visit'
    | 'negotiation'
    | 'closed_won'
    | 'closed_lost'
    | 'New'
    | 'Qualified'
    | 'Site Visit'
    | 'Negotiation'
    | 'Closed'
    | 'Lost';
  created_at: string;
  updated_at: string;
  source?: string | null;
  last_call_id?: string | null;
  last_call_summary?: string | null;
  timeline?: string | null;
  budget_confirmed?: number | null;
}

export interface Conversation {
  id: string;
  lead_id: string | null;
  transcript: string;
  sentiment_topics: {
    sentiment?: 'positive' | 'neutral' | 'negative';
    topics?: string[];
  };
  started_at: string;
  ended_at: string | null;
  ext_event_id: string;
  created_at: string;
}

export interface Activity {
  id: string;
  lead_id: string;
  type: 'note' | 'task' | 'status';
  message: string;
  due_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AdminProfile {
  user_id: string;
  display_name: string;
  created_at: string;
}

export interface AIAvatar {
  id: string;
  name: string;
  system_prompt: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  anam_avatar_id?: string | null;
  openai_voice?: string | null;
  openai_realtime_model?: string | null;
  prompt_version?: string | null;
  prompt_updated_at?: string | null;
}

export interface PublicLink {
  id: string;
  slug: string;
  title: string;
  is_enabled: boolean;
  avatar_id: string | null;
  config: {
    model?: string;
    voice?: string;
    assistantPrompt?: string;
    avatarId?: string | null;
    welcomeMessage?: string;
    avatarName?: string;
    avatarVariant?: string;
    avatarImage?: string;
  };
  livekit_room?: string | null;
  agent_identity?: string | null;
  default_property_id?: string | null;
  livekit_metadata?: Record<string, unknown> | null;
  rate_limit_per_min: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadOverview {
  total_leads: number;
  new_today: number;
  high_intent: number;
  closed_deals: number;
  lost_deals: number;
}

export interface IntentCount {
  intent_level: string;
  count: number;
}

export interface ConversionAvgs {
  avg_3m: number;
  avg_6m: number;
  avg_9m: number;
}

export interface SentimentTopic {
  sentiment: string;
  count: number;
}

export interface AgentPerformance {
  display_name: string;
  leads_handled: number;
  tasks_created: number;
  notes_added: number;
}

export interface Form {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  fields: Record<string, unknown>;
  embed_token: string;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  lead_id?: string | null;
  payload: Record<string, unknown>;
  status: 'received' | 'queued' | 'called' | 'completed' | 'failed';
  created_at: string;
}

export interface CallLog {
  id: string;
  lead_id?: string | null;
  form_submission_id?: string | null;
  phone?: string | null;
  call_sid?: string | null;
  status?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  analysis?: Record<string, unknown> | null;
  created_at: string;
}
