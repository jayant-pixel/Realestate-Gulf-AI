import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('id, full_name, phone, email, preferred_location, budget, stage, last_call_summary, updated_at')
    .order('updated_at', { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = (data || []).reduce<Record<string, any[]>>((acc, lead) => {
    const stage = (lead.stage || 'new').toLowerCase();
    acc[stage] = acc[stage] || [];
    acc[stage].push(lead);
    return acc;
  }, {});

  return NextResponse.json({ data: grouped });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const lead_id = body.lead_id as string | undefined;
  const stage = (body.stage as string | undefined)?.toLowerCase();
  if (!lead_id || !stage) {
    return NextResponse.json({ error: 'lead_id and stage required' }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from('leads')
    .update({ stage })
    .eq('id', lead_id)
    .select('*')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}
