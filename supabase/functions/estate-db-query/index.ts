import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const requestId = crypto.randomUUID();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      query,
      filters,
      property_id: propertyId,
      include_faq: includeFaq,
      overlay_id: overlayId,
    } = await req.json();
    console.log('[estate-db-query]', requestId, { query, filters, propertyId, overlayId });

    const baseSelect =
      'id, name, location, base_price, amenities, unit_types, availability, highlights, hero_image, bedrooms, bathrooms, area_sqft, project_status';

    if (propertyId) {
      const { data: property, error } = await supabase
        .from('properties')
        .select(baseSelect)
        .eq('id', propertyId)
        .maybeSingle();

      if (error) throw error;
      if (!property) {
        return new Response(
          JSON.stringify({ property: null }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      let faqs: Array<{ question: string; answer: string }> | null = null;

      if (includeFaq) {
        const { data: faqData, error: faqError } = await supabase
          .from('property_faqs')
          .select('question, answer')
          .eq('property_id', property.id);

        if (faqError) throw faqError;
        faqs = faqData ?? [];
      }

      return new Response(
        JSON.stringify({
          property,
          faqs: faqs ?? undefined,
          overlayId: overlayId ?? undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let queryBuilder = supabase
      .from('properties')
      .select(baseSelect)
      .order('base_price', { ascending: true })
      .limit(20);

    const searchValue = typeof query === 'string' ? query.trim() : '';
    if (searchValue) {
      queryBuilder = queryBuilder.or(
        `name.ilike.%${searchValue}%,location.ilike.%${searchValue}%`,
      );
    }

    if (filters?.location) {
      queryBuilder = queryBuilder.ilike('location', `%${filters.location}%`);
    }
    if (filters?.max_budget) {
      queryBuilder = queryBuilder.lte('base_price', filters.max_budget);
    }
    if (filters?.bedrooms) {
      queryBuilder = queryBuilder.gte('bedrooms', filters.bedrooms);
    }
    if (filters?.property_type) {
      queryBuilder = queryBuilder.ilike('unit_types', `%${filters.property_type}%`);
    }

    const { data: properties, error } = await queryBuilder;
    if (error) throw error;

    return new Response(
      JSON.stringify({
        properties: properties ?? [],
        overlayId: overlayId ?? undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[estate-db-query] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
