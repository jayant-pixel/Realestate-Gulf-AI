import { NextResponse } from 'next/server';
import { SipClient } from 'livekit-server-sdk';
import { supabaseAdmin } from '@/lib/supabase-admin';

const trunkId = process.env.LIVEKIT_SIP_OUTBOUND_TRUNK_ID || process.env.LIVEKIT_OUTBOUND_TRUNK_ID || '';
const callerNumber = process.env.LIVEKIT_PHONE_NUMBER || process.env.LIVEKIT_OUTBOUND_NUMBER || '';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const phone = (body.phone as string | undefined)?.trim();
  const lead_id = body.lead_id as string | undefined;
  const submission_id = body.submission_id as string | undefined;
  const form_id = body.form_id as string | undefined;
  const room_name =
    body.room_name ||
    `outbound-${submission_id || lead_id || Math.random().toString(36).slice(2, 8)}`;

  if (!phone) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 });
  }
  if (!trunkId) {
    return NextResponse.json({ error: 'LIVEKIT_SIP_OUTBOUND_TRUNK_ID not configured (LiveKit Phone trunk)' }, { status: 500 });
  }

  const callMeta = {
    lead_id,
    submission_id,
    form_id,
    source: 'form_outbound',
  };

  try {
    const sipClient = new SipClient(
      process.env.LIVEKIT_URL || '',
      process.env.LIVEKIT_API_KEY || '',
      process.env.LIVEKIT_API_SECRET || '',
    );

    const participantIdentity = `outbound-${lead_id || submission_id || Date.now()}`;
    const participantName = 'Outbound Caller';

    // LiveKit server SDK expects positional args: (trunkId, sipCallTo, roomName, options)
    const participant = await sipClient.createSipParticipant(trunkId, phone, room_name, {
      participantIdentity,
      participantName,
      sipNumber: callerNumber || undefined,
      custom: JSON.stringify(callMeta),
      waitUntilAnswered: false,
      playDialtone: true,
      displayName: 'Realestate Gulf AI',
    });

    const { data: callRow, error } = await supabaseAdmin
      .from('calls')
      .insert({
        lead_id,
        form_submission_id: submission_id,
        phone,
        call_sid: participant?.callSid || participant?.participant?.sid || null,
        status: 'initiated',
        started_at: new Date().toISOString(),
        room_name,
      })
      .select('*')
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (submission_id) {
      await supabaseAdmin.from('form_submissions').update({ status: 'queued' }).eq('id', submission_id);
    }

    return NextResponse.json({ call: callRow, participant });
  } catch (error: any) {
    console.error('[outbound call] failed', error);
    return NextResponse.json({ error: error?.message ?? 'call failed' }, { status: 500 });
  }
}
