/*
  Estate Buddy CRM Seed Data
  Idempotent inserts for demo usage. Safe to run multiple times.
  Note: create at least one admin user via Supabase Auth afterwards and link it to admin_profiles manually.
*/

-- Properties
INSERT INTO properties (name, location, unit_types, base_price, amenities, highlights, availability)
SELECT *
FROM (
  VALUES
    ('Oceanview Residences', 'Miami Beach, FL', ARRAY['1BHK', '2BHK', '3BHK', 'Penthouse'], 450000, ARRAY['Swimming Pool', 'Gym', 'Parking', '24/7 Security', 'Ocean View', 'Smart Home'], 'Luxury beachfront living with stunning ocean views. Modern amenities and prime location.', 'Available'),
    ('Downtown Plaza', 'Austin, TX', ARRAY['Studio', '1BHK', '2BHK'], 320000, ARRAY['Parking', 'Gym', 'Rooftop Terrace', 'Pet Friendly', 'Co-working Space'], 'Urban living in the heart of Austin. Walking distance to restaurants and entertainment.', 'Available'),
    ('Green Valley Estates', 'Portland, OR', ARRAY['2BHK', '3BHK', '4BHK'], 550000, ARRAY['Garden', 'Playground', 'Clubhouse', 'Parking', 'Gym', 'Pet Park'], 'Family-friendly community surrounded by nature. Spacious homes with modern design.', 'Available'),
    ('Skyline Towers', 'Seattle, WA', ARRAY['1BHK', '2BHK', '3BHK', 'Penthouse'], 680000, ARRAY['Concierge', 'Sky Lounge', 'Gym', 'Parking', 'City View', 'Smart Home', 'EV Charging'], 'Premium high-rise living with panoramic city views. State-of-the-art amenities.', 'Limited Units'),
    ('Riverside Gardens', 'Denver, CO', ARRAY['2BHK', '3BHK'], 420000, ARRAY['Riverside Walk', 'Parking', 'Gym', 'Bike Storage', 'Pet Friendly'], 'Peaceful riverside living with mountain views. Perfect for outdoor enthusiasts.', 'Available')
) AS v(name, location, unit_types, base_price, amenities, highlights, availability)
WHERE NOT EXISTS (
  SELECT 1 FROM properties p WHERE p.name = v.name
);

-- Property FAQs
INSERT INTO property_faqs (property_id, question, answer, lang)
SELECT
  p.id,
  f.question,
  f.answer,
  f.lang
FROM (
  VALUES
    ('Oceanview Residences', 'What is the HOA fee?', 'The HOA fee ranges from $350 to $650 per month depending on the unit size. This includes maintenance of common areas, security, and amenities.', 'en'),
    ('Oceanview Residences', 'Is parking included?', 'Yes, each unit comes with 1-2 assigned parking spots in the secure underground garage.', 'en'),
    ('Oceanview Residences', 'Are pets allowed?', 'Yes, we are pet-friendly! Up to 2 pets per unit are allowed with a one-time pet deposit.', 'en'),
    ('Downtown Plaza', 'What is the move-in timeline?', 'Units are available for immediate occupancy. The move-in process typically takes 2-3 weeks after contract signing.', 'en'),
    ('Downtown Plaza', 'Is there public transportation nearby?', 'Yes, the property is located 2 blocks from the metro station and multiple bus routes service the area.', 'en'),
    ('Green Valley Estates', 'What schools are nearby?', 'The property is zoned for excellent Portland Public Schools, with elementary, middle, and high schools within 1-2 miles.', 'en'),
    ('Skyline Towers', 'What floor plans are available?', 'We offer 1BHK (650-800 sq ft), 2BHK (1000-1200 sq ft), 3BHK (1400-1600 sq ft), and Penthouses (2000+ sq ft).', 'en'),
    ('Riverside Gardens', 'Is there bike storage?', 'Yes, we have secure climate-controlled bike storage on the ground level available for all residents.', 'en')
) AS f(property_name, question, answer, lang)
JOIN properties p ON p.name = f.property_name
WHERE NOT EXISTS (
  SELECT 1 FROM property_faqs pf
  WHERE pf.property_id = p.id AND pf.question = f.question
);

-- Leads
INSERT INTO leads (full_name, phone, email, property_type, preferred_location, budget, intent_level, conversion_probability, stage)
SELECT *
FROM (
  VALUES
    ('Sarah Johnson', '+1-555-0101', 'sarah.j@email.com', '2BHK', 'Miami Beach, FL', 480000, 'high', '{"3m": 0.7, "6m": 0.85, "9m": 0.9}'::jsonb, 'Qualified'),
    ('Michael Chen', '+1-555-0102', 'mchen@email.com', '3BHK', 'Austin, TX', 350000, 'medium', '{"3m": 0.4, "6m": 0.6, "9m": 0.75}'::jsonb, 'New'),
    ('Emily Rodriguez', '+1-555-0103', 'emily.r@email.com', 'Penthouse', 'Seattle, WA', 750000, 'high', '{"3m": 0.8, "6m": 0.9, "9m": 0.95}'::jsonb, 'Site Visit'),
    ('David Park', '+1-555-0104', 'dpark@email.com', '1BHK', 'Austin, TX', 300000, 'low', '{"3m": 0.2, "6m": 0.35, "9m": 0.5}'::jsonb, 'New'),
    ('Jessica Williams', '+1-555-0105', 'jwilliams@email.com', '3BHK', 'Portland, OR', 550000, 'high', '{"3m": 0.75, "6m": 0.85, "9m": 0.9}'::jsonb, 'Negotiation')
) AS l(full_name, phone, email, property_type, preferred_location, budget, intent_level, conversion_probability, stage)
WHERE NOT EXISTS (
  SELECT 1 FROM leads ld WHERE ld.email = l.email
);

-- Conversations (with extended fields)
INSERT INTO conversations (
  lead_id,
  transcript,
  sentiment_topics,
  started_at,
  ended_at,
  person_name,
  conversation_summary,
  flat_specification,
  facing_preference,
  interest_level,
  period_to_buy,
  responsibility,
  key_action_points,
  preferred_floor,
  date_of_visit
)
SELECT
  l.id,
  c.transcript,
  c.sentiment_topics,
  c.started_at,
  c.ended_at,
  c.person_name,
  c.conversation_summary,
  c.flat_specification,
  c.facing_preference,
  c.interest_level,
  c.period_to_buy,
  c.responsibility,
  c.key_action_points,
  c.preferred_floor,
  c.date_of_visit
FROM (
  VALUES
    ('Sarah Johnson', 'User: Hi, I am looking for a beachfront property in Miami.
Assistant: Great! I can help you with that. Let me search for available beachfront properties in Miami Beach.
User: What amenities do they have?
Assistant: Oceanview Residences offers a swimming pool, gym, 24/7 security, parking, ocean views, and smart home features.
User: That sounds perfect! What is the price range?
Assistant: The base price starts at $450,000, with unit types ranging from 1BHK to Penthouse.
User: I am interested in a 2BHK. Can we schedule a visit?', '{"sentiment": "positive", "topics": ["beachfront", "amenities", "pricing", "site visit"]}'::jsonb,
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days' + INTERVAL '8 minutes',
     'Sarah Johnson', 'Sarah requested a 2BHK beachfront unit with a focus on amenities and pricing.', '2 BHK', 'East Facing', 'High', '2 Weeks', 'Sales Executive', 'Schedule on-site visit and share financing options.', '3rd Floor', NOW() - INTERVAL '2 days'),

    ('Michael Chen', 'User: Hello, do you have any properties in Austin?
Assistant: Yes! We have Downtown Plaza in Austin with studio, 1BHK, and 2BHK units.
User: What is the starting price?
Assistant: The base price starts at $320,000.
User: I will think about it and get back to you.', '{"sentiment": "neutral", "topics": ["Austin properties", "pricing"]}'::jsonb,
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '5 minutes',
     'Michael Chen', 'Michael is exploring Austin units and needs additional pricing comparisons.', '2 BHK', 'South Facing', 'Medium', '1 Month', 'Sales Team', 'Send Austin pricing comparison sheet.', '5th Floor', NOW() - INTERVAL '1 day'),

    ('Emily Rodriguez', 'User: I am interested in penthouses with skyline views.
Assistant: Skyline Towers offers penthouses with smart home integrations and concierge service.
User: Perfect, please send the brochure and financing details.', '{"sentiment": "positive", "topics": ["penthouses", "skyline", "brochure"]}'::jsonb,
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '10 minutes',
     'Emily Rodriguez', 'Emily wants a premium penthouse and requested brochures plus financing info.', 'Penthouse', 'North Facing', 'High', '3 Weeks', 'Marketing Team', 'Send premium brochure and connect with finance team.', '12th Floor', NOW() - INTERVAL '3 days'),

    ('David Park', 'User: I''m looking for a compact apartment near transit.
Assistant: Downtown Plaza 1BHK units are a good fit with immediate availability.
User: Great, can you share lease-to-own options?', '{"sentiment": "positive", "topics": ["compact", "transit", "lease-to-own"]}'::jsonb,
     NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days' + INTERVAL '6 minutes',
     'David Park', 'David needs lease-to-own information for a 1BHK near transit.', '1 BHK', 'West Facing', 'Medium', '3 Weeks', 'Finance Team', 'Prepare lease-to-own offer.', '2nd Floor', NOW() - INTERVAL '4 days'),

    ('Jessica Williams', 'User: Can I customize interiors for a 3BHK in Portland?
Assistant: Green Valley Estates offers customization packages and family-friendly amenities.
User: Fantastic, please outline timelines and costs.', '{"sentiment": "positive", "topics": ["customization", "timelines"]}'::jsonb,
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '7 minutes',
     'Jessica Williams', 'Jessica is close to purchase and wants customization timelines.', '3 BHK', 'East Facing', 'High', '1 Month', 'Design Team', 'Share customization catalog and timeline.', '4th Floor', NOW() - INTERVAL '5 days')
) AS c(
  lead_name,
  transcript,
  sentiment_topics,
  started_at,
  ended_at,
  person_name,
  conversation_summary,
  flat_specification,
  facing_preference,
  interest_level,
  period_to_buy,
  responsibility,
  key_action_points,
  preferred_floor,
  date_of_visit
)
JOIN leads l ON l.full_name = c.lead_name
WHERE NOT EXISTS (
  SELECT 1 FROM conversations existing
  WHERE existing.lead_id = l.id
    AND existing.started_at = c.started_at
);

-- Activities
INSERT INTO activities (lead_id, type, message, due_at)
SELECT
  l.id,
  a.type,
  a.message,
  a.due_at
FROM (
  VALUES
    ('Sarah Johnson', 'task', 'Schedule site visit for Oceanview Residences', NOW() + INTERVAL '1 day'),
    ('Emily Rodriguez', 'note', 'Share penthouse brochure and financing plan.', NULL),
    ('Michael Chen', 'task', 'Follow up with Austin pricing comparison.', NOW() + INTERVAL '2 days'),
    ('David Park', 'status', 'Awaiting lease-to-own offer details.', NULL),
    ('Jessica Williams', 'note', 'Coordinate customization workshop with design team.', NULL)
) AS a(lead_name, type, message, due_at)
JOIN leads l ON l.full_name = a.lead_name
WHERE NOT EXISTS (
  SELECT 1 FROM activities ac
  WHERE ac.lead_id = l.id
    AND ac.type = a.type
    AND ac.message = a.message
);

-- Public Links & Avatars
WITH upsert_avatar AS (
  INSERT INTO ai_avatars (name, heygen_avatar_id, system_prompt, is_active)
  SELECT 'Estate Buddy Default', 'Wayne_20240711',
    'You are Estate Buddy, a professional bilingual property consultant. Provide concise, helpful answers about inventory, pricing, financing, and appointments.',
    true
  WHERE NOT EXISTS (
    SELECT 1 FROM ai_avatars WHERE name = 'Estate Buddy Default'
  )
  RETURNING id
)
INSERT INTO public_links (slug, title, is_enabled, config, rate_limit_per_min, avatar_id)
SELECT
  'estate-buddy-demo',
  'Estate Buddy Demo Experience',
  true,
  jsonb_build_object(
    'assistantPrompt', 'You are Estate Buddy, a helpful real estate assistant.',
    'model', 'gpt-4o-mini',
    'avatarName', 'Estate Buddy',
    'voice', 'en-US-JennyNeural'
  ),
  20,
  COALESCE((SELECT id FROM upsert_avatar), (SELECT id FROM ai_avatars WHERE name = 'Estate Buddy Default'))
WHERE NOT EXISTS (
  SELECT 1 FROM public_links WHERE slug = 'estate-buddy-demo'
);

-- Reports
INSERT INTO reports (conversation_id, lead_id, report_type, content_html, generated_at)
SELECT
  c.id,
  c.lead_id,
  'consultation',
  '<h2>Consultation Summary</h2><p>' || c.conversation_summary || '</p>',
  NOW()
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1 FROM reports r WHERE r.conversation_id = c.id
);

-- Basic dashboard snapshot query (no-op to help developers verify)
-- SELECT 'Properties', COUNT(*) FROM properties;
