import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongo';

export async function GET() {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const col = db.collection('recruiter_pilot_comparisons');

  const total = await col.countDocuments({});
  const pending = await col.countDocuments({ status: 'pending' });
  const assigned = await col.countDocuments({ status: 'assigned' });
  const completed = await col.countDocuments({ status: 'completed' });
  const sample = await col.find({ status: 'pending' }, { projection: { pairId: 1, status: 1, seq: 1 } })
                          .sort({ seq: 1, _id: 1 }).limit(3).toArray();

  const res = NextResponse.json({
    db: process.env.MONGODB_DB,
    total, pending, assigned, completed,
    sample
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}