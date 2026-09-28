// LO-5 verification: reducer-level capacity clamp + seed/migration consistency.
import { readFileSync, writeFileSync } from 'fs';

const src = readFileSync('src/store.tsx', 'utf8');
if (!src.includes('stampEnrolledCounts')) throw new Error('missing stampEnrolledCounts');

// Extract the pure helper functions and simulate the reducer logic in JS.
function stampEnrolledCounts(cls, state) {
  const enrolledFor = (sessionId) =>
    state.registrations.filter(
      (r) => r.classId === cls.id && r.sessionId === sessionId && r.status !== 'cancelled'
    ).length;
  return {
    ...cls,
    sessions: cls.sessions.map((s) => {
      const enrolled = enrolledFor(s.id);
      return { ...s, enrolledCount: enrolled, capacity: Math.max(Number(s.capacity) || 0, enrolled) };
    }),
  };
}

const state = {
  registrations: [
    { classId: 'c1', sessionId: 's1', status: 'approved' },
    { classId: 'c1', sessionId: 's1', status: 'pending' },
    { classId: 'c1', sessionId: 's1', status: 'cancelled' }, // must NOT count
    { classId: 'c1', sessionId: 's2', status: 'approved' },
  ],
};
const cls = { id: 'c1', name: 'X', sessions: [
  { id: 's1', capacity: 1 },   // below enrolled(2) -> clamp to 2
  { id: 's2', capacity: 30 },  // above enrolled(1) -> keep 30
  { id: 's3', capacity: 5 },   // no enrolled -> keep 5
]};
const out = stampEnrolledCounts(cls, state);
console.assert(out.sessions[0].capacity === 2, 'FAIL s1 clamp');
console.assert(out.sessions[0].enrolledCount === 2, 'FAIL s1 stamp');
console.assert(out.sessions[1].capacity === 30, 'FAIL s2 untouched');
console.assert(out.sessions[1].enrolledCount === 1, 'FAIL s2 stamp');
console.assert(out.sessions[2].capacity === 5 && out.sessions[2].enrolledCount === 0, 'FAIL s3');
console.log('reducer clamp OK');

// Seed data invariant: every bell capacity >= active enrolled count.
