import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function findForm(slug: string, token?: string) {
  const query = supabaseAdmin.from('forms').select('*').eq('slug', slug).maybeSingle();
  const { data, error } = await query;
  if (error) throw error;
  if (!data) return null;
  if (!data.is_active) return null;
  if (token && data.embed_token && token !== data.embed_token) return null;
  return data;
}

export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  const body = await req.json().catch(() => ({}));
  const token = (body.token as string | undefined) || new URL(req.url).searchParams.get('token') || undefined;
  const form = await findForm(slug, token);
  if (!form) {
    return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
  }

  const payload = body.fields && typeof body.fields === 'object' ? body.fields : body;
  const leadBase = {
    full_name: payload.name ?? payload.full_name ?? 'Unknown',
    phone: payload.phone ?? '',
    email: payload.email ?? '',
    preferred_location: payload.location ?? payload.preferred_location ?? '',
    budget: payload.budget ?? null,
    source: `form:${slug}`,
    stage: 'new',
  };

  // upsert lead by phone/email
  let lead_id: string | null = null;
  if (leadBase.phone || leadBase.email) {
    const { data: existingLead } = await supabaseAdmin
      .from('leads')
      .select('*')
      .or(
        [leadBase.phone ? `phone.eq.${leadBase.phone}` : '', leadBase.email ? `email.eq.${leadBase.email}` : '']
          .filter(Boolean)
          .join(','),
      )
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      const { data: updated } = await supabaseAdmin
        .from('leads')
        .update({ ...leadBase, stage: existingLead.stage ?? 'new' })
        .eq('id', existingLead.id)
        .select('id')
        .maybeSingle();
      lead_id = updated?.id ?? existingLead.id;
    } else {
      const { data: inserted } = await supabaseAdmin.from('leads').insert(leadBase).select('id').maybeSingle();
      lead_id = inserted?.id ?? null;
    }
  }

  const { data: submission, error: submitError } = await supabaseAdmin
    .from('form_submissions')
    .insert({
      form_id: form.id,
      lead_id,
      payload,
      status: 'received',
    })
    .select('*')
    .maybeSingle();

  if (submitError) {
    return NextResponse.json({ error: submitError.message }, { status: 500 });
  }

  // fire-and-forget outbound call trigger
  const triggerUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/outbound/call`;
  if (triggerUrl.startsWith('http')) {
    fetch(triggerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_id: submission?.id,
        lead_id,
        phone: leadBase.phone,
        form_id: form.id,
      }),
    }).catch((err) => console.warn('[form submit] outbound trigger failed', err));
  }

  return NextResponse.json({ submission_id: submission?.id, lead_id });
}
