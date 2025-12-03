import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const call_sid = body.call_sid || body.callSid || body.call_id;
  const lead_id = body.lead_id as string | undefined;
  const status = body.status || 'completed';
  const analysis = body.analysis || body.summary || {};
  const duration = body.duration_seconds ?? body.duration ?? null;
  const recording_url = body.recording_url ?? null;

  if (!call_sid) {
    return NextResponse.json({ error: 'call_sid required' }, { status: 400 });
  }

  const updates: Record<string, any> = {
    status,
    analysis,
    recording_url,
  };
  if (duration !== null) updates.duration_seconds = duration;
  if (body.started_at) updates.started_at = body.started_at;
  if (body.ended_at) updates.ended_at = body.ended_at;

  const { data: callRow, error } = await supabaseAdmin
    .from('calls')
    .update(updates)
    .eq('call_sid', call_sid)
    .select('*')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (callRow?.form_submission_id) {
    await supabaseAdmin.from('form_submissions').update({ status: 'completed' }).eq('id', callRow.form_submission_id);
  }

  if (lead_id) {
    const nextStage = analysis?.intent === 'high' || analysis?.interest === 'high' ? 'qualified' : 'contacted';
    await supabaseAdmin
      .from('leads')
      .update({
        last_call_id: callRow?.id,
        last_call_summary: analysis?.summary ?? body.summary ?? null,
        stage: nextStage,
      })
      .eq('id', lead_id);

    await supabaseAdmin.from('activities').insert({
      lead_id,
      type: 'call',
      message: analysis?.summary ?? 'Outbound call completed',
      due_at: null,
    });
  }

  return NextResponse.json({ data: callRow });
}
