// lib/pairingLogic.ts
import clientPromise from './mongo';
import { ObjectId } from 'mongodb';
import { loadPairs } from './dataStore';

const COLLECTION = 'recruiter_pilot_comparisons';
const RATINGS_PER_PAIR = 3;

export async function getPairForUser(participantId?: string) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const comparisons = db.collection(COLLECTION);

  await ensureIndexes(comparisons);
  await seedPairsIfNeeded(db);

  // Reclaim stale assignments (tab closed, crash, etc.)
  const RECLAIM_MS = 10 * 60 * 1000;
  await comparisons.updateMany(
    { status: 'assigned', claimed_at: { $lt: new Date(Date.now() - RECLAIM_MS) } },
    { $set: { status: 'pending', participant_id: null, claimed_at: null, presented_order: null } }
  );

  // Find pairIds this participant has already seen (to avoid duplicates)
  const seenPairIds = participantId
    ? (await comparisons.distinct('pairId', {
        'result.participant_id': participantId,
        status: 'completed'
      }))
    : [];

  const MAX_TRIES = 5;
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    const filter: any = { status: 'pending' };
    if (seenPairIds.length > 0) {
      filter.pairId = { $nin: seenPairIds };
    }

    const candidate = await comparisons.find(filter)
      .sort({ seq: 1, _id: 1 })
      .limit(1)
      .toArray();

    if (!candidate.length) return null;

    const now = new Date();
    const upd = await comparisons.updateOne(
      { _id: candidate[0]._id, status: 'pending' },
      { $set: { status: 'assigned', participant_id: participantId ?? null, claimed_at: now } }
    );

    if (upd.modifiedCount === 0) {
      await new Promise(r => setTimeout(r, 10 + Math.random() * 40));
      continue;
    }

    const doc: any = await comparisons.findOne({ _id: candidate[0]._id });
    if (!doc) {
      await new Promise(r => setTimeout(r, 10));
      continue;
    }

    // Randomize which essay appears on left vs right
    const flip = Math.random() < 0.5;
    const presented = flip
      ? { left: doc.essay_a_id, right: doc.essay_b_id, leftHtml: doc.essay_a, rightHtml: doc.essay_b }
      : { left: doc.essay_b_id, right: doc.essay_a_id, leftHtml: doc.essay_b, rightHtml: doc.essay_a };

    await comparisons.updateOne(
      { _id: doc._id, status: 'assigned' },
      { $set: { presented_order: { left: presented.left, right: presented.right } } }
    );

    return {
      assignmentId: String(doc._id),
      pairId: doc.pairId,
      leftHtml: presented.leftHtml,
      rightHtml: presented.rightHtml,
    };
  }

  return null;
}

export async function submitResult({
  assignmentId,
  participantId,
  choice
}: {
  assignmentId: string;
  participantId?: string;
  choice: 'left' | 'right' | 'tie';
}) {
  const client = await clientPromise;
  const db = client.db(process.env.MONGODB_DB);
  const comparisons = db.collection(COLLECTION);

  const doc = await comparisons.findOne({ _id: new ObjectId(assignmentId) });
  if (!doc) return false;
  if (doc.status === 'completed') return true;
  if (doc.status !== 'assigned') return false;

  const winner =
    choice === 'tie'
      ? 'tie'
      : choice === 'left'
        ? doc.presented_order?.left
        : doc.presented_order?.right;

  if (!winner) return false;

  const result = await comparisons.updateOne(
    { _id: new ObjectId(assignmentId), status: 'assigned' },
    {
      $set: {
        status: 'completed',
        completed_at: new Date(),
        result: {
          participant_id: participantId ?? null,
          normalized_winner: winner,
          raw_choice: choice
        }
      }
    }
  );

  return result.matchedCount > 0;
}

// ---- Seeding ----
async function seedPairsIfNeeded(db: any) {
  const comparisons = db.collection(COLLECTION);
  const pairs = loadPairs();

  const bulk = comparisons.initializeUnorderedBulkOp();
  let ops = 0;

  // Create RATINGS_PER_PAIR assignment slots per pair
  pairs.forEach((p, index) => {
    for (let rep = 0; rep < RATINGS_PER_PAIR; rep++) {
      const slotId = `${p.id}_rep${rep}`;
      bulk.find({ slotId }).upsert().updateOne({
        $setOnInsert: {
          slotId,
          pairId: p.id,
          rep,
          seq: index,
          essay_a_id: p.essay_a_id,
          essay_b_id: p.essay_b_id,
          essay_a: p.essay_a,
          essay_b: p.essay_b,
          status: 'pending',
          participant_id: null,
          claimed_at: null,
          completed_at: null,
          presented_order: null,
          created_at: new Date()
        }
      });
      ops++;
    }
  });

  if (ops === 0) return;

  try {
    await bulk.execute();
  } catch (e: any) {
    if (e.code !== 11000) throw e;
  }
}

// ---- Indexes ----
async function ensureIndexes(comparisons: any) {
  await comparisons.createIndex({ slotId: 1 }, { unique: true });
  await comparisons.createIndex({ status: 1, pairId: 1, seq: 1, _id: 1 });
  await comparisons.createIndex({ status: 1, claimed_at: 1 });
  await comparisons.createIndex({ 'result.participant_id': 1, status: 1 });
}
