import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import clientPromise from '@/lib/mongo';

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { assignmentId, choice, participantId, rt_ms, extra } = body || {};

  if (!assignmentId || !choice || !['left', 'right', 'tie'].includes(choice)) {
    return NextResponse.json({ error: 'Missing or invalid fields: assignmentId, choice' }, { status: 400 });
  }

  try {
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB);
    const comparisons = db.collection('recruiter_pilot_comparisons');

    const _id = new ObjectId(assignmentId);
    const doc = await comparisons.findOne({ _id });

    if (!doc) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    if (doc.status === 'completed') {
      const res = NextResponse.json({ ok: true, idempotent: true });
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }

    if (doc.status !== 'assigned') {
      return NextResponse.json({ error: `Assignment not in 'assigned' state`, status: doc.status }, { status: 409 });
    }

    // Map left/right to winning essay ID (or 'tie')
    const order = doc.presented_order;
    if (!order) {
      return NextResponse.json({ error: 'Presented order missing on assignment' }, { status: 500 });
    }

    const normalized_winner = choice === 'tie' ? 'tie' : (choice === 'left' ? order.left : order.right);

    const update = await comparisons.updateOne(
      { _id, status: 'assigned' },
      {
        $set: {
          status: 'completed',
          completed_at: new Date(),
          result: {
            participant_id: participantId ?? null,
            normalized_winner,
            raw_choice: choice,
            rt_ms: typeof rt_ms === 'number' ? rt_ms : null,
            extra: extra ?? null
          }
        }
      }
    );

    if (update.matchedCount === 0) {
      const again = await comparisons.findOne({ _id });
      if (again?.status === 'completed') {
        const res = NextResponse.json({ ok: true, idempotent: true });
        res.headers.set('Cache-Control', 'no-store');
        return res;
      }
      return NextResponse.json({ error: 'Failed to complete assignment (state changed)' }, { status: 409 });
    }

    const res = NextResponse.json({ ok: true });
    res.headers.set('Cache-Control', 'no-store');
    return res;
  } catch (err: any) {
    console.error('Error completing comparison:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
