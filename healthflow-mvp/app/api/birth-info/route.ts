import { NextRequest, NextResponse } from 'next/server';
import { ensureSession } from '@/lib/ensure-session';
import { getVerifiedSessionId } from '@/lib/session';
import { getSupabaseServerClient } from '@/lib/supabase';
import { birthInfoSchema } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const sessionId = await ensureSession();
    const body = await req.json().catch(() => null);
    const parsed = birthInfoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
    }

    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .from('birth_info')
      .upsert({ session_id: sessionId, birth_date: parsed.data.birthDate }, { onConflict: 'session_id' });

    if (error) {
      console.error('[birth-info] save failed:', error.message, error);
      return NextResponse.json({ error: 'save_failed', message: error.message }, { status: 500 });
    }

    return NextResponse.json({ saved: true });
  } catch (err) {
    console.error('[birth-info] unexpected error:', err);
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: 'unexpected_error', message }, { status: 500 });
  }
}

export async function GET() {
  const sessionId = getVerifiedSessionId();
  if (!sessionId) return NextResponse.json({ birthDate: null });

  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from('birth_info')
    .select('birth_date')
    .eq('session_id', sessionId)
    .maybeSingle();

  return NextResponse.json({ birthDate: data?.birth_date ?? null });
}
