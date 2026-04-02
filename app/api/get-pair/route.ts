import { NextResponse } from 'next/server';
import { getPairForUser } from '@/lib/pairingLogic';
export const runtime = 'nodejs';

/**
 * Claim the next pending pair.
 * POST allows passing an optional participant_id; GET is kept for convenience.
 * Both responses are non-cacheable and return { pair: null, message } when no work remains.
 */
export async function POST(req: Request) {
  let participant_id: string | undefined;
  try {
    const body = await req.json();
    if (body && typeof body.participant_id === 'string') {
      participant_id = body.participant_id;
    }
  } catch {
    // no body / invalid JSON => ignore; participant_id remains undefined
  }

  const pair = await getPairForUser(participant_id);
  const res = NextResponse.json(
    pair
      ? { pair }
      : { pair: null, message: 'No pairs available' }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export async function GET() {
  const pair = await getPairForUser();
  const res = NextResponse.json(
    pair
      ? { pair }
      : { pair: null, message: 'No pairs available' }
  );
  res.headers.set('Cache-Control', 'no-store');
  return res;
}