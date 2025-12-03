import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEFAULT_FIELDS = {
  name: { required: true, label: 'Full name' },
  phone: { required: true, label: 'Phone' },
  email: { required: false, label: 'Email' },
  budget: { required: false, label: 'Budget' },
  location: { required: false, label: 'Location' },
  notes: { required: false, label: 'Notes' },
};

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');
  const query = supabaseAdmin.from('forms').select('*').order('created_at', { ascending: false });
  const { data, error } = slug ? await query.eq('slug', slug) : await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = (body.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  const slug = slugify(body.slug || name);
  const embed_token = randomBytes(16).toString('hex');
  const fields = body.fields && typeof body.fields === 'object' ? body.fields : DEFAULT_FIELDS;
  const { data, error } = await supabaseAdmin
    .from('forms')
    .insert({
      name,
      slug,
      description: body.description ?? null,
      fields,
      embed_token,
      is_active: body.is_active ?? true,
    })
    .select('*')
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data, embedSnippet: buildEmbedSnippet(slug, embed_token) }, { status: 201 });
}

function buildEmbedSnippet(slug: string, token: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || '';
  const src = `${origin}/forms/${slug}?token=${token}`;
  return `<iframe src="${src}" style="width:100%;max-width:480px;border:0;border-radius:16px;height:640px;"></iframe>`;
}
